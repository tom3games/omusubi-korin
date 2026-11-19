// おむすびとおじいさんの動き（three を使わない。固定 60Hz。同じ入力なら同じ結果）
import { OBJ, HOLE, START_R, S_END, SURF, height, surfaceAt, sectionAt, cx, widths, clamp, rng, makeHoles, digPlan } from './course.js?v=3'

export const DT = 1 / 60
export const TUNE = {
  g: 12.5, gk: 0.45, cd: 0.008, roll: 1.35, pushV: 3.1, latV: 3.2, latDamp: 3.0, vmax: 11, stopV: 0.3,
  grow: 0.0075, maxR: 0.62, chip: [0.012, 0.0016],
  // 転がるたびに少しずつ削れる（1m で wear。田んぼでは削れずにくっつく）。2026-11-20 本人「転がっていくたびにちょっとずつ削れて」
  wear: 0.0001, minR: 0.12,
  // おじいさん
  kind: { vmax: 15, acc: 6, catchD: 0.95, follow: 0.97, close: 0.45, far: 9 },
  greedy: { vmax: 16, acc: 7, follow: 1.0, close: 1.1, far: 7, kickD: 2.1, windup: 0.62, cool: 3.2, hitLat: 0.85 },
}
const BIN = new Map()
for (const o of OBJ) { if (o.decor) continue; for (let z = Math.floor(o.z - o.r - 1); z <= Math.floor(o.z + o.r + 1); z++) { if (!BIN.has(z)) BIN.set(z, []); BIN.get(z).push(o) } }

// mode: 'kind'（やさしいおじいさんが落とした）／'greedy'（いじわるじいさんが転がした）
export function newRun(seed = 1, opt = {}) {
  const R = rng(seed * 7919 + 5)
  const mode = opt.mode || (R() < 0.5 ? 'kind' : 'greedy')
  const holes = makeHoles(seed)
  return {
    seed, mode, t: 0, steps: 0, holes, digs: digPlan(seed), digI: 0,
    o: mode === 'kind' ? { x: cx(-3.6) + 1.5, z: -3.6, vx: -0.3, vz: 2.2, r: START_R, y: 0, ang: 0, sp: 0, bump: 0 } : { x: cx(-2.2), z: -2.2, vx: 0, vz: 5.0, r: START_R, y: 0, ang: 0, sp: 0, bump: 0 },
    g: mode === 'kind' ? { x: cx(-5.2) + 2.7, z: -5.2, v: 0, st: 'wait', tm: 1.1, aimX: 0, cool: 1.5, hist: [] } : { x: cx(-3.6), z: -3.6, v: 0, st: 'wait', tm: 0.5, aimX: 0, cool: 1.5, hist: [] },
    alive: new Uint8Array(OBJ.length).fill(1), cd: new Float32Array(OBJ.length), hcd: new Float32Array(holes.length),
    ev: [], end: null, done: false, lastKick: -9,
    st: { chip: 0, grow: 0, edges: 0, overs: 0, kicks: 0, dodges: 0, gTrips: 0, paddyT: 0, maxV: 0, minGap: 99 },
  }
}
export function cloneRun(run) {
  return { ...run, o: { ...run.o }, g: { ...run.g, hist: run.g.hist.slice() }, holes: run.holes.map(h => ({ ...h })), digs: run.digs.slice(), alive: run.alive.slice(), cd: run.cd.slice(), hcd: run.hcd.slice(), ev: [], st: { ...run.st } }
}
function emit(run, k, o = {}) { run.ev.push({ k, ...o }) }
function finish(run, key, extra = {}) { if (run.done) return; run.done = true; run.end = { key, r: run.o.r, z: run.o.z, x: run.o.x, t: run.t, ...extra }; emit(run, 'end', { key }) }
export function holeOpen(run, h) { return run.t >= h.t0 }
// 着いた時の結末
export function arriveEnding(run) {
  const r = run.o.r
  if (r >= 0.52) return 'oomusubi'
  if (r < 0.18) return 'hitokuchi'
  return run.mode === 'kind' ? 'eatenKind' : 'eatenGreedy'
}

// inp: { steer: -1..1（+ で画面の右） }
export function step(run, inp) {
  if (run.done) return
  const T = TUNE, o = run.o
  run.t += DT; run.steps++
  const e = 0.3
  const gx = (height(o.x + e, o.z) - height(o.x - e, o.z)) / (2 * e)
  const gz = (height(o.x, o.z + e) - height(o.x, o.z - e)) / (2 * e)
  const sf = surfaceAt(o.x, o.z), S = SURF[sf]
  // 坂で少しずつ転がるが、押さないと止まる（転がりの抵抗が坂より強い）
  let ax = -T.g * T.gk * gx, az = -T.g * T.gk * gz
  const v = Math.hypot(o.vx, o.vz) || 1e-6
  const drag = T.cd * (1 + S.drag * 3)
  ax -= drag * v * o.vx; az -= drag * v * o.vz
  const fr = T.roll * (1 + S.drag) * (v > 0.02 ? 1 : 0)
  ax -= fr * o.vx / v; az -= fr * o.vz / v
  // 道に対する横すべりは少しずつ止まる
  const dcx = (cx(o.z + 1) - cx(o.z - 1)) / 2, fl = Math.hypot(dcx, 1), fx = dcx / fl, fz = 1 / fl
  const latV = o.vx * fz - o.vz * fx
  ax -= latV * fz * T.latDamp; az += latV * fx * T.latDamp
  o.vx += ax * DT; o.vz += az * DT
  // はじく（スワイプ1回 = 1回の押し）。push は前へ、lat は横（+ で画面の右 = -x）。大きいほど重い
  const push = clamp(inp.push || 0, 0, 1.3), lat = clamp(inp.lat || 0, -1.3, 1.3)
  if (push || lat) {
    const heavy = 1 / (0.55 + 1.5 * o.r)
    const dvF = T.pushV * push * heavy, dvL = -T.latV * lat * heavy
    o.vx += fx * dvF + fz * dvL; o.vz += fz * dvF - fx * dvL
    run.st.pushes = (run.st.pushes || 0) + (push > 0.2 ? 1 : 0)
    emit(run, 'push', { push, lat })
  }
  let sp = Math.hypot(o.vx, o.vz)
  if (sp > T.vmax) { o.vx *= T.vmax / sp; o.vz *= T.vmax / sp; sp = T.vmax }
  // 止まる（ゆっくりなら転がりの抵抗で止まりきる）
  if (sp < T.stopV && !push) { o.vx = o.vz = 0; sp = 0; run.stillT = (run.stillT || 0) + DT; if (run.stillT > 0.3 && !run.stopEv) { run.stopEv = 1; emit(run, 'stop') } } else { run.stillT = 0; run.stopEv = 0 }
  const px = o.x, pz = o.z
  o.x += o.vx * DT; o.z += o.vz * DT
  const ds = Math.hypot(o.x - px, o.z - pz)
  // 田んぼで米粒がくっつく
  if (S.grow && o.r < T.maxR) { const g = T.grow * ds; o.r = Math.min(T.maxR, o.r + g); run.st.grow += g; run.st.paddyT += DT }
  else if (!S.grow && o.r > T.minR) { const w = Math.min(o.r - T.minR, T.wear * ds); o.r -= w; run.st.wear = (run.st.wear || 0) + w }
  collide(run, sp)
  holes(run, px, pz)
  if (run.done) return
  o.sp = Math.hypot(o.vx, o.vz); if (o.sp > run.st.maxV) run.st.maxV = o.sp
  o.ang += ds / Math.max(0.08, o.r * 1.05)
  o.bump = Math.max(0, o.bump - DT * 3)
  o.y = height(o.x, o.z)
  dig(run)
  grandpa(run, inp)
  if (run.done) return
  if (o.z >= S_END) {
    o.vx *= 0.9; o.vz *= 0.9
    if (o.sp < 1.2 || o.z > S_END + 8) finish(run, arriveEnding(run))
  }
}

function collide(run, sp) {
  const o = run.o
  for (let z = Math.floor(o.z - 2); z <= Math.floor(o.z + 2); z++) {
    const a = BIN.get(z); if (!a) continue
    for (const b of a) {
      if (!run.alive[b.i] || run.cd[b.i] > run.t) continue
      const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz), pen = o.r * 0.8 + b.r - d
      if (pen <= 0) continue
      let nx = dx / (d || 1), nz = dz / (d || 1)
      if (Math.abs(nx) < 0.4) { const sx = nx !== 0 ? Math.sign(nx) : (b.i % 2 ? 1 : -1); nx = sx * 0.4 + nx * 0.6; const l = Math.hypot(nx, nz); nx /= l; nz /= l }
      const vn = o.vx * nx + o.vz * nz
      if (vn < 0) { o.vx -= 1.4 * vn * nx; o.vz -= 1.4 * vn * nz; o.vx *= 0.8; o.vz *= 0.8 }
      o.x += nx * pen; o.z += nz * pen
      run.cd[b.i] = run.t + 0.9
      let dr = 0
      if (b.kind === 'rock') { dr = -(TUNE.chip[0] + TUNE.chip[1] * Math.abs(vn)); o.r = Math.max(0.1, o.r + dr); run.st.chip -= dr; run.st.chips = (run.st.chips || 0) + 1 }
      o.bump = 1
      emit(run, 'bump', { kind: b.kind, o: b.i, dr, sp: Math.abs(vn), nx, nz })
    }
  }
}

// 穴: おむすびより大きい穴の上を通ったら落ちる。小さい穴はガタンと乗り越える
function holes(run, px, pz) {
  const o = run.o
  for (const h of run.holes) {
    if (Math.abs(h.z - o.z) > 2 || !holeOpen(run, h)) continue
    // 前のコマと今のコマを結ぶ線分で、穴の中心にいちばん近い所を見る（速いと抜けるのを防ぐ）
    const ex = o.x - px, ez = o.z - pz, l2 = ex * ex + ez * ez
    const tt = l2 > 0 ? clamp(((h.x - px) * ex + (h.z - pz) * ez) / l2, 0, 1) : 1
    const qx = px + ex * tt, qz = pz + ez * tt, d = Math.hypot(h.x - qx, h.z - qz)
    if (o.r < h.hr) {
      if (d < h.hr * 0.9) {
        o.x = h.x; o.z = h.z; o.vx = o.vz = 0
        const kicked = run.t - run.lastKick < 2.2
        emit(run, 'fall', { h: h.i, kicked })
        return finish(run, kicked ? 'kicked' : 'korin', { h: h.i })
      }
      if (d < h.hr + o.r * 0.75 && run.hcd[h.i] <= run.t) { run.hcd[h.i] = run.t + 2; run.st.edges++; emit(run, 'edge', { h: h.i }) }
    } else if (d < h.hr * 0.9 && run.hcd[h.i] <= run.t) {
      run.hcd[h.i] = run.t + 1.5; run.st.overs++; o.bump = 1; o.vx *= 0.9; o.vz *= 0.88
      emit(run, 'over', { h: h.i })
    }
  }
}

// ねずみの里: 目の前に、ちょうど入る大きさの穴を掘る
function dig(run) {
  const o = run.o
  if (run.digI >= run.digs.length || o.z < run.digs[run.digI]) return
  run.digI++
  if (o.r >= HOLE.big) { emit(run, 'digGiveUp'); return } // 大きすぎると、ねずみは掘るのをあきらめる
  const lead = clamp(o.sp * 1.6, 5, 13), z = o.z + lead
  const w = widths(z), hr = Math.min(HOLE.big, Math.max(HOLE.small, o.r + 0.07))
  const x = cx(z) + clamp(o.x + o.vx / Math.max(1, o.vz) * lead - cx(z), -(w.road - 0.4), w.road - 0.4)
  const h = { x, z, hr, size: hr >= HOLE.big ? 'big' : hr >= HOLE.mid ? 'mid' : 'small', t0: run.t + 0.95, i: run.holes.length, dug: 1 }
  run.holes.push(h); run.hcd = Float32Array.from([...run.hcd, 0])
  emit(run, 'dig', { h: h.i })
}

// おじいさん: おむすびを追いかける。いじわるじいさんは追いつくと穴の方へ蹴る
function grandpa(run, inp) {
  const g = run.g, o = run.o, M = TUNE[run.mode]
  g.hist.push(o.x, o.z); if (g.hist.length > 40) g.hist.splice(0, 2) // 約0.33秒前の位置を追う
  if (g.st === 'wait') { g.tm -= DT; if (g.tm <= 0) { g.st = 'run'; emit(run, 'gRun') } return }
  if (g.st === 'trip' || g.st === 'recover') { g.tm -= DT; g.v *= 0.9; if (g.tm <= 0) { g.st = 'run' } return }
  if (g.st === 'gone') return
  const tx = g.hist[0], tz = g.hist[1]
  let dx = tx - g.x, dz = tz - g.z; const d = Math.hypot(dx, dz) || 1
  const sf = surfaceAt(g.x, g.z), slow = sf === 'paddy' ? 0.85 : sf === 'grass' ? 0.9 : 1
  // おむすびの速さに合わせて走る。離れすぎたら尻すべりで追いつく
  const gap0 = Math.hypot(o.x - g.x, o.z - g.z)
  const vmax = Math.min(M.vmax, (o.sp * M.follow + M.close + Math.max(0, gap0 - M.far) * 0.6) * slow) * (g.st === 'windup' ? 0.8 : 1)
  g.slide = gap0 > M.far + 4
  g.v = g.v < vmax ? Math.min(vmax, g.v + M.acc * DT) : Math.max(vmax, g.v - M.acc * 2 * DT)
  g.x += dx / d * g.v * DT; g.z += dz / d * g.v * DT
  const gap = Math.hypot(o.x - g.x, o.z - g.z)
  if (gap < run.st.minGap) run.st.minGap = gap
  // 穴に足を取られる・大きい穴には落ちる
  // 穴をよける。ただし、おむすびのすぐ後ろ（3m 以内）では足元を見ていない
  const focus = run.mode === 'kind' ? false : gap < 3.2
  if (!focus) for (const h of run.holes) {
    if (h.z < g.z + 0.3 || h.z > g.z + 3 || !holeOpen(run, h)) continue
    const side = g.x - h.x, need = h.hr + 0.5
    if (Math.abs(side) < need) g.x += Math.sign(side || 1) * Math.min(need - Math.abs(side), 3.5 * DT)
  }
  for (const h of run.holes) {
    if (Math.abs(h.z - g.z) > 1.5 || !holeOpen(run, h)) continue
    const hd = Math.hypot(h.x - g.x, h.z - g.z)
    if (hd < h.hr * 0.8) {
      if (h.size === 'big' && o.z < S_END - 2) { g.st = 'gone'; g.x = h.x; g.z = h.z; emit(run, 'gFall', { h: h.i }); return finish(run, run.mode === 'greedy' ? 'greedyKorin' : 'kindKorin', { h: h.i }) }
      if (!h.gHit) { h.gHit = 1; g.st = 'trip'; g.tm = h.size === 'mid' ? 1.0 : 0.55; g.v = 0; run.st.gTrips++; emit(run, 'gTrip', { h: h.i }); return }
    }
  }
  // 追いつかれたら拾われて、穴に落とされる（やさしいおじいさんは手がすべる・いじわるじいさんは放りこむ）
  if (run.mode === 'kind') {
    if (gap < M.catchD && o.z < S_END - 6) { emit(run, 'gCatch'); return finish(run, 'picked') }
    return
  }
  if (gap < 0.95 && o.sp < 2.5 && o.z < S_END - 6) { emit(run, 'gCatch'); return finish(run, 'thrown') }
  // いじわるじいさん: 蹴る
  g.cool -= DT
  if (g.st === 'run' && g.cool <= 0 && gap < M.kickD && o.sp >= 2.5 && o.z < S_END - 10) { g.st = 'windup'; g.tm = M.windup; g.aimX = o.x; emit(run, 'windup') }
  else if (g.st === 'windup') {
    g.tm -= DT
    if (g.tm <= 0) {
      g.cool = M.cool
      const lat = Math.abs(o.x - g.aimX)
      if (gap < M.kickD + 0.6 && lat < M.hitLat) {
        // いちばん近い「入る穴」の方へ
        let best = null, bd = 1e9
        for (const h of run.holes) { if (h.z < o.z + 1.5 || h.z > o.z + 14 || h.hr <= o.r || !holeOpen(run, h)) continue; const q = Math.abs(h.x - o.x) + (h.z - o.z) * 0.2; if (q < bd) { bd = q; best = h } }
        const side = best ? Math.sign(best.x - o.x) || 1 : (rng(run.seed + run.steps)() < 0.5 ? -1 : 1)
        o.vx += side * 4.2; o.vz += 3.2; o.bump = 1
        run.lastKick = run.t; run.st.kicks++; g.st = 'recover'; g.tm = 0.7; g.v = 0
        emit(run, 'kick', { side })
      } else { run.st.dodges++; g.st = 'trip'; g.tm = 1.3; g.v = 0; emit(run, 'whiff') }
    }
  }
}
