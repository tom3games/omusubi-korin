import '../mute-auto.mjs'
// バットの人と道の外の柵の撮影: node tools/batshot.mjs → shots/bat_*.png（2026-11-21）
import pw from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname
const PORT = 5600 + Math.floor(Math.random() * 300)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch (e) {} await new Promise(r => setTimeout(r, 150)) }
const b = await pw.chromium.launch({ args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'ja-JP' })
await muteContext(ctx)
const p = await ctx.newPage()
const errs = []; p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/?lang=ja`)
await p.waitForFunction(() => window.__omuReady, null, { timeout: 30000 }); await p.waitForTimeout(1500)
await p.evaluate(() => { omuApi.start('greedy', 1); omuApi.bot(null); omuApi.dbg.pause(true); omuApi.dbg.step(30) })
const b0 = await p.evaluate(() => { const b = omuApi.run.bats[0], a = omuApi.run; a.holes.length = 0; a.g.st = 'wait'; a.g.tm = 99; return { z: b.z, side: b.side } })
await p.evaluate(async z => { const C = await import('./js/course.js?v=7'); omuApi.setO({ x: C.cx(z - 14), z: z - 14, vx: 0, vz: 6 }) }, b0.z)
const log = []
for (let k = 0; k < 70; k++) {
  await p.evaluate(() => omuApi.dbg.step(3))
  const s = await p.evaluate(() => { const b = omuApi.run.bats[0]; return { st: b.st, oz: +omuApi.run.o.z.toFixed(1), vz: +omuApi.run.o.vz.toFixed(1) } })
  log.push(s.st + '@' + s.oz)
  if (['pop', 'ready', 'swing'].includes(s.st) || (s.st === 'done' && k % 3 === 0)) await p.screenshot({ path: ROOT + `shots/bat_${String(k).padStart(2, '0')}_${s.st}.png` })
}
// 道の外へはじき続ける
await p.evaluate(async () => { const C = await import('./js/course.js?v=7'); omuApi.run.walkers.length = 0; omuApi.setO({ x: C.cx(120), z: 120, vz: 6, vx: 0 }) })
for (let k = 0; k < 12; k++) await p.evaluate(() => omuApi.stepN(20, { lat: -1.3, push: 0.5 }))
await p.evaluate(() => omuApi.dbg.step(40))
await p.screenshot({ path: ROOT + 'shots/bat_wall.png' })
console.log(JSON.stringify(b0), log.join(' '), 'errs', errs)
await b.close(); srv.kill()
