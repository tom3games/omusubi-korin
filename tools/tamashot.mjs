import '../mute-auto.mjs'
// 結末のあとのつづらの場面と結果の絵本を撮る。node tools/tamashot.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname, PORT = 6100 + Math.floor(Math.random() * 500)
const sv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch {} await new Promise(r => setTimeout(r, 150)) }
const b = await chromium.launch({ args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const errs = []
for (const [mode, item, how] of [['kind', 'choco', 'none'], ['greedy', 'bill', 'none'], ['kind', 'tawara', 'end'], ['kind', 'card', 'home'], ['greedy', 'photo', 'none'], ['kind', 'empty', 'none']]) {
  const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
  await p.goto(`http://localhost:${PORT}/?lang=ja`); await p.waitForFunction(() => window.__omuReady, null, { timeout: 40000 })
  const r = await p.evaluate(([mode, item, how]) => {
    const a = window.omuApi; a.forceTama(item); a.start(mode, 5); a.dbg.pause(true)
    if (how === 'home') { a.setO({ x: 2.5, z: 596, vx: 0, vz: 4 }); a.run.holes.length = 0; a.run.g.st = 'wait'; a.run.g.tm = 99; a.dbg.pause(false); a.dbg.pause(true) } if (how === 'end') { a.setO({ x: a.run.o.x, z: 590, vx: 0, vz: 4 }); a.run.holes.length = 0; a.run.g.st = 'wait'; a.run.g.tm = 99 }
    let n = 0; while (!a.tama() && n < 60 * 40) { a.stepN(1); n++ }
    const st0 = a.state(); let m = 0; while (a.tama() && a.tama().t < 2.3 && m < 400) { a.stepN(1); m++ }
    a.render(); return { st0, n, tama: a.tama(), end: a.run.end && a.run.end.key }
  }, [mode, item, how])
  console.log(mode, item, JSON.stringify(r))
  await p.screenshot({ path: `${ROOT}/shots/tama-${item}.png` })
  await p.evaluate(() => { const a = window.omuApi; let k = 0; while (a.state() !== 'result' && k < 600) { a.stepN(1); k++ } })
  await p.waitForTimeout(1600)
  await p.screenshot({ path: `${ROOT}/shots/tama-${item}-result.png` })
  await ctx.close()
}
console.log('errors', errs.length, errs.slice(0, 5))
await b.close(); sv.kill()
