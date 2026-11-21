// 人（Kenney Mini Characters, CC0）。服とひげの色を塗り替え、笠・はちまき・まゆを足す
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'
import { clone as skClone } from '../vendor/jsm/utils/SkeletonUtils.js'

export const KINDS = ['character-male-b', 'character-female-c']
const A = { ready: false, src: {}, clips: null, wait: [] }
export const charAssets = A
export function loadChars(V = '') {
  if (A.loading) return A.loading
  const L = new GLTFLoader()
  A.loading = Promise.all(KINDS.map(k => L.loadAsync('assets/chars/' + k + '.glb' + V).then(g => { A.src[k] = g; if (!A.clips) A.clips = g.animations }).catch(e => console.warn('char', k, e))))
    .then(() => { A.ready = Object.keys(A.src).length > 0; for (const f of A.wait) f(); A.wait = []; return A })
  return A.loading
}
// 色の表（colormap.png）は 32px の帯が並ぶ。帯ごとに塗り替える
// rects: [[x, y, w, h, '#rrggbb'], ...]（512 四方の座標）
const MAPS = {}
function recolored(src, key, rects) {
  if (MAPS[key]) return MAPS[key]
  const img = src.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const x = c.getContext('2d'); x.drawImage(img, 0, 0)
  const k = img.width / 512
  for (const [rx, ry, rw, rh, col] of rects) {
    const d = x.getImageData(rx * k, ry * k, rw * k, rh * k), p = d.data, t = new THREE.Color(col)
    for (let i = 0; i < p.length; i += 4) { const l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255, f = 0.55 + l * 0.75; p[i] = Math.min(255, t.r * 255 * f); p[i + 1] = Math.min(255, t.g * 255 * f); p[i + 2] = Math.min(255, t.b * 255 * f) }
    x.putImageData(d, rx * k, ry * k)
  }
  const tex = new THREE.CanvasTexture(c); tex.flipY = src.flipY; tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = src.magFilter; tex.minFilter = src.minFilter
  MAPS[key] = tex; return tex
}
// 着せ替え
export const LOOKS = {
  kind: { kind: 'character-male-b', recolor: [[256, 256, 64, 128, '#3f5f8f'], [320, 256, 64, 128, '#6b5a48'], [384, 384, 64, 128, '#f1efe9']], beard: 0xf2f0ea, kasa: 1 },
  greedy: { kind: 'character-male-b', recolor: [[256, 256, 64, 128, '#7a5230'], [320, 256, 64, 128, '#3a3030'], [384, 384, 64, 128, '#3a3a3a']], brows: 1, hachimaki: 1 },
  baba: { kind: 'character-female-c', recolor: [[320, 256, 64, 128, '#7a4f6a']] },
  // 通行人（2026-11-20）: 水汲み帰りの人・子ども
  mizu: { kind: 'character-female-c', recolor: [[256, 256, 64, 128, '#4f6f7a'], [320, 256, 64, 128, '#5a4a3a']] },
  kodomo: { kind: 'character-male-b', recolor: [[256, 256, 64, 128, '#c8702a'], [320, 256, 64, 128, '#3a4a6a']] },
  // バットの人（2026-11-21）: 生垣の陰から飛び出す村の若い衆
  batter: { kind: 'character-male-b', recolor: [[256, 256, 64, 128, '#e8e2d2'], [320, 256, 64, 128, '#2e3e5e']], hachimaki: 1, bat: 1 },
}
export class Person {
  constructor(parent, o = {}) {
    this.root = new THREE.Group(); parent.add(this.root)
    this.o = o; this.look = LOOKS[o.look] || {}; this.kind = this.look.kind || o.kind || KINDS[0]; this.anim = o.anim || 'idle'; this.mixer = null; this.act = null; this.model = null
    this.scale = o.scale ?? 1
    const m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 4, 10), m(0x3f5f8f)); body.position.y = 0.42
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), m(0xe9c4a0)); head.position.y = 0.86
    g.add(body, head); g.scale.setScalar(this.scale); this.root.add(g); this.fb = g
    if (A.ready) this.attach(); else A.wait.push(() => this.attach())
  }
  attach() {
    const src = A.src[this.kind] || Object.values(A.src)[0]; if (!src || this.model) return
    const mdl = skClone(src.scene); mdl.scale.setScalar(this.scale)
    const lk = this.look
    mdl.traverse(n => {
      if (!n.isMesh) return
      n.castShadow = true; n.frustumCulled = false; n.material = n.material.clone(); n.material.roughness = 0.85; n.material.metalness = 0
      if (lk.recolor && n.material.map) n.material.map = recolored(n.material.map, this.o.look, lk.recolor)
    })
    const head = mdl.getObjectByName('head'), hm = mdl.getObjectByName('head-mesh')
    if (head && hm) {
      // 頭の大きさを測って、笠・ひげ・まゆ・はちまきを合わせる（頭の骨の座標で）
      mdl.updateMatrixWorld(true)
      const bb = new THREE.Box3().setFromObject(hm), inv = new THREE.Matrix4().copy(head.matrixWorld).invert()
      const lo = bb.min.clone().applyMatrix4(inv), hi = bb.max.clone().applyMatrix4(inv)
      const y0 = Math.min(lo.y, hi.y), y1 = Math.max(lo.y, hi.y), zf = Math.max(lo.z, hi.z), hx = Math.abs(hi.x - lo.x) / 2, hh = y1 - y0
      if (lk.kasa) { const k = new THREE.Mesh(new THREE.ConeGeometry(hx * 1.9, hh * 0.45, 18), new THREE.MeshStandardMaterial({ color: 0xd2b46a, roughness: 0.95 })); k.position.set(0, y1 + hh * 0.12, 0); k.castShadow = true; head.add(k) }
      if (lk.beard) { const bm = new THREE.MeshStandardMaterial({ color: lk.beard, roughness: 1 }); const b = new THREE.Mesh(new THREE.ConeGeometry(hx * 0.55, hh * 0.5, 10), bm); b.rotation.x = Math.PI; b.position.set(0, y0 + hh * 0.05, zf - hx * 0.1); b.scale.z = 0.6; head.add(b) }
      if (lk.brows) { for (const sd of [-1, 1]) { const br = new THREE.Mesh(new THREE.BoxGeometry(hx * 0.42, hh * 0.07, hx * 0.08), new THREE.MeshStandardMaterial({ color: 0x1a1410 })); br.position.set(sd * hx * 0.36, y0 + hh * 0.62, zf + 0.005); br.rotation.z = sd * 0.45; head.add(br) } }
      if (lk.hachimaki) { const band = new THREE.Mesh(new THREE.BoxGeometry(hx * 2.08, hh * 0.13, Math.abs(hi.z - lo.z) * 1.04), new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 1 })); band.position.set(0, y0 + hh * 0.8, (lo.z + hi.z) / 2); head.add(band); const knot = new THREE.Mesh(new THREE.SphereGeometry(hh * 0.09, 8, 6), band.material); knot.position.set(hx * 0.5, y0 + hh * 0.8, Math.min(lo.z, hi.z) - 0.01); head.add(knot) }
    }
    // バット（右腕の骨に持たせる。握りが手、先が前へ）
    const arm = mdl.getObjectByName('arm-right')
    if (lk.bat && arm) {
      const bg = new THREE.CylinderGeometry(0.024, 0.011, 0.36, 10); bg.translate(0, 0.17, 0)
      const bat = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0xc89a5c, roughness: 0.6 })); bat.castShadow = true
      bat.position.set(0, -0.105, 0.01); bat.rotation.x = Math.PI / 2; arm.add(bat); this.bat = bat
    }
    this.root.remove(this.fb); this.root.add(mdl); this.model = mdl
    this.mixer = new THREE.AnimationMixer(mdl)
    this.play(this.anim, true)
  }
  play(name, force, speed = 1) {
    this.anim = name; if (!this.mixer || !A.clips) return
    const cl = A.clips.find(c => c.name === name); if (!cl) return
    const a = this.mixer.clipAction(cl)
    a.timeScale = speed
    if (this.act === a && !force) return
    a.reset(); a.setLoop(/jump|die|pick-up|emote|attack|interact|fall/.test(name) ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = true
    if (this.act) this.act.crossFadeTo(a, 0.15, false)
    a.play(); this.act = a
  }
  update(dt) { if (this.mixer) this.mixer.update(dt) }
}
