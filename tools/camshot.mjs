import '../mute-auto.mjs'
// 遊んでいる最中の視点を撮る（カメラが追いついた後）。node tools/camshot.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname, PORT = 6100 + Math.floor(Math.random() * 500)
const sv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch {} await new Promise(r => setTimeout(r, 150)) }
const b = await chromium.launch({ args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('console', m => console.log('C', m.type(), m.text().slice(0, 150))); p.on('pageerror', e => console.log('E', e.message)); p.on('requestfailed', r => console.log('F', r.url())); await p.goto(`http://localhost:${PORT}/?lang=ja`); await p.waitForFunction(() => window.__omuReady, null, { timeout: 40000 })
await p.evaluate(() => { const a = window.omuApi; a.start('kind', 4); a.dbg.pause(true); a.run.g.st = 'wait'; a.run.g.tm = 999 })
for (const [n, k] of [[240, 'a'], [300, 'b'], [300, 'c']]) {
  const r = await p.evaluate((n) => { const a = window.omuApi; for (let i = 0; i < n; i++) a.stepN(1, i % 40 === 0 ? { push: 0.7, lat: i % 120 === 0 ? 0.3 : 0 } : null); a.render(); return { z: a.run.o.z.toFixed(1), st: a.state(), xy: a.oniXY() } }, n)
  console.log(k, JSON.stringify(r)); await p.screenshot({ path: `${ROOT}/shots/cam-${k}.png` })
}
await b.close(); sv.kill()
