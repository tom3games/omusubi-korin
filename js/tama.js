// 結末のあとの「つづら」と、中に入っている物（2026-11-20 本人「宝が出てくるところも見せて。何が出るかはランダムで、クスッと笑えるように」）
// 中身は data.js の TAMA。形はここで箱と球だけで組む（絵を読まない＝読み込みを増やさない）
import * as THREE from 'three'

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o })
function weaveTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')
  x.fillStyle = '#8a6a3c'; x.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 128; i += 8) for (let j = 0; j < 128; j += 8) { x.fillStyle = (i + j) % 16 ? '#a07c46' : '#6e5230'; x.fillRect(i, j, 8, 4) }
  x.strokeStyle = 'rgba(40,25,10,.45)'; x.lineWidth = 1; for (let i = 0; i < 128; i += 8) { x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke() }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.4); t.colorSpace = THREE.SRGBColorSpace; return t
}
let WEAVE = null

// つづら: 本体と、うしろの縁を軸に開くふた。g.userData.lid を回して開ける
export function makeTsuzura() {
  WEAVE ??= weaveTex()
  const g = new THREE.Group(), W = 0.62, H = 0.34, D = 0.44
  const m = std(0xffffff, { map: WEAVE, roughness: 0.9 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), m); body.position.y = H / 2; g.add(body)
  const inside = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.01, D - 0.04), std(0x2a1c10)); inside.position.y = H - 0.02; g.add(inside)
  const lid = new THREE.Group(); lid.position.set(0, H, -D / 2); g.add(lid)
  const lm = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, 0.09, D + 0.05), m); lm.position.set(0, 0.03, D / 2); lid.add(lm)
  // 赤いひも（ふたに十字）
  const red = std(0xb8382a, { roughness: 0.6 })
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(W + 0.07, 0.095, 0.035), red); c1.position.set(0, 0.03, D / 2); lid.add(c1)
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.095, D + 0.07), red); c2.position.set(0, 0.03, D / 2); lid.add(c2)
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), red); knot.position.set(0, 0.09, D / 2); lid.add(knot)
  g.userData.lid = lid; g.userData.H = H
  g.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true } })
  return g
}

function paperTex(lines, opt = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const x = c.getContext('2d')
  x.fillStyle = opt.bg || '#f4ecd8'; x.fillRect(0, 0, 256, 320)
  x.fillStyle = opt.ink || '#2a2320'; x.textAlign = 'center'; x.textBaseline = 'middle'
  lines.forEach((l, i) => { x.font = `${l[1] || 40}px "Zen Antique","Zen Kurenaido",serif`; x.fillText(l[0], 128, l[2] ?? 70 + i * 70) })
  if (opt.seal) { x.strokeStyle = '#c23a2b'; x.lineWidth = 6; x.beginPath(); x.arc(190, 255, 34, 0, 7); x.stroke(); x.fillStyle = '#c23a2b'; x.font = '30px serif'; x.fillText(opt.seal, 190, 256) }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
const sheet = (tex, w = 0.36, h = 0.45) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 })); return m }

// 中身の形。shape は data.js の TAMA の shape
export function makeItem(shape, ja = true) {
  const g = new THREE.Group()
  const gold = std(0xe2b33c, { metalness: 0.75, roughness: 0.3, emissive: 0x3a2800 })
  if (shape === 'koban') { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 28), gold); k.scale.z = 0.62; k.rotation.x = Math.PI / 2; g.add(k); const bite = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), std(0x4a2a14)); bite.rotation.x = Math.PI / 2; bite.position.set(0.12, 0.05, 0); g.add(bite) }
  else if (shape === 'bill') g.add(sheet(paperTex(ja ? [['請求書', 52, 60], ['穴の修理代', 34, 140], ['三文', 46, 200]] : [['INVOICE', 46, 60], ['Hole repair', 32, 140], ['3 coins', 40, 200]], { seal: ja ? '鼠' : 'M' })))
  else if (shape === 'grain') { const r = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), std(0xfbf8ef, { roughness: 0.4 })); r.scale.set(0.7, 1.3, 0.7); g.add(r); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 6, 30), std(0xffe9a0, { emissive: 0x806020 })); g.add(ring) }
  else if (shape === 'card') { const t = paperTex(ja ? [['ねずみ堂', 44, 50], ['ポイントカード', 30, 100]] : [['MOUSE MART', 34, 50], ['Point card', 30, 100]], { bg: '#f7e3c8' }); const cx = t.image.getContext('2d'); for (let i = 0; i < 10; i++) { const px = 40 + (i % 5) * 44, py = 170 + Math.floor(i / 5) * 60; cx.strokeStyle = '#8a6a50'; cx.lineWidth = 3; cx.beginPath(); cx.arc(px, py, 17, 0, 7); cx.stroke(); if (!i) { cx.fillStyle = '#c23a2b'; cx.fill() } } t.needsUpdate = true; const s = sheet(t, 0.42, 0.3); g.add(s) }
  else if (shape === 'photo') { const t = paperTex([], { bg: '#e9e0cc' }); const cx = t.image.getContext('2d'); cx.fillStyle = '#7a8a9a'; cx.fillRect(20, 20, 216, 200); for (let i = 0; i < 5; i++) { const px = 50 + i * 40, py = 150; cx.fillStyle = '#9a8a80'; cx.beginPath(); cx.arc(px, py, 22, 0, 7); cx.fill(); cx.beginPath(); cx.arc(px - 14, py - 20, 10, 0, 7); cx.arc(px + 14, py - 20, 10, 0, 7); cx.fill(); cx.fillStyle = '#111'; cx.fillRect(px - 8, py - 4, 4, 4); cx.fillRect(px + 4, py - 4, 4, 4) } cx.strokeStyle = '#1a1a40'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(60, 270); cx.bezierCurveTo(100, 240, 130, 300, 200, 262); cx.stroke(); t.needsUpdate = true; g.add(sheet(t, 0.38, 0.47)) }
  else if (shape === 'mold') { const m = std(0xc9a26a); for (let k = 0; k < 3; k++) { const a = k * 2.0944, b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), m); b.position.set(Math.cos(a + Math.PI / 2) * 0.087, Math.sin(a + Math.PI / 2) * 0.087, 0); b.rotation.z = a; g.add(b) } }
  else if (shape === 'mallet') { const w = std(0x9a6a3a), head = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16), gold); head.rotation.z = Math.PI / 2; head.position.y = 0.14; g.add(head); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.28, 8), w); g.add(h) }
  else if (shape === 'nori') { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.3, 6, 6), new THREE.MeshStandardMaterial({ color: 0x1d2a1a, side: THREE.DoubleSide, roughness: 0.6 })); const p = n.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 18) * 0.03 + Math.cos(p.getY(i) * 15) * 0.02); n.geometry.computeVertexNormals(); g.add(n) }
  else if (shape === 'box') { const b = makeTsuzura(); b.scale.setScalar(0.32); b.position.y = -0.05; g.add(b) }
  else if (shape === 'ume') { const u = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), std(0xa8242a, { roughness: 0.55 })); u.scale.set(1, 0.85, 1); const p = u.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const f = 1 + 0.08 * Math.sin(p.getX(i) * 60) * Math.cos(p.getY(i) * 50); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f) } u.geometry.computeVertexNormals(); g.add(u) }
  else if (shape === 'tawara') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 20), gold); b.rotation.z = Math.PI / 2; b.scale.set(1, 1, 1); g.add(b); for (const s of [-1, 0, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.012, 6, 20), std(0xb8382a)); r.rotation.y = Math.PI / 2; r.position.x = s * 0.1; g.add(r) } }
  // 'empty' は何も無い（ほこりだけ game.js で出す）
  g.traverse(n => { if (n.isMesh) n.castShadow = true })
  return g
}
