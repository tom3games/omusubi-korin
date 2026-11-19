import '../mute-auto.mjs'
import pw from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = new URL('..', import.meta.url).pathname
const PORT = 5950 + Math.floor(Math.random() * 40)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch (e) {} await new Promise(r => setTimeout(r, 150)) }
const b = await pw.chromium.launch()
for (const [w, h, q] of [[360, 640, ''], [390, 844, '&inapp=x']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true })).newPage()
  await p.goto(`http://localhost:${PORT}/?lang=ja${q}`); await p.waitForFunction(() => window.__omuReady, null, { timeout: 30000 }); await p.waitForTimeout(800)
  console.log(w, h, q, JSON.stringify(await p.evaluate(() => ['cover', 'daisen', 'tK', 'tSpace', 'tPick', 'books', 'tBest', 'bHow'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return id + ':' + Math.round(r.top) + '-' + Math.round(r.bottom) }))))
}
await b.close(); srv.kill()
