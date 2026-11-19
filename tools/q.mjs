import '../mute-auto.mjs'
// タイトルと結果を 360x640 で撮る: node tools/q.mjs [mode]
import pw from 'playwright'
import { spawn } from 'node:child_process'
const R = new URL('..', import.meta.url).pathname, PORT = 6080 + Math.floor(Math.random() * 30)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: R, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 800))
const b = await pw.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] }), p = await (await b.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage()
await p.goto(`http://localhost:${PORT}/?lang=ja`); await p.waitForFunction(() => window.__omuReady, null, { timeout: 30000 }); await p.waitForTimeout(1200)
await p.screenshot({ path: R + 'shots/q-title.png' })
await p.evaluate(m => { const a = window.omuApi; a.start(m, 3); a.setO({ x: 2.5, z: 596, vx: 0, vz: 4 }); a.run.holes.length = 0; a.run.g.st = 'wait'; a.run.g.tm = 99 }, process.argv[2] || 'kind')
await p.waitForFunction(() => window.omuApi.state() === 'result', null, { timeout: 20000 }); await p.waitForTimeout(1500)
await p.screenshot({ path: R + 'shots/q-res.png' }); await b.close(); srv.kill()
