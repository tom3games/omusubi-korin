import '../mute-auto.mjs'
import pw from 'playwright'
import { spawn } from 'node:child_process'
const R = new URL('..', import.meta.url).pathname, PORT = 6120 + Math.floor(Math.random() * 30)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: R, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 800))
const b = await pw.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] }), p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}/?lang=ja`); await p.waitForFunction(() => window.__omuReady, null, { timeout: 30000 }); await p.waitForTimeout(1500)
for (const m of ['greedy', 'kind']) {
  await p.evaluate(m => { const a = window.omuApi; a.start(m, 5); a.dbg.pause(true); a.setO({ z: 150, x: a.run.o.x, vx: 0, vz: 3 }); a.run.g.x = a.run.o.x; a.run.g.z = 140; a.run.g.st = 'run' }, m)
  for (let i = 0; i < 80; i++) { const s = await p.evaluate(() => window.omuApi.state()); if (s !== 'play') break; await p.evaluate(() => window.omuApi.dbg.step(15)) }
  for (const [n, k] of [[60, 'a'], [100, 'b'], [70, 'c']]) { await p.evaluate(n => window.omuApi.dbg.step(n), n); await p.screenshot({ path: R + `shots/drop_${m}_${k}.png` }) }
  console.log(m, await p.evaluate(() => window.omuApi.G.end && window.omuApi.G.end.key))
}
console.log(errs.join('|')); await b.close(); srv.kill()
