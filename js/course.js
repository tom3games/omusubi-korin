// コース（three を使わない。ゲームと node の sim の両方で使う）
// 座標: z = s（山の畑 0 → ふもとの家 S_END へ下る距離 m）、x = 左右（cx(s) が道の中心）、y = 高さ
// 2026-11-21 本人「コースをもっと長く」→ 岩場のあとに凸凹の山道（D = 220m）を差し込み、ねずみの里から先を D ずらした
export const D = 220
export const S_END = 600 + D
export const L = 640 + D
// 区間
export const SECTIONS = [
  { id: 'hata', s0: -20, s1: 60 },    // 山の畑（スタート）
  { id: 'take', s0: 60, s1: 200 },    // 竹林
  { id: 'tanbo', s0: 200, s1: 320 },  // 棚田（道の両わきが田んぼ）
  { id: 'iwa', s0: 320, s1: 420 },    // 岩場
  { id: 'deko', s0: 420, s1: 420 + D }, // 凸凹の山道（2026-11-21）
  { id: 'nezumi', s0: 420 + D, s1: 548 + D }, // ねずみの里
  { id: 'ie', s0: 548 + D, s1: 700 + D },     // ふもとの家
]
export function sectionAt(s) { for (const q of SECTIONS) if (s >= q.s0 && s < q.s1) return q.id; return s < 0 ? 'hata' : 'ie' }

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

export function cx(s) {
  const k = 1 - sm(540 + D, 580 + D, s)
  return (6 * Math.sin(s / 70) + 3 * Math.sin(s / 31 + 1)) * k * sm(-10, 20, s) + 2.5 * (1 - k)
}
// 道の半幅（土の道）と、その外の平らな所の半幅（田んぼ・里の草地）
export function widths(s) {
  const tan = sm(196, 212, s) * (1 - sm(312, 326, s))
  const nez = sm(416 + D, 430 + D, s) * (1 - sm(540 + D, 552 + D, s))
  const ie = sm(546 + D, 560 + D, s)
  const road = 2.6 - 0.8 * tan + 0.6 * nez + 0.4 * ie
  const flat = road + 7.0 * tan + 2.2 * nez + 7 * ie
  return { road, flat, tan, nez, ie }
}
// 下りの傾き
const SLOPES = [[0, 0.10], [55, 0.17], [200, 0.085], [320, 0.19], [420, 0.15], [420 + D, 0.12], [548 + D, 0.05], [580 + D, 0.0]]
const YB = new Float32Array(L + 2)
{
  let y = 0
  for (let s = 0; s <= L + 1; s++) {
    let k = 0; while (k + 1 < SLOPES.length && SLOPES[k + 1][0] <= s) k++
    const a = SLOPES[k], b = SLOPES[Math.min(k + 1, SLOPES.length - 1)]
    const t = b === a ? 0 : sm(b[0] - 10, b[0] + 10, s)
    YB[s] = y; y -= a[1] * (1 - t) + b[1] * t
  }
}
export function base(s) {
  if (s <= 0) return 0.10 * -s
  if (s >= L) return YB[L]
  const i = Math.floor(s), f = s - i
  return YB[i] * (1 - f) + YB[i + 1] * f
}
// 路面の高さ
export function height(x, z) {
  const s = clamp(z, -40, L + 40), u = x - cx(s), a = Math.abs(u)
  const w = widths(s)
  let h = base(s)
  // 道はわずかにかまぼこ形。田んぼは道より少し低い
  if (a < w.road) h += 0.04 * (1 - (a / w.road) ** 2)
  else if (a < w.flat) h += -0.22 * w.tan * sm(w.road, w.road + 0.5, a) + 0.02 * w.nez
  else { const e = a - w.flat; h += -0.22 * w.tan + 0.5 * Math.pow(Math.min(e, 6), 1.3) + 0.22 * Math.max(0, e - 6) }
  // 凸凹（道を横切る盛り上がり。2026-11-21 本人「凸凹な道も増やして」）
  if (a < w.road + 0.3) h += bumpH(x, z)
  // スタートの後ろは壁
  if (z < -6) h += 0.5 * Math.pow(-6 - z, 1.3)
  return h
}
// ---------------- 凸凹: 道を横切る盛り上がり（毎回同じ）。u・hw で道の一部だけの物もある（よけられる）
// 速いまま越えると少し跳ねて、着地で少し削れる（phys.js）
export const BUMP = { h: 0.17, w: 0.55 } // 高さ・半分の長さ（前後）
export const BUMPS = []
{
  const R = rng(29)
  const add = (s, full) => {
    const w = widths(s).road
    if (full) BUMPS.push({ z: s, u: 0, hw: w + 0.3, h: BUMP.h * (0.85 + R() * 0.3) })
    else { const hw = w * (0.45 + R() * 0.2), u = (R() < 0.5 ? -1 : 1) * (w - hw); BUMPS.push({ z: s, u, hw, h: BUMP.h * (0.85 + R() * 0.3) }) }
  }
  for (let s = 92; s < 196; s += 22 + R() * 14) add(s, R() < 0.4)          // 竹林: 竹の根（まばら）
  for (let s = 426; s < 420 + D - 6; s += 6.5 + R() * 5) add(s, R() < 0.45) // 凸凹の山道: たくさん
}
export function bumpH(x, z) {
  let h = 0
  for (const b of BUMPS) {
    const dz = z - b.z; if (dz > 1.6 || dz < -1.6) continue
    const u = x - cx(b.z) - b.u, e = Math.abs(u) - b.hw
    const side = e <= 0 ? 1 : Math.max(0, 1 - e / 0.35)
    h += b.h * side * Math.exp(-(dz * dz) / (BUMP.w * BUMP.w))
  }
  return h
}
// 路面の種類: dirt（土の道）/ grass（草の土手）/ paddy（田んぼ）/ meadow（里の草地）/ yard（庭）
export const SURF = {
  dirt: { drag: 0.0 },
  grass: { drag: 0.55 },
  paddy: { drag: 2.4, grow: 1 },
  meadow: { drag: 0.25 },
  yard: { drag: 0.9 },
}
export function surfaceAt(x, z) {
  const s = z, u = Math.abs(x - cx(s)), w = widths(s)
  if (s > 556 + D) return u < w.road ? 'dirt' : 'yard'
  if (u < w.road) return 'dirt'
  if (u < w.flat) return w.tan > 0.5 ? 'paddy' : 'meadow'
  return 'grass'
}

// ---------------- 決まった乱数
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ---------------- 穴の大きさ（半径 m）
export const HOLE = { small: 0.22, mid: 0.34, big: 0.6 } // big は 0.52 → 0.6（2026-11-20 太れば全部の穴を越えられて楽すぎた）
export const START_R = 0.30

// ---------------- 当たる物（毎回同じ）: 岩・かかし・道しるべ・お地蔵さん
// r: 当たりの半径
export const OBJ = []
function put(kind, x, z, r, extra = {}) { const o = { kind, x, z, r, i: OBJ.length, ...extra }; OBJ.push(o); return o }
{
  const R = rng(17)
  // 岩場は岩だらけ
  for (let s = 326; s < 418; s += 3.2 + R() * 3.5) {
    const w = widths(s), u = (R() * 2 - 1) * (w.road - 0.3)
    put('rock', cx(s) + u, s, 0.32 + R() * 0.3, { yaw: R() * 6 })
  }
  // ほかの区間にもぱらぱら
  for (const s of [72, 118, 151, 176, 438 + D, 470 + D, 505 + D, 447, 489, 533, 571, 612]) { const w = widths(s); put('rock', cx(s) + (R() < 0.5 ? -1 : 1) * (w.road - 0.6 - R() * 0.6), s, 0.35 + R() * 0.2, { yaw: R() * 6 }) }
  // 田んぼのかかし（田んぼの中）
  for (const [s, u] of [[226, -4.5], [248, 5.2], [271, -6.0], [293, 4.0]]) put('kakashi', cx(s) + u, s, 0.35, {})
  // お地蔵さん（道の端・6体並び）
  for (let i = 0; i < 6; i++) put('jizo', cx(190) - 3.4 + 0, 186 + i * 1.1, 0.3, { decor: 1, n: i })
}
// 区間の中で、道のどこに穴を置けるか（u の候補）
function slots(s) { const w = widths(s), n = Math.max(3, Math.round(w.road * 2 / 1.1)); const a = []; for (let i = 0; i < n; i++) a.push(-w.road + 0.5 + i * (w.road * 2 - 1.0) / (n - 1)); return a }

// ---------------- 穴の並び（run ごとに seed で変わる。どの列にも必ず通れるすき間を残す）
export function makeHoles(seed) {
  const R = rng(seed * 131 + 7), H = []
  const add = (s, u, size, extra = {}) => { const hr = HOLE[size]; H.push({ x: cx(s) + u, z: s, hr, size, t0: 0, i: H.length, ...extra }) }
  // 最初の1個は真ん中に中くらい（練習）
  add(34, 0, 'mid', { first: 1 })
  const row = (s, nMax, pick) => {
    const sl = slots(s), n = Math.min(sl.length - 1, 1 + Math.floor(R() * nMax))
    // 空ける場所を1つ決め、その両どなりも空ける
    const keep = Math.floor(R() * sl.length), used = new Set([keep, keep - 1, keep + 1])
    const cand = sl.map((u, i) => i).filter(i => !used.has(i))
    for (let k = 0; k < n && cand.length; k++) { const j = Math.floor(R() * cand.length), i = cand.splice(j, 1)[0]; add(s + (R() - 0.5) * 1.2, sl[i] + (R() - 0.5) * 0.3, pick()) }
  }
  const pick = w => () => { const r = R(); let a = 0; for (const [k, p] of w) { a += p; if (r < a) return k } return w[0][0] }
  for (let s = 48; s < 60; s += 9) row(s, 1, pick([['small', 0.5], ['mid', 0.5]]))
  for (let s = 66 + R() * 4; s < 196; s += 9 + R() * 5) row(s, 2, pick([['small', 0.35], ['mid', 0.45], ['big', 0.2]]))
  for (let s = 212 + R() * 3; s < 316; s += 8 + R() * 4) row(s, 2, pick([['mid', 0.5], ['big', 0.5]]))
  for (let s = 330 + R() * 5; s < 416; s += 14 + R() * 6) row(s, 1, pick([['small', 0.4], ['mid', 0.4], ['big', 0.2]]))
  // 凸凹の山道: 穴は少なめ（凸凹と石ころが主役）
  for (let s = 430 + R() * 6; s < 420 + D - 8; s += 15 + R() * 8) row(s, 1, pick([['small', 0.3], ['mid', 0.4], ['big', 0.3]]))
  for (let s = 428 + D + R() * 3; s < 540 + D; s += 9 + R() * 4) row(s, 2, pick([['small', 0.3], ['mid', 0.35], ['big', 0.35]]))
  // 岩・凸凹と重なった穴は外す
  return H.filter(h => !OBJ.some(o => !o.decor && Math.hypot(o.x - h.x, o.z - h.z) < o.r + h.hr + 0.4) && !BUMPS.some(b => Math.abs(b.z - h.z) < 1.4 + h.hr)).map((h, i) => (h.i = i, h))
}
// ねずみが目の前に新しい穴を掘る場所（ねずみの里で 4 回）
export function digPlan(seed) { const R = rng(seed * 37 + 3), a = []; for (let s = 436 + D; s < 530 + D; s += 20 + R() * 10) a.push(+s.toFixed(1)); return a }

// 家と庭（終点）
export const YARD = { z: S_END, house: { x: cx(S_END + 12) + 0.5, z: S_END + 13 } }
