import '../mute-auto.mjs'
import pw from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = new URL('..', import.meta.url).pathname
const PORT = 5990 + Math.floor(Math.random() * 9)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch (e) {} await new Promise(r => setTimeout(r, 150)) }
const b = await pw.webkit.launch()
for (let k = 0; k < 3; k++) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage()
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  await p.goto(`http://localhost:${PORT}/?lang=ja&seed=4`); await p.waitForFunction(() => window.__omuReady, null, { timeout: 40000 })
  const bx = await p.evaluate(() => { const r = document.getElementById('bGreedy').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: el && (el.id || el.className) } })
  await p.touchscreen.tap(bx.x, bx.y)
  const seq = []; for (let i = 0; i < 12; i++) { seq.push(await p.evaluate(() => window.omuApi.state())); await p.waitForTimeout(300) }
  console.log(JSON.stringify(bx), seq.join(','), errs.join('|'))
  await p.close()
}
await b.close(); srv.kill()
