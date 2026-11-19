// 3D の見た目（地形・竹林・田んぼ・紅葉・岩・穴・ねずみ・家・おむすび）
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from '../vendor/jsm/utils/BufferGeometryUtils.js'
import { OBJ, S_END, L, YARD, HOLE, height, surfaceAt, widths, cx, sectionAt, rng, clamp } from './course.js?v=1'

const TEX = {}
const FIRST = ['dirt_diff', 'aerial_grass_rock_diff', 'grass_path_2_diff', 'brown_mud_02_diff']
const LATER = { dirt_nor_gl: '#8080ff', aerial_grass_rock_nor_gl: '#8080ff', rock_boulder_dry_diff: '#78736a', rock_boulder_dry_nor_gl: '#8080ff', weathered_planks_diff: '#6a5544', plastered_wall_04_diff: '#c9c2b4', forest_leaves_02_diff: '#7a5a30', brown_mud_02_nor_gl: '#8080ff', grass_path_2_nor_gl: '#8080ff' }
const CLONES = {}
function prep(t, n) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (/diff/.test(n)) t.colorSpace = THREE.SRGBColorSpace; return t }
export function loadTextures(V, onEach) {
  const tl = new THREE.TextureLoader()
  for (const [n, col] of Object.entries(LATER)) { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 4, 4); TEX[n] = prep(new THREE.Texture(c), n); TEX[n].needsUpdate = true }
  return Promise.all(FIRST.map(n => tl.loadAsync('assets/tex/' + n + '.webp' + V).then(t => { TEX[n] = prep(t, n); onEach && onEach() }).catch(e => { console.warn('tex', n, e); onEach && onEach() })))
}
export function loadLaterTextures(V) {
  for (const n of Object.keys(LATER)) {
    const img = new Image(); img.decoding = 'async'
    img.onload = () => { for (const t of [TEX[n], ...(CLONES[n] || [])]) { t.dispose(); t.image = img; t.needsUpdate = true } }
    img.src = 'assets/tex/' + n + '.webp' + V
  }
}
const tx = (n, rx = 1, ry = rx) => { const t = TEX[n]; if (!t) return null; const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; (CLONES[n] || (CLONES[n] = [])).push(c); return c }

// ------------------------------------------------------------ 地形
const U0 = -30, U1 = 30, DU = 0.75, DS = 0.75
function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: TEX.dirt_diff || null, normalMap: TEX.dirt_nor_gl || null, roughness: 0.95, metalness: 0 })
  m.normalScale.set(0.8, 0.8)
  m.userData.u = { tGrass: { value: TEX.aerial_grass_rock_diff }, tMeadow: { value: TEX.grass_path_2_diff }, tMud: { value: TEX.brown_mud_02_diff }, time: { value: 0 } }
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aW; varying vec4 vW; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = aW; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tGrass; uniform sampler2D tMeadow; uniform sampler2D tMud; uniform float time;
varying vec4 vW; varying vec3 vWP;
float h21(vec2 p){ p = mod(p, 1024.0); vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }`)
      .replace('#include <map_fragment>', `
vec2 wuv = vWP.xz;
vec3 dirt = texture2D(map, wuv * 0.32).rgb * vec3(1.08, 0.98, 0.88);
// 道の真ん中は踏み固められて明るく、轍が2本
float rut = smoothstep(0.18, 0.0, abs(abs(vW.w) - 0.55));
dirt *= 1.0 - 0.12 * rut;
vec3 grass = texture2D(tGrass, wuv * 0.11).rgb * vec3(0.95, 1.05, 0.72);
grass = mix(grass, grass * vec3(1.25, 1.05, 0.6), 0.35 * smoothstep(0.3, 0.7, h21(floor(wuv * 0.7))));
vec3 meadow = texture2D(tMeadow, wuv * 0.18).rgb * vec3(1.0, 1.05, 0.8);
vec3 mud = texture2D(tMud, wuv * 0.25).rgb * vec3(0.95, 0.9, 0.82);
float wet = vW.z;
vec3 col = dirt;
col = mix(col, grass, vW.x);
col = mix(col, meadow, vW.y);
col = mix(col, mud * 0.85, wet);
diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.22, vW.z * 0.85);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// 田んぼの水が空を映す
vec3 Vd = normalize(cameraPosition - vWP);
float fr = pow(1.0 - max(Vd.y, 0.0), 4.0);
totalEmissiveRadiance += vec3(0.45, 0.6, 0.75) * fr * vW.z * 0.5;`)
  }
  return m
}
function surfW(x, z) {
  const sf = surfaceAt(x, z), u = x - cx(z), w = widths(z)
  const k = sf === 'dirt' ? [0, 0, 0] : sf === 'grass' ? [1, 0, 0] : sf === 'paddy' ? [0, 0, 1] : sf === 'meadow' ? [0, 1, 0] : [0.15, 0.7, 0]
  return [k[0], k[1], k[2], clamp(u / Math.max(1, w.road) * 1.6, -2, 2)]
}
function buildTerrain(scene, mat) {
  const group = new THREE.Group(); group.name = 'terrain'
  const nu = Math.round((U1 - U0) / DU) + 1, chunk = 60
  for (let c0 = -40; c0 < L + 30; c0 += chunk) {
    const ns = Math.round(chunk / DS) + 1
    const pos = new Float32Array(nu * ns * 3), nor = new Float32Array(nu * ns * 3), uv = new Float32Array(nu * ns * 2), wt = new Float32Array(nu * ns * 4)
    let k = 0
    for (let j = 0; j < ns; j++) {
      const z = c0 + j * DS, c = cx(z)
      for (let i = 0; i < nu; i++, k++) {
        const u = U0 + i * DU, x = c + u, y = height(x, z)
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z
        const e = 0.4, gx = (height(x + e, z) - height(x - e, z)) / (2 * e), gz = (height(x, z + e) - height(x, z - e)) / (2 * e)
        const nl = Math.hypot(gx, 1, gz); nor[k * 3] = -gx / nl; nor[k * 3 + 1] = 1 / nl; nor[k * 3 + 2] = -gz / nl
        uv[k * 2] = x * 0.32; uv[k * 2 + 1] = z * 0.32
        wt.set(surfW(x, z), k * 4)
      }
    }
    const idx = []
    for (let j = 0; j < ns - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1; idx.push(a, c, b, b, c, d) }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aW', new THREE.BufferAttribute(wt, 4)); g.setIndex(idx)
    g.computeBoundingSphere()
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; group.add(m)
  }
  scene.add(group); return group
}

// ------------------------------------------------------------ 空・遠い山（秋）
export function buildSky(scene) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x4a86cf) }, hor: { value: new THREE.Color(0xf2e8d6) }, sunDir: { value: new THREE.Vector3(-0.45, 0.42, 0.75).normalize() }, sunCol: { value: new THREE.Color(1, 0.88, 0.66) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vD;
      float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      void main(){ float h = clamp(vD.y, -0.2, 1.0); vec3 c = mix(hor, top, pow(max(h, 0.0), 0.5));
        float s = max(dot(normalize(vD), sunDir), 0.0); c += sunCol * (pow(s, 800.0) * 5.0 + pow(s, 16.0) * 0.3 + pow(s, 3.0) * 0.1);
        // うろこ雲（秋の空）
        vec2 cp = vD.xz / max(0.12, vD.y) * 2.2; float cl = n2(cp * 1.3) * 0.6 + n2(cp * 3.1) * 0.4; cl = smoothstep(0.55, 0.85, cl) * smoothstep(0.05, 0.35, vD.y);
        c = mix(c, vec3(1.0, 0.98, 0.95), cl * 0.75);
        gl_FragColor = vec4(c, 1.0); }`,
  })
  const s = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), m); s.renderOrder = -10; s.frustumCulled = false; scene.add(s)
  return s
}
function hillsTex() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512; const x = c.getContext('2d'); const R = rng(5)
  const ridge = (seed, base, amp) => { const R2 = rng(seed), ph = [R2() * 6, R2() * 6, R2() * 6], ys = []; for (let i = 0; i <= 512; i++) { const a = i / 512 * Math.PI * 2; ys.push(base - amp * (0.5 + 0.3 * Math.sin(a * 3 + ph[0]) + 0.15 * Math.sin(a * 7 + ph[1]) + 0.06 * Math.sin(a * 19 + ph[2]))) } return ys }
  const layers = [
    { ys: ridge(11, 330, 200), cols: ['#9fb6c9', '#b9c6cc'] },
    { ys: ridge(23, 390, 150), cols: ['#7d9672', '#a59a6a'] },
    { ys: ridge(37, 450, 110), cols: ['#6a7d45', '#b5703a', '#c9a23f'] },
  ]
  for (const Lr of layers) {
    x.beginPath(); x.moveTo(0, 512); Lr.ys.forEach((y, i) => x.lineTo(i * 4, y)); x.lineTo(2048, 512); x.closePath()
    const g = x.createLinearGradient(0, Math.min(...Lr.ys), 0, 512); g.addColorStop(0, Lr.cols[0]); g.addColorStop(1, Lr.cols[1]); x.fillStyle = g; x.fill()
    // 紅葉の点々
    if (Lr.cols.length > 2) { x.save(); x.clip(); for (let i = 0; i < 2600; i++) { const px = R() * 2048, yi = Math.floor(px / 4), py = Lr.ys[yi] + 4 + R() * 120; x.fillStyle = ['#c4542c', '#d8902c', '#a7392a', '#7a8a3a', '#e0b040'][Math.floor(R() * 5)]; x.globalAlpha = 0.55; x.beginPath(); x.arc(px, py, 3 + R() * 6, 0, 7); x.fill() } x.restore() }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping
  return t
}
export function buildBackdrop(scene) {
  const g = new THREE.CylinderGeometry(900, 900, 420, 64, 1, true)
  const m = new THREE.MeshBasicMaterial({ map: hillsTex(), side: THREE.BackSide, transparent: true, depthWrite: false, fog: false })
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -9; mesh.frustumCulled = false; scene.add(mesh)
  return mesh
}

// ------------------------------------------------------------ 材料
export const M = {}
function mats() {
  if (M.wood) return M
  M.wood = new THREE.MeshStandardMaterial({ map: tx('weathered_planks_diff', 1, 1), roughness: 0.9 }); M.wood.color.setRGB(1.5, 1.2, 0.95)
  M.woodDark = new THREE.MeshStandardMaterial({ map: tx('weathered_planks_diff', 1, 1), roughness: 0.9 }); M.woodDark.color.setRGB(0.85, 0.62, 0.45)
  M.plaster = new THREE.MeshStandardMaterial({ map: tx('plastered_wall_04_diff', 1.5), roughness: 0.95 }); M.plaster.color.setRGB(1.15, 1.1, 1.0)
  M.stone = new THREE.MeshStandardMaterial({ map: tx('rock_boulder_dry_diff', 0.6), normalMap: tx('rock_boulder_dry_nor_gl', 0.6), color: 0xb5b1a8, roughness: 0.95 })
  M.thatch = new THREE.MeshStandardMaterial({ map: thatchTex(), roughness: 1, color: 0xd9c08a })
  M.red = new THREE.MeshStandardMaterial({ color: 0xc23a2b, roughness: 0.75 })
  M.straw = new THREE.MeshStandardMaterial({ color: 0xd9b866, roughness: 0.9 })
  M.cloth = new THREE.MeshStandardMaterial({ color: 0x3e5f8a, roughness: 0.85 })
  M.shoji = new THREE.MeshStandardMaterial({ map: shojiTex(), roughness: 0.9, emissive: 0x30281a, emissiveIntensity: 0.4 })
  M.holeIn = new THREE.MeshBasicMaterial({ map: holeTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
  M.mound = new THREE.MeshStandardMaterial({ map: tx('dirt_diff', 1), color: 0xa88a6a, roughness: 1 })
  return M
}
function thatchTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#b89a5c'; x.fillRect(0, 0, 128, 256); const R = rng(9); for (let i = 0; i < 1400; i++) { const px = R() * 128, py = R() * 256; x.strokeStyle = `rgba(${90 + R() * 80 | 0},${70 + R() * 60 | 0},${30 + R() * 30 | 0},0.6)`; x.lineWidth = 1 + R(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 3, py + 10 + R() * 22); x.stroke() } for (let y = 0; y < 256; y += 32) { x.fillStyle = 'rgba(40,30,15,0.25)'; x.fillRect(0, y, 128, 3) } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t }
function shojiTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#efe6cf'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#6b4a2a'; x.lineWidth = 4; x.strokeRect(2, 2, 124, 124); x.lineWidth = 2; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 128); x.stroke() } for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(0, i * 25.6); x.lineTo(128, i * 25.6); x.stroke() } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
function holeTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(8,5,3,1)'); g.addColorStop(0.62, 'rgba(18,12,7,1)'); g.addColorStop(0.8, 'rgba(60,40,22,0.85)'); g.addColorStop(1, 'rgba(70,50,30,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
function box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m }
function paint(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g }

// ------------------------------------------------------------ 竹
function bambooGeo() {
  const parts = []
  const stalk = new THREE.CylinderGeometry(0.06, 0.075, 9, 7, 9); stalk.translate(0, 4.5, 0)
  const p = stalk.attributes.position, col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), node = Math.abs(((y + 0.25) % 1.0) - 0.5) < 0.04 ? 0.7 : 1; const k = 0.85 + 0.15 * Math.sin(y * 0.7); col.set([0.36 * k * node, 0.55 * k * node, 0.22 * k * node], i * 3) }
  stalk.setAttribute('color', new THREE.BufferAttribute(col, 3)); stalk.deleteAttribute('uv'); parts.push(stalk)
  const R = rng(4)
  for (let i = 0; i < 9; i++) {
    const y = 4.5 + i * 0.55 + R() * 0.3, a = R() * 6.28, l = new THREE.IcosahedronGeometry(0.55 + R() * 0.35, 0)
    l.scale(1.4, 0.35, 0.7); l.rotateY(a); l.translate(Math.cos(a) * 0.55, y, Math.sin(a) * 0.55)
    paint(l, [0.28 + R() * 0.08, 0.48 + R() * 0.1, 0.16]); parts.push(l)
  }
  const g = mergeGeometries(parts.map(q => q.index ? q.toNonIndexed() : q)); g.computeVertexNormals(); return g
}
// 紅葉の木（もみじ・いちょう）
function momijiGeo(seed) {
  const R = rng(seed), parts = []
  const trunk = new THREE.CylinderGeometry(0.1, 0.18, 2.4, 6); trunk.translate(0, 1.2, 0); paint(trunk, [0.32, 0.22, 0.16]); parts.push(trunk)
  const pal = [[0.78, 0.22, 0.12], [0.86, 0.42, 0.12], [0.9, 0.62, 0.15], [0.62, 0.14, 0.1], [0.55, 0.55, 0.18]]
  for (let i = 0; i < 9; i++) {
    const a = R() * 6.28, rr = R() * 1.0, b = new THREE.IcosahedronGeometry(0.75 + R() * 0.5, 1)
    const pp = b.attributes.position; for (let k = 0; k < pp.count; k++) { const s = 1 + (R() - 0.5) * 0.25; pp.setXYZ(k, pp.getX(k) * s, pp.getY(k) * s * 0.8, pp.getZ(k) * s) }
    b.translate(Math.cos(a) * rr, 2.4 + R() * 1.4, Math.sin(a) * rr)
    const c = pal[Math.floor(R() * (seed % 3 === 0 ? 5 : 3))]; paint(b, c.map(v => v * (0.85 + R() * 0.25))); parts.push(b)
  }
  const g = mergeGeometries(parts.map(q => q.index ? q.toNonIndexed() : q)); g.computeVertexNormals(); return g
}
// 稲（2枚の板を十字に組んだ株）
function riceTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); const R = rng(2)
  for (let i = 0; i < 14; i++) { const bx = 10 + R() * 44, top = 18 + R() * 30; x.strokeStyle = `rgb(${150 + R() * 40 | 0},${140 + R() * 30 | 0},${50 + R() * 20 | 0})`; x.lineWidth = 2; x.beginPath(); x.moveTo(32 + (R() - 0.5) * 8, 128); x.quadraticCurveTo(bx, 70, bx + (R() - 0.5) * 20, top); x.stroke()
    // 垂れた穂
    x.fillStyle = `rgb(${215 + R() * 30 | 0},${170 + R() * 30 | 0},${60 + R() * 20 | 0})`; for (let k = 0; k < 6; k++) { x.beginPath(); x.ellipse(bx + (R() - 0.5) * 20 + k * 1.5, top + k * 4, 2.2, 3.2, 0.4, 0, 7); x.fill() } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function tuftTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); const R = rng(3)
  for (let i = 0; i < 22; i++) { x.strokeStyle = `rgb(${70 + R() * 50 | 0},${110 + R() * 40 | 0},${40 + R() * 20 | 0})`; x.lineWidth = 1.6; x.beginPath(); const bx = 20 + R() * 24; x.moveTo(bx, 64); x.quadraticCurveTo(bx + (R() - 0.5) * 10, 40, bx + (R() - 0.5) * 30, 10 + R() * 30); x.stroke() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function crossGeo(w, h) { const a = new THREE.PlaneGeometry(w, h); a.translate(0, h / 2, 0); const b = a.clone(); b.rotateY(Math.PI / 2); const g = mergeGeometries([a, b]); return g }
function rockGeo(seed, r) {
  let g = new THREE.IcosahedronGeometry(1, 2); g.deleteAttribute('uv'); g = mergeVertices(g); const p = g.attributes.position, R = rng(seed)
  const amp = [R(), R(), R()]
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 1 + 0.2 * Math.sin(v.x * 3.1 + amp[0] * 6) * Math.cos(v.y * 2.7 + amp[1] * 6) + 0.1 * Math.sin(v.z * 5 + amp[2] * 6); v.multiplyScalar(n); v.y *= 0.7; p.setXYZ(i, v.x * r, v.y * r, v.z * r) }
  g.computeVertexNormals()
  const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i)) * 0.5; uv[i * 2 + 1] = p.getY(i) * 0.5 } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}
function inst(scene, geo, mat, list, { shadow = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler()
  list.forEach((it, i) => { p.set(it.x, it.y, it.z); e.set(it.rx || 0, it.ry || 0, it.rz || 0); q.setFromEuler(e); s.setScalar(it.s || 1); if (it.sy) s.y = it.sy; m4.compose(p, q, s); im.setMatrixAt(i, m4); if (it.c && im.setColorAt) im.setColorAt(i, it.c) })
  im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im
}

// ------------------------------------------------------------ 世界を組む
export function buildWorld(scene) {
  mats()
  const W = { holes: [], mice: [], objs: {} }
  W.terrain = buildTerrain(scene, W.tmat = terrainMaterial())
  const R = rng(11)
  // 竹林・紅葉・草むら
  const bam = [], mom = [[], [], []], tuft = [], rice = []
  for (let s = -30; s < L; s += 1.1) {
    const sec = sectionAt(s), w = widths(s), c = cx(s)
    for (const side of [-1, 1]) {
      const edge = w.flat + 0.9
      if (sec === 'take' || (sec === 'hata' && s > 40) || (sec === 'tanbo' && s < 206)) { for (let k = 0; k < 3; k++) { if (R() < 0.75) { const u = side * (edge + 0.3 + R() * 9), x = c + u; bam.push({ x, y: height(x, s) - 0.2, z: s + R(), ry: R() * 6, rz: (R() - 0.5) * 0.12, rx: (R() - 0.5) * 0.12, s: 0.8 + R() * 0.45 }) } } }
      else if (sec !== 'ie' || s < 575) { if (R() < 0.42) { const u = side * (edge + 1 + R() * 8), x = c + u; mom[Math.floor(R() * 3)].push({ x, y: height(x, s) - 0.1, z: s + R(), ry: R() * 6, s: 0.8 + R() * 0.5 }) } }
      // 道ばたの草
      if (R() < 0.8) { const u = side * (w.road + 0.15 + R() * 0.7), x = c + u; if (sectionAt(s) !== 'tanbo') tuft.push({ x, y: height(x, s), z: s + R(), ry: R() * 6, s: 0.6 + R() * 0.6 }) }
    }
    // 田んぼの稲（道の両わき）
    if (w.tan > 0.6) for (let u = w.road + 0.5; u < w.flat - 0.2; u += 0.85) for (const side of [-1, 1]) { if (R() < 0.15) continue; const x = c + side * (u + (R() - 0.5) * 0.3); rice.push({ x, y: height(x, s) - 0.02, z: s + (R() - 0.5) * 0.4, ry: R() * 6, s: 0.8 + R() * 0.35 }) }
  }
  const bmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })
  W.bamboo = inst(scene, bambooGeo(), bmat, bam)
  const mmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  mom.forEach((l, i) => { if (l.length) inst(scene, momijiGeo(3 + i * 7), mmat, l) })
  const tmat = new THREE.MeshStandardMaterial({ map: tuftTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 })
  inst(scene, crossGeo(0.7, 0.55), tmat, tuft, { shadow: false })
  const rmat = new THREE.MeshStandardMaterial({ map: riceTex(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9 })
  W.rice = inst(scene, crossGeo(0.75, 1.05), rmat, rice, { shadow: false })
  // 田んぼの畦（あぜ）の線
  { const pts = []; for (let s = 214; s < 312; s += 14) { const w = widths(s); for (const side of [-1, 1]) for (let u = w.road + 0.3; u < w.flat; u += 0.6) { const x = cx(s) + side * u; pts.push({ x, y: height(x, s) + 0.02, z: s, s: 1 }) } } inst(scene, new THREE.BoxGeometry(0.6, 0.12, 0.35), new THREE.MeshStandardMaterial({ map: tx('dirt_diff', 0.3), color: 0x9a8060, roughness: 1 }), pts, { shadow: false }) }
  // 当たる物
  const rockMat = M.stone
  for (const o of OBJ) {
    if (o.kind === 'rock') { const m = new THREE.Mesh(rockGeo(o.i + 3, o.r * 1.15), rockMat); m.position.set(o.x, height(o.x, o.z) + o.r * 0.25, o.z); m.rotation.y = o.yaw; m.castShadow = m.receiveShadow = true; scene.add(m); W.objs[o.i] = m }
    else if (o.kind === 'kakashi') { const g = makeKakashi(); g.position.set(o.x, height(o.x, o.z), o.z); g.rotation.y = Math.PI + (R() - 0.5) * 0.5; scene.add(g); W.objs[o.i] = g }
    else if (o.kind === 'jizo') { const g = makeJizo(o.n); g.position.set(o.x, height(o.x, o.z), o.z); g.rotation.y = Math.PI / 2 + 0.2; scene.add(g) }
  }
  // 山の畑（スタート）: 切り株・ふろしき・大根の畝
  { const c = cx(-3.5)
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.45, 12), M.woodDark); stump.position.set(c + 1.6, height(c + 1.6, -4.5) + 0.22, -4.5); stump.castShadow = true; scene.add(stump); W.stump = stump
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshStandardMaterial({ color: 0xc9a36a, roughness: 0.9 })); top.rotation.x = -Math.PI / 2; top.position.set(0, 0.226, 0); stump.add(top)
    const furo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshStandardMaterial({ map: furoshikiTex(), roughness: 0.9 })); furo.scale.set(1, 0.6, 1); furo.position.set(0.15, 0.3, 0.12); stump.add(furo)
    const hoe = box(0.05, 1.3, 0.05, M.woodDark); hoe.position.set(c + 2.5, height(c + 2.5, -5.2) + 0.6, -5.2); hoe.rotation.z = 0.3; scene.add(hoe)
    const leaf = new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.8 }), row = []
    for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) { const x = c - 6.5 - r * 1.2, z = -6 + k * 1.4; row.push({ x, y: height(x, z), z, ry: k, s: 0.8 + (k % 3) * 0.1 }) }
    const lg = new THREE.ConeGeometry(0.22, 0.45, 5); lg.translate(0, 0.22, 0); inst(scene, lg, leaf, row)
  }
  // ふもとの家
  W.house = makeFarmhouse(); W.house.position.set(YARD.house.x, height(YARD.house.x, YARD.house.z), YARD.house.z); scene.add(W.house)
  // ねずみの里の入口の看板（大きい穴の手前）
  W.signs = []
  return W
}
function furoshikiTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#2f6b4a'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#e9e2c8'; x.lineWidth = 3; for (let i = -64; i < 128; i += 12) { x.beginPath(); x.arc(i, 32, 10, 0, Math.PI); x.stroke() } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
function makeKakashi() {
  const g = new THREE.Group()
  const pole = box(0.07, 1.7, 0.07, M.woodDark); pole.position.y = 0.85; g.add(pole)
  const arm = box(1.3, 0.06, 0.06, M.woodDark); arm.position.y = 1.25; g.add(arm)
  const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x5a6f8f, roughness: 0.95 })); shirt.position.y = 1.05; shirt.castShadow = true; g.add(shirt)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: 0.9 })); head.position.y = 1.55; g.add(head)
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.22, 14), M.straw); hat.position.y = 1.72; hat.castShadow = true; g.add(hat)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshBasicMaterial({ map: kakashiFace(), transparent: true })); face.position.set(0, 1.56, 0.2); g.add(face)
  return g
}
function kakashiFace() { const c = document.createElement('canvas'); c.width = 64; c.height = 40; const x = c.getContext('2d'); x.strokeStyle = '#222'; x.lineWidth = 3; x.beginPath(); x.moveTo(12, 14); x.lineTo(24, 14); x.moveTo(40, 14); x.lineTo(52, 14); x.moveTo(22, 30); x.quadraticCurveTo(32, 36, 42, 30); x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
function makeJizo(n) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.28, 4, 10), M.stone); body.position.y = 0.3; body.castShadow = true; g.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), M.stone); head.position.y = 0.66; g.add(head)
  const bib = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.2, 10, 1, true, -1.2, 2.4), new THREE.MeshStandardMaterial({ color: 0xc23a2b, roughness: 0.8, side: THREE.DoubleSide })); bib.position.y = 0.45; g.add(bib)
  if (n === 5) { const hat = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.14, 12), M.straw); hat.position.y = 0.8; g.add(hat) }
  return g
}
function makeFarmhouse() {
  const g = new THREE.Group(), w = 9, d = 6, h = 2.6
  const base = box(w + 0.2, 0.5, d + 0.2, M.stone); base.position.y = 0.25; g.add(base)
  const wall = box(w, h, d, M.plaster); wall.position.y = 0.5 + h / 2; g.add(wall)
  for (const x of [-w / 2 + 0.1, -w / 6, w / 6, w / 2 - 0.1]) { const b = box(0.18, h, d + 0.04, M.woodDark); b.position.set(x, 0.5 + h / 2, 0); g.add(b) }
  // 障子と縁側（正面 = +z 側。家ごと回すので、道から見えるのは -z 側）
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.9), M.shoji); s.position.set(-w / 2 + 0.95 + i * 1.42, 0.5 + 1.05, -d / 2 - 0.02); s.rotation.y = Math.PI; g.add(s) }
  const deck = box(w, 0.12, 1.1, M.wood); deck.position.set(0, 0.62, -d / 2 - 0.6); g.add(deck)
  // 茅葺きの屋根（寄棟）
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), M.thatch); roof.rotation.y = Math.PI / 4; roof.scale.set((w + 2.4) / 1.414, 3.4, (d + 2.4) / 1.414); roof.position.y = 0.5 + h + 1.65; roof.castShadow = true; g.add(roof)
  const ridge = box(3.2, 0.35, 0.5, M.woodDark); ridge.position.y = 0.5 + h + 3.25; g.add(ridge)
  return g
}

// ------------------------------------------------------------ 穴とねずみ
export function makeMouse(o = {}) {
  const g = new THREE.Group()
  const fur = new THREE.MeshStandardMaterial({ color: o.col || 0x9a8a80, roughness: 0.9 })
  const pink = new THREE.MeshStandardMaterial({ color: 0xe8a0a0, roughness: 0.7 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), fur); body.scale.set(1, 1.15, 0.95); body.position.y = 0.11; g.add(body)
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ color: 0xe9ddd0, roughness: 0.9 })); belly.position.set(0, 0.1, 0.06); g.add(belly)
  const head = new THREE.Group(); head.position.y = 0.27; g.add(head)
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), fur); hm.scale.set(1, 0.92, 1.05); head.add(hm)
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 10), fur); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.02, 0.1); head.add(snout)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), pink); nose.position.set(0, -0.02, 0.145); head.add(nose)
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(s * 0.075, 0.08, -0.01); head.add(ear)
    const eo = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), fur); eo.material = fur.clone(); eo.material.side = THREE.DoubleSide; ear.add(eo)
    const ei = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), pink); ei.material = pink.clone(); ei.material.side = THREE.DoubleSide; ei.position.z = 0.003; ear.add(ei)
    ear.rotation.z = -s * 0.3
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), dark); eye.position.set(s * 0.04, 0.015, 0.08); head.add(eye)
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.07, 3, 6), fur); arm.position.set(s * 0.1, 0.16, 0.03); arm.rotation.z = s * 0.6; g.add(arm)
    g.userData['arm' + (s < 0 ? 'L' : 'R')] = arm; g.userData['ear' + (s < 0 ? 'L' : 'R')] = ear
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 4, 12, Math.PI * 1.2), pink); tail.position.set(0, 0.06, -0.12); tail.rotation.y = Math.PI / 2; g.add(tail)
  if (o.band) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 6, 16), new THREE.MeshStandardMaterial({ color: 0xc23a2b })); b.rotation.x = Math.PI / 2 - 0.2; b.position.y = 0.04; head.add(b) }
  g.userData.head = head
  g.traverse(n => { if (n.isMesh) n.castShadow = true })
  return g
}
// 穴: 黒い円・土の盛り上がり・ふちのねずみ
export function makeHole(scene, h) {
  const y = height(h.x, h.z)
  const g = new THREE.Group(); g.position.set(h.x, y, h.z); scene.add(g)
  const disk = new THREE.Mesh(new THREE.CircleGeometry(h.hr * 1.18, 28), M.holeIn); disk.rotation.x = -Math.PI / 2; disk.position.y = 0.02; disk.renderOrder = 2; g.add(disk)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(h.hr * 1.08, Math.max(0.05, h.hr * 0.22), 6, 24), M.mound); ring.rotation.x = -Math.PI / 2; ring.scale.z = 0.45; ring.position.y = 0.0; ring.receiveShadow = true; g.add(ring)
  const ms = h.hr / HOLE.mid
  const mouse = makeMouse({ band: h.size === 'big' }); mouse.scale.setScalar(0.85 + ms * 0.4)
  const ang = Math.PI + (h.i % 3 - 1) * 0.6
  mouse.position.set(Math.sin(ang) * h.hr * 0.55, -0.25, Math.cos(ang) * h.hr * 0.55); mouse.rotation.y = ang + Math.PI
  g.add(mouse)
  // 大きい穴には「ねずみの国」の立て札
  let sign = null
  if (h.size === 'big') { sign = makeTag('ねずみのくに'); sign.position.set(h.hr * 1.35, 0, h.hr * 0.6); sign.rotation.y = Math.PI - 0.3; g.add(sign) }
  const H = { h, g, disk, ring, mouse, sign, mood: 0, pop: 0, open: h.t0 <= 0 ? 1 : 0, ph: h.i * 1.7 }
  if (!H.open) { g.scale.setScalar(0.001) }
  return H
}
function makeTag(text) {
  const g = new THREE.Group()
  const post = box(0.04, 0.5, 0.04, M.woodDark); post.position.y = 0.25; g.add(post)
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#e2cfa6'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#3a2412'; x.font = '700 40px "Zen Kurenaido", "Zen Kaku Gothic New", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 34)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  const b = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.14), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 })); b.position.y = 0.5; g.add(b)
  return g
}

// ------------------------------------------------------------ おむすび（丸い三角を横に転がす）
// コアの三角の外接円の半径 c、角の丸み rr。地面から中心までの高さは、向きで rr+0.5c 〜 rr+c
const RR = 0.45
export function onigiriDims(r) { const c = r / (RR + 0.8); return { c, rr: c * RR } }
export function supportH(r, ang) { const { c, rr } = onigiriDims(r); let m = -1; for (let k = 0; k < 3; k++) m = Math.max(m, -Math.cos(ang + k * 2.0944)); return rr + c * m }
function riceGrainTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const R = rng(6)
  x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) { const px = R() * 256, py = R() * 256, a = R() * 3.14; x.save(); x.translate(px, py); x.rotate(a); const g = x.createLinearGradient(-6, -3, 6, 3); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9d3c4'); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 6.5, 3.2, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(150,140,120,0.35)'; x.lineWidth = 0.8; x.stroke(); x.restore() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t
}
function riceBump() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const R = rng(6)
  x.fillStyle = '#555'; x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) { const px = R() * 256, py = R() * 256, a = R() * 3.14; x.save(); x.translate(px, py); x.rotate(a); const g = x.createRadialGradient(0, 0, 0, 0, 0, 6); g.addColorStop(0, '#fff'); g.addColorStop(1, '#555'); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 6.5, 3.2, 0, 0, 7); x.fill(); x.restore() }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t
}
function roundedTri(c, rr) {
  const s = new THREE.Shape()
  // 角を中心にした半径 rr の円の外側をつないだ形
  const V = [0, 1, 2].map(k => { const a = Math.PI / 2 + k * 2.0944; return [Math.cos(a) * c, Math.sin(a) * c] })
  for (let k = 0; k < 3; k++) {
    const [vx, vy] = V[k], a0 = Math.PI / 2 + k * 2.0944 - 1.0472, a1 = a0 + 2.0944
    for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10, px = vx + Math.cos(a) * rr, py = vy + Math.sin(a) * rr; if (k === 0 && i === 0) s.moveTo(px, py); else s.lineTo(px, py) }
  }
  s.closePath(); return s
}
export function makeOnigiri() {
  // 大きさ 1 で作って、全体の scale で r に合わせる（r = 1）
  const { c, rr } = onigiriDims(1), th = 0.9
  const shape = roundedTri(c, rr)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.14, bevelSegments: 4, curveSegments: 12 })
  geo.translate(0, 0, -th / 2); geo.rotateY(Math.PI / 2) // 三角の面が左右（±x）を向く
  geo.computeVertexNormals()
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getZ(i) + p.getX(i) * 0.7) * 0.9; uv[i * 2 + 1] = (p.getY(i) + p.getX(i) * 0.3) * 0.9 }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  const mat = new THREE.MeshStandardMaterial({ map: riceGrainTex(), bumpMap: riceBump(), bumpScale: 2.2, roughness: 0.62, color: 0xffffff })
  mat.userData.u = { mud: { value: 0 } }
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, mat.userData.u); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float mud;').replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(vec3(1.0), vec3(0.72, 0.6, 0.45), mud);') }
  const rice = new THREE.Mesh(geo, mat); rice.castShadow = true; rice.receiveShadow = true
  // のり: 下の辺に巻く帯（三角の下の辺の真ん中あたり）
  const nshape = new THREE.Shape(); const w = c * 0.95, y0 = -c * 0.5 - rr - 0.02, y1 = y0 + c * 0.75
  nshape.moveTo(-w * 0.55, y0); nshape.lineTo(w * 0.55, y0); nshape.lineTo(w * 0.42, y1); nshape.lineTo(-w * 0.42, y1); nshape.closePath()
  const ng = new THREE.ExtrudeGeometry(nshape, { depth: th + 0.34, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 1 })
  ng.translate(0, 0, -(th + 0.34) / 2); ng.rotateY(Math.PI / 2)
  const nori = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ color: 0x1b2418, roughness: 0.45, metalness: 0.05, map: noriTex() })); nori.castShadow = true
  const spin = new THREE.Group(); spin.add(rice, nori)
  const root = new THREE.Group(); root.add(spin)
  // 顔（三角の面に。結果画面とタイトルで見せる）
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ map: faceTex('calm'), transparent: true, depthWrite: false }))
  face.position.set(th / 2 + 0.17, c * 0.15, 0); face.rotation.y = Math.PI / 2; spin.add(face)
  const face2 = face.clone(); face2.material = face.material; face2.position.x = -face.position.x; face2.rotation.y = -Math.PI / 2; spin.add(face2)
  root.userData = { spin, rice, nori, mat, face, face2 }
  root.setFace = k => { const t = faceTex(k); face.material.map = t; face.material.needsUpdate = true }
  return root
}
function noriTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#556a4a'; x.fillRect(0, 0, 64, 64); const R = rng(8); for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(${20 + R() * 40 | 0},${40 + R() * 40 | 0},${20 + R() * 30 | 0},0.5)`; x.fillRect(R() * 64, R() * 64, 3, 1) } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
const FACES = {}
export function faceTex(k) {
  if (FACES[k]) return FACES[k]
  const c = document.createElement('canvas'); c.width = 192; c.height = 128; const x = c.getContext('2d')
  x.strokeStyle = '#1d1712'; x.fillStyle = '#1d1712'; x.lineWidth = 7; x.lineCap = 'round'
  const eye = (cx0, open) => { if (open === 'dot') { x.beginPath(); x.ellipse(cx0, 52, 8, 11, 0, 0, 7); x.fill() } else if (open === 'x') { x.beginPath(); x.moveTo(cx0 - 9, 43); x.lineTo(cx0 + 9, 61); x.moveTo(cx0 + 9, 43); x.lineTo(cx0 - 9, 61); x.stroke() } else if (open === 'big') { x.beginPath(); x.arc(cx0, 52, 13, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx0 + 4, 47, 4, 0, 7); x.fill(); x.fillStyle = '#1d1712' } else { x.beginPath(); x.arc(cx0, 56, 10, Math.PI * 1.1, Math.PI * 1.9); x.stroke() } }
  if (k === 'calm') { eye(66, 'dot'); eye(126, 'dot'); x.beginPath(); x.arc(96, 78, 12, 0.2, Math.PI - 0.2); x.stroke() }
  else if (k === 'scared') { eye(66, 'big'); eye(126, 'big'); x.beginPath(); x.ellipse(96, 92, 9, 13, 0, 0, 7); x.fill(); x.fillStyle = '#7fb6e8'; x.beginPath(); x.ellipse(160, 40, 7, 12, 0.2, 0, 7); x.fill() }
  else if (k === 'happy') { eye(66, 'arc'); eye(126, 'arc'); x.beginPath(); x.arc(96, 76, 16, 0.1, Math.PI - 0.1); x.fill(); x.fillStyle = 'rgba(230,110,110,0.45)'; x.beginPath(); x.arc(40, 80, 13, 0, 7); x.arc(152, 80, 13, 0, 7); x.fill() }
  else if (k === 'dizzy') { eye(66, 'x'); eye(126, 'x'); x.beginPath(); x.moveTo(80, 90); x.quadraticCurveTo(96, 80, 112, 90); x.stroke() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; FACES[k] = t; return t
}

// ------------------------------------------------------------ 粒（土ぼこり・米粒・泥・落ち葉）
export function makeParticles(scene, n = 700) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1))
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { scale: { value: 600 } },
    vertexShader: 'attribute float size; attribute float alpha; varying float vA; varying vec3 vC; uniform float scale; void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = smoothstep(0.5, 0.15, r) * vA; gl_FragColor = vec4(vC, a); }',
  })
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts)
  const P = { pts, n, pos, col, size, alpha, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), s0: new Float32Array(n), drag: new Float32Array(n), grav: new Float32Array(n), grow: new Float32Array(n), i: 0 }
  P.emit = (x, y, z, vx, vy, vz, life, s, c = [1, 1, 1], drag = 1.5, grav = 6, grow = 0.6) => {
    const k = P.i; P.i = (P.i + 1) % n
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; P.vel[k * 3] = vx; P.vel[k * 3 + 1] = vy; P.vel[k * 3 + 2] = vz
    P.life[k] = life; P.max[k] = life; P.s0[k] = s; P.drag[k] = drag; P.grav[k] = grav; P.grow[k] = grow; col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2]
  }
  P.update = dt => {
    for (let k = 0; k < n; k++) {
      if (P.life[k] <= 0) { alpha[k] = 0; continue }
      P.life[k] -= dt; const t = P.life[k] / P.max[k]
      const d = Math.exp(-P.drag[k] * dt)
      P.vel[k * 3] *= d; P.vel[k * 3 + 2] *= d; P.vel[k * 3 + 1] = P.vel[k * 3 + 1] * d - P.grav[k] * dt
      pos[k * 3] += P.vel[k * 3] * dt; pos[k * 3 + 1] += P.vel[k * 3 + 1] * dt; pos[k * 3 + 2] += P.vel[k * 3 + 2] * dt
      size[k] = P.s0[k] * (1 + P.grow[k] * (1 - t)); alpha[k] = Math.min(1, t * 2.5) * 0.9
    }
    g.attributes.position.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.color.needsUpdate = true
  }
  return P
}
// 舞う落ち葉（板）
export function makeLeaves(scene, n = 60) {
  const geo = new THREE.PlaneGeometry(0.16, 0.12)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 })
  const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; scene.add(im)
  const pal = [0xc4422a, 0xd8742a, 0xe0a83a, 0xa83224], col = new THREE.Color()
  const L2 = []; for (let i = 0; i < n; i++) { L2.push({ x: 0, y: -100, z: 0, vy: 0, a: Math.random() * 6, w: 1 + Math.random() * 2, ph: Math.random() * 6 }); col.setHex(pal[i % 4]); im.setColorAt(i, col) }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1)
  return {
    update(dt, cxp, cz, on) {
      for (let i = 0; i < n; i++) {
        const f = L2[i]
        if (f.y < height(f.x, f.z) || Math.abs(f.z - cz) > 30) { if (!on) { f.y = -100; continue } f.x = cxp + (Math.random() - 0.5) * 22; f.z = cz + 4 + Math.random() * 24; f.y = height(f.x, f.z) + 3 + Math.random() * 5 }
        f.ph += dt * f.w; f.y -= dt * 0.9; f.x += Math.sin(f.ph) * dt * 0.8
        p.set(f.x, f.y, f.z); e.set(f.ph, f.a + f.ph * 0.5, Math.sin(f.ph) * 0.8); q.setFromEuler(e); m4.compose(p, q, s); im.setMatrixAt(i, m4)
      }
      im.instanceMatrix.needsUpdate = true
    },
  }
}
