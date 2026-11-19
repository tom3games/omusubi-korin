import { newRun, step } from '../js/phys.js'
import { makeBot } from '../js/bot.js'
import { sectionAt } from '../js/course.js'
const kind = process.argv[2] || 'human', mode = process.argv[3] || 'greedy'
const sp = {}, gap = {}, falls = []
for (let i = 1; i <= 16; i++) {
  const run = newRun(i, { mode }), bot = makeBot(kind, i)
  while (!run.done && run.t < 240) { step(run, bot(run)); const s = sectionAt(run.o.z); (sp[s] ||= []).push(run.o.sp); if (run.g.st !== 'wait') (gap[s] ||= []).push(Math.hypot(run.o.x - run.g.x, run.o.z - run.g.z)); for (const e of run.ev) if (e.k === 'fall') { const h = run.holes[e.h]; falls.push(`${sectionAt(h.z)}:${h.size}${h.dug ? '(dug)' : ''}${h.first ? '(first)' : ''}`) } run.ev.length = 0 }
}
const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)
for (const s in sp) console.log(s.padEnd(7), 'speed', avg(sp[s]), 'gap', gap[s] ? avg(gap[s]) : '-')
console.log('falls', falls.join(' '))
