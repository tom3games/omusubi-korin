import '../mute-auto.mjs'
// 見せ場を撮る: node tools/scenes.mjs
import pw from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = new URL('..', import.meta.url).pathname
const PORT = 6010 + Math.floor(Math.random() * 40)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch (e) {} await new Promise(r => setTimeout(r, 150)) }
const b = await pw.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}/?lang=ja`); await p.waitForFunction(() => window.__omuReady, null, { timeout: 30000 }); await p.waitForTimeout(1500)
// 1) 語り（いじわる）
await p.evaluate(() => { const a = window.omuApi; a.G.paused = true; a.G.state = 'title' })
await p.evaluate(() => { document.getElementById('bGreedy').click() }); await p.evaluate(() => window.omuApi.dbg.step(60))
await p.screenshot({ path: ROOT + 'shots/s1_intro.png' })
// 2) 蹴られる直前（いじわる・田んぼ bot）
async function until(fn, n = 4000) { for (let i = 0; i < n; i += 10) { const r = await p.evaluate(fn); if (r) return true; await p.evaluate(() => window.omuApi.dbg.step(10)) } return false }
await p.evaluate(() => { const a = window.omuApi; a.start('greedy', 2); a.dbg.pause(true); a.G.evLog = []; a.bot('paddy') })
await until(() => window.omuApi.G.evLog.includes('windup') || window.omuApi.state() !== 'play')
await p.evaluate(() => window.omuApi.dbg.step(20)); await p.screenshot({ path: ROOT + 'shots/s2_windup.png' })
// 3) ねずみが掘る
await until(() => window.omuApi.G.evLog.includes('dig') || window.omuApi.state() !== 'play')
await p.evaluate(() => window.omuApi.dbg.step(25)); await p.screenshot({ path: ROOT + 'shots/s3_dig.png' })
// 4) じいさんが穴に（頭から）
await until(() => window.omuApi.state() === 'ending' || window.omuApi.state() === 'result')
await p.evaluate(() => window.omuApi.dbg.step(110)); await p.screenshot({ path: ROOT + 'shots/s4_end.png' })
const k1 = await p.evaluate(() => window.omuApi.G.end && window.omuApi.G.end.key)
// 5) おむすびが穴に落ちる（真ん中だけ）
await p.evaluate(() => { const a = window.omuApi; a.start('kind', 1); a.dbg.pause(true); a.bot('center') })
await until(() => window.omuApi.state() === 'ending')
await p.evaluate(() => window.omuApi.dbg.step(70)); await p.screenshot({ path: ROOT + 'shots/s5_korin.png' })
await p.evaluate(() => window.omuApi.dbg.step(140)); await p.screenshot({ path: ROOT + 'shots/s6_korin_res.png' })
console.log(k1, errs.join('|'))
await b.close(); srv.kill()
