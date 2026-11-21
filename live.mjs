import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る（2026-11-02 live.mjs に名前が文字で入ったまま5本公開していた）
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = process.env.URL0 || 'https://tom3games.github.io/omusubi-korin/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? { args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?stay=1&seed=3&t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__omuReady, null, { timeout: 30000 })
  // 遊びの通し: 本を押す → 語り → 転がる → ふもとの手前へ → 結末 → 絵本のページ
  const bx = await p.evaluate(() => { const r = document.getElementById('bGreedy').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  if (opts.hasTouch) await p.touchscreen.tap(bx.x, bx.y); else await p.mouse.click(bx.x, bx.y)
  await p.waitForFunction(() => window.omuApi.state() === 'intro', null, { timeout: 25000 })
  if (opts.hasTouch) await p.touchscreen.tap(195, 500); else await p.mouse.click(195, 500)
  await p.waitForFunction(() => window.omuApi.state() === 'play', null, { timeout: 25000 })
  await p.evaluate(() => { const a = window.omuApi; a.setO({ x: 2.5, z: 816, vx: 0, vz: 4 }); a.run.holes.length = 0; a.run.g.st = 'wait'; a.run.g.tm = 99 })
  await p.waitForFunction(() => window.omuApi.state() === 'result', null, { timeout: 30000 })
  const fin = await p.evaluate(() => window.omuApi.G.end.key + ' mute=' + (window.__muteOk ? window.__muteOk() : '?'))
  errs.push(...[]); out.push(`${name}: end=${fin}`)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch('og.png?v=1'); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/omusubi-korin', 'https://github.com/tom3games/omusubi-korin/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
