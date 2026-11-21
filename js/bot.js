// 自動で遊ぶ（検査と sim と宣伝動画用）。three を使わない
import { OBJ, BUMPS, cx, widths, clamp, rng } from './course.js?v=6'
const ROCKS = OBJ.filter(b => !b.decor)
import { holeOpen } from './phys.js?v=6'

// kind: 'none'（何もしない）/ 'center'（道の真ん中だけ）/ 'human'（人の速さ: 反応が遅れ、狙いがずれる）/ 'good'（上手い）/ 'paddy'（田んぼで太る）
export function makeBot(kind = 'good', seed = 1) {
  const R = rng(seed * 991 + 1)
  const lag = kind === 'human' ? 0.45 + R() * 0.35 : kind === 'center' ? 0.6 : 0.3
  const err = kind === 'human' ? 0.35 : 0.05
  let nextThink = 0, tgtU = 0, fire = false
  return (run) => {
    const o = run.o
    if (kind === 'none') return {}
    if (run.t >= nextThink) {
      nextThink = run.t + lag; fire = true
      if (kind === 'center') tgtU = 0
      else {
        // 前の 2〜11m の穴で、入ってしまう物を避ける位置を探す
        const w = widths(o.z + 6)
        const wantPaddy = kind === 'paddy' && w.tan > 0.5 && o.r < 0.5
        const cands = []
        for (let u = -w.flat + 0.4; u <= w.flat - 0.4; u += 0.25) cands.push(u)
        let best = tgtU, bs = -1e9
        for (const u of cands) {
          let s = -Math.abs(u - (o.x - cx(o.z))) * 0.35
          if (Math.abs(u) > w.road - 0.2) s -= wantPaddy ? -3 : (w.tan > 0.5 ? 2.2 : 4)
          for (const h of run.holes) {
            if (h.z < o.z + 0.5 || h.z > o.z + 12) continue
            if (!holeOpen(run, h) && h.t0 - run.t > 1.2) continue
            const hu = h.x - cx(h.z), d = Math.abs(hu - u)
            if (h.hr > o.r && d < h.hr + 0.55) s -= 20 / (1 + (h.z - o.z) * 0.15)
          }
          for (const b of ROCKS) { if (b.z < o.z + 0.5 || b.z > o.z + 10) continue; const d = Math.abs(b.x - cx(b.z) - u); if (d < b.r + o.r + 0.3) s -= 6 / (1 + (b.z - o.z) * 0.2) }
          // 通行人: 着くころにいる位置を読んでよける
          for (const wk of run.walkers || []) {
            if (wk.st === 'gone' || wk.hit) continue
            const dz = wk.z - o.z; if (dz < -0.3 || dz > 16) continue
            const tt = Math.max(0, dz) / Math.max(3, o.sp), pu = wk.x - cx(wk.z) + (wk.st === 'walk' ? wk.dir * wk.v * tt : 0)
            if (Math.abs(u - pu) < wk.hw + o.r + 0.45) s -= 14 / (1 + Math.max(0, dz) * 0.12)
          }
          // 石ころ: 落ちる所から離れる（上手い・人の速さ。2026-11-21）
          if (kind !== 'center') for (const q of run.pebs || []) { if (q.done) continue; const d = Math.abs(u - (q.x1 - cx(q.z1))); if (d < o.r + 0.5) s -= 8 }
          // いじわるじいさんが構えたら横へ逃げる
          if (run.g.st === 'windup') s += Math.min(3, Math.abs(u - (run.g.aimX - cx(o.z)))) * 3
          if (s > bs) { bs = s; best = u }
        }
        tgtU = best + (R() - 0.5) * 2 * err
      }
    }
    if (!fire) return {}
    fire = false
    const cu = o.x - cx(o.z), want = tgtU - cu
    // 横に動いている分も打ち消す（画面の右 = -x）
    const dcx = (cx(o.z + 1) - cx(o.z - 1)) / 2, latV = (o.vx - dcx * o.vz) / Math.hypot(dcx, 1)
    const lat = clamp(-(want * 0.75 - latV * 0.2), -1, 1)
    const vT = kind === 'paddy' ? 5.5 : kind === 'human' ? 6.8 : 7.6
    // 凸凹の手前（6m 以内に道をふさぐ凸凹）では、はじくのを控えて跳ねないようにする（上手い・田んぼのみ。人の速さは気にしない）
    const slowB = kind !== 'human' && BUMPS.some(b => b.z > o.z && b.z < o.z + 6 && Math.abs(o.x - cx(b.z) - b.u) < b.hw + o.r)
    const push = !slowB && o.sp < vT ? clamp((vT - o.sp) / 3, 0.35, 1) * (1 + (R() - 0.5) * err) : 0
    return { push, lat: Math.abs(lat) > 0.08 ? lat : 0 }
  }
}
