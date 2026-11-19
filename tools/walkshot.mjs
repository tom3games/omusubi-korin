import '../mute-auto.mjs'
// 通行人の場面を撮る。node tools/walkshot.mjs
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname, PORT = 6100 + Math.floor(Math.random() * 500)
const sv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch {} await new Promise(r => setTimeout(r, 150)) }
const errs = []
for (const [name, bt, opt] of [['chromium', chromium, { args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }], ['webkit', webkit, {}]]) {
  const b = await bt.launch(opt)
  const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ' ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push(name + ' ' + m.text()))
  await p.goto(`http://localhost:${PORT}/?lang=ja`); await p.waitForFunction(() => window.__omuReady, null, { timeout: 60000 })
  const r = await p.evaluate(() => {
    const a = window.omuApi; a.start('kind', 3); a.dbg.pause(true); a.run.g.st = 'wait'; a.run.g.tm = 999; a.bot('good')
    let n = 0; while (n < 60 * 60) { a.stepN(1); n++; const w = a.run.walkers.find(w => w.st === 'walk' && w.z - a.run.o.z < 7 && w.z - a.run.o.z > 3); if (w) break }
    a.render(); return { n, walkers: a.run.walkers.length, z: a.run.o.z.toFixed(1) }
  })
  console.log(name, 'near', JSON.stringify(r)); await p.screenshot({ path: `${ROOT}/shots/walk-${name}-near.png` })
  // ぶつける: 次の水汲みの真ん前におむすびを置く
  const h = await p.evaluate(() => {
    const a = window.omuApi; a.bot(null)
    const w = a.run.walkers.find(w => w.st !== 'gone' && !w.hit && w.kind === 'mizu') || a.run.walkers.find(w => w.st !== 'gone' && !w.hit)
    if (!w) return 'no walker'
    a.setO({ x: w.x, z: w.z - 2.2, vx: 0, vz: 6 }); const r0 = a.run.o.r
    for (let i = 0; i < 40; i++) a.stepN(1)
    a.render(); return { kind: w.kind, hit: w.hit, r0: +r0.toFixed(3), r1: +a.run.o.r.toFixed(3) }
  })
  console.log(name, 'hit', JSON.stringify(h)); await p.screenshot({ path: `${ROOT}/shots/walk-${name}-hit.png` })
  await b.close()
}
console.log('errors', errs.length, errs.slice(0, 5)); sv.kill()
