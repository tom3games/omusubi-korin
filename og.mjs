import './mute-auto.mjs'
// OGP 画像（1200x630）: 手まねきするねずみの穴の手前で、いじわるじいさんが足を振り上げる瞬間＋題名。node og.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname
const PORT = 5000 + Math.floor(Math.random() * 900)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch (e) {} await new Promise(r => setTimeout(r, 150)) }
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: 'ja-JP' })
await p.goto(`http://localhost:${PORT}/?lang=ja`)
await p.waitForFunction(() => window.__omuReady, null, { timeout: 30000 })
await p.waitForTimeout(2500)
await p.evaluate(async () => {
  const a = window.omuApi, C = await import('./js/course.js?v=1')
  a.start('greedy', 11); a.dbg.pause(true)
  const h = a.run.holes.filter(q => q.size === 'big' && q.z > 440 && q.z < 520)[0]
  window.__h = h
  const o = a.run.o; o.x = h.x + 0.62; o.z = h.z - 0.75; o.vx = 0; o.vz = 0.01; o.r = 0.3; o.ang = 0.3
  a.run.g.st = 'windup'; a.run.g.x = h.x + 1.0; a.run.g.z = h.z - 2.7
  const { oni, gpaG, gpa, HV } = a.obj()
  a.stepN(1, { steer: 0 })
  a.G.state = 'ending'; a.G.end = { key: 'none' }
  gpaG.position.set(a.run.g.x, C.height(a.run.g.x, a.run.g.z), a.run.g.z); gpaG.rotation.set(0, Math.atan2(o.x - a.run.g.x, o.z - a.run.g.z), 0)
  gpa.play('attack-kick-right', true, 1)
  oni.scale.setScalar(0.3); oni.position.set(o.x, C.height(o.x, o.z) + 0.26, o.z); oni.rotation.y = -0.46; oni.userData.spin.rotation.x = 0.05; oni.setFace('scared')
  a.G.state = 'title'
})
// 足を振り上げた所でアニメを止める
await p.evaluate(() => { const { gpa } = window.omuApi.obj(); gpa.update(0.33); if (gpa.act) gpa.act.paused = true })
await p.evaluate(async () => {
  const a = window.omuApi, C = await import('./js/course.js?v=1'), h = window.__h, { camera, HV, frame } = a.obj()
  // ねずみは顔を出して手まねき
  for (const H of HV) { if (H.h !== h) continue; H.mood = 1; H.mouse.position.y = 0.0; H.mouse.userData.armL.rotation.z = -2.0; H.mouse.userData.armR.rotation.z = 1.6; H.mouse.rotation.y = Math.atan2(-2.4, -2.2) - H.g.rotation.y }
  const y = C.height(h.x, h.z)
  document.getElementById('vTitle').hidden = true
  a.G.state = 'result'
  camera.position.set(h.x - 2.4, y + 1.05, h.z - 2.2); camera.lookAt(h.x + 0.9, y + 0.45, h.z - 1.2); camera.fov = 52; camera.updateProjectionMatrix()
  a.render()
})
await p.evaluate(() => {
  const d = document.createElement('div')
  d.innerHTML = `<div style="position:fixed;left:40px;top:28px;z-index:99;writing-mode:vertical-rl;text-orientation:upright;padding:16px 12px;background:#f3ead6;border:3px solid #c23a2b;box-shadow:inset 0 0 0 5px #f3ead6,inset 0 0 0 6px rgba(194,58,43,.55),0 8px 22px rgba(40,30,20,.35);font-family:'Zen Antique',serif;color:#2a2320;line-height:1.1;transform:rotate(-1deg)">
    <span style="display:block;font-size:34px;padding-top:.6em">おむすびころりん、</span><span style="display:block;font-size:64px;margin-right:8px">落ちてたまるか</span></div>
    <div style="position:fixed;right:40px;bottom:30px;z-index:99;font-family:'Zen Kurenaido',sans-serif;font-size:34px;color:#2a2320;background:rgba(243,234,214,.94);padding:8px 18px;border-radius:3px;box-shadow:0 4px 12px rgba(40,30,20,.25)">ねずみの穴には、ぜったい落ちない。</div>`
  document.body.appendChild(d)
  for (const id of ['vPlay', 'vEnd']) document.getElementById(id).hidden = true
  for (const el of document.querySelectorAll('body > a, body > button, [class*=support], #tmSupport, #tmHome')) el.style.display = 'none'
})
await p.evaluate(() => document.fonts.ready)
await p.waitForTimeout(500)
await p.evaluate(() => window.omuApi.render())
await p.screenshot({ path: ROOT + '/og.png' })
console.log('og.png')
await b.close(); srv.kill()
