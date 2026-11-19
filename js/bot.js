// 自動で遊ぶ（検査と sim と宣伝動画用）。three を使わない
import { OBJ, cx, widths, clamp, rng } from './course.js?v=1'
const ROCKS = OBJ.filter(b => !b.decor)
import { holeOpen } from './phys.js?v=1'

// kind: 'none'（何もしない）/ 'center'（道の真ん中だけ）/ 'human'（人の速さ: 反応が遅れ、狙いがずれる）/ 'good'（上手い）/ 'paddy'（田んぼで太る）
export function makeBot(kind = 'good', seed = 1) {
  const R = rng(seed * 991 + 1)
  const lag = kind === 'human' ? 0.45 + R() * 0.35 : 0.06
  const err = kind === 'human' ? 0.35 : 0.05
  let target = 0, nextThink = 0, tgtU = 0, dodgeT = 0
  return (run) => {
    const o = run.o
    if (kind === 'none') return { steer: 0 }
    if (run.t >= nextThink) {
      nextThink = run.t + lag
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
          // いじわるじいさんが構えたら横へ逃げる
          if (run.g.st === 'windup') s += Math.min(3, Math.abs(u - (run.g.aimX - cx(o.z)))) * 3
          if (s > bs) { bs = s; best = u }
        }
        tgtU = best + (R() - 0.5) * 2 * err
      }
    }
    const cu = o.x - cx(o.z)
    const want = tgtU - cu
    // + は画面の右 = -x
    return { steer: clamp(-want * 1.6, -1, 1) }
  }
}
