// 遊び方ごとの結末の分布: node tools/sim.mjs [回数]
import { newRun, step } from '../js/phys.js'
import { makeBot } from '../js/bot.js'
const N = +(process.argv[2] || 16)
for (const kind of ['none', 'center', 'human', 'good', 'paddy']) for (const mode of ['kind', 'greedy']) {
  const out = {}, ts = [], zs = []
  let kicks = 0, dodges = 0, trips = 0, edges = 0, rs = []
  for (let i = 1; i <= N; i++) {
    const run = newRun(i, { mode }), bot = makeBot(kind, i)
    while (!run.done && run.t < 240) { step(run, bot(run)); run.ev.length = 0 }
    const k = run.end ? run.end.key : 'timeout'
    out[k] = (out[k] || 0) + 1; ts.push(run.t); zs.push(run.o.z); kicks += run.st.kicks; dodges += run.st.dodges; trips += run.st.gTrips; edges += run.st.edges; rs.push(run.o.r)
  }
  const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)
  console.log(kind.padEnd(7), mode.padEnd(6), JSON.stringify(out), `t=${avg(ts)}s z=${avg(zs)} r=${avg(rs.map(r => r * 100))}cm kick=${kicks} dodge=${dodges} gTrip=${trips} edge=${edges}`)
}
