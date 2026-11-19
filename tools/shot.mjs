import '../mute-auto.mjs'
// 撮影: node tools/shot.mjs [mode] [bot] [seed]  → shots/*.png とコンソールのエラー
import pw from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = new URL('..', import.meta.url).pathname
const PORT = 5600 + Math.floor(Math.random() * 300)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch (e) {} await new Promise(r => setTimeout(r, 150)) }
mkdirSync(ROOT + 'shots', { recursive: true })
const mode = process.argv[2] || 'kind', bot = process.argv[3] || 'good', seed = +(process.argv[4] || 3)
const b = await pw.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const p = await ctx.newPage()
const errs = []; p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()) })
await p.goto(`http://localhost:${PORT}/?lang=ja`)
try { await p.waitForFunction(() => window.__omuReady, null, { timeout: 20000 }) } catch (e) { console.log(errs.join("\n")); await p.screenshot({ path: ROOT + "shots/z_fail.png" }); process.exit(1) }
await p.waitForTimeout(2500)
await p.screenshot({ path: ROOT + 'shots/a_title.png' })
await p.evaluate(([m, s]) => { omuApi.start(m, s); omuApi.bot(null) }, [mode, seed])
await p.evaluate(() => omuApi.dbg.pause(true))
await p.evaluate(() => omuApi.dbg.step(20))
await p.screenshot({ path: ROOT + 'shots/b_start.png' })
await p.evaluate(b => omuApi.bot(b), bot)
const marks = [60, 140, 250, 380, 470]
let i = 0
for (const z of marks) {
  for (let k = 0; k < 200; k++) { const st = await p.evaluate(() => [omuApi.state(), omuApi.run.o.z]); if (st[0] !== 'play' || st[1] >= z) break; await p.evaluate(() => omuApi.dbg.step(30)) }
  const st = await p.evaluate(() => omuApi.state()); if (st !== 'play') break
  await p.screenshot({ path: ROOT + `shots/c_${i++}_${z}.png` })
}
for (let k = 0; k < 300; k++) { const st = await p.evaluate(() => omuApi.state()); if (st === 'result') break; await p.evaluate(() => omuApi.dbg.step(30)) }
await p.evaluate(() => omuApi.dbg.pause(false)); await p.waitForTimeout(1500)
const info = await p.evaluate(() => ({ st: omuApi.state(), end: omuApi.G.end && omuApi.G.end.key, z: omuApi.run.o.z | 0, t: omuApi.run.t | 0 }))
await p.screenshot({ path: ROOT + 'shots/d_result.png' })
console.log(JSON.stringify(info)); console.log(errs.slice(0, 20).join('\n'))
await b.close(); srv.kill()
