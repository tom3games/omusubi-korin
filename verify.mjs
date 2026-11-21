import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 検証。node verify.mjs
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = +(process.env.VPORT || 5400 + Math.floor(Math.random() * 400))
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break } catch (e) {} await new Promise(r => setTimeout(r, 150)) }
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  if (process.env.VTRACE) console.error('> ' + name)
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) }
const GPU = { args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }
async function open(browser, opts = {}, q = '?lang=ja') {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|googletagmanager/.test(r.url()) && !/ABORTED|cancelled/i.test((r.failure() || {}).errorText || '')) p.errs.push('reqfail ' + r.url() + ' ' + ((r.failure() || {}).errorText || '')) })
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__omuReady, null, { timeout: 40000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true }))) continue
    if (el.id === 'bub' || el.closest('#bub')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button, main:not([hidden]) #emaki, main:not([hidden]) #daisen')) { if (!el.offsetParent) continue; const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
const overlaps = (q, ids) => q.evaluate(ids => {
  const R = {}; for (const id of ids) { const e = document.getElementById(id); if (e && e.offsetParent) R[id] = e.getBoundingClientRect() }
  const bad = []
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = R[ids[i]], b = R[ids[j]]; if (a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push(ids[i] + '/' + ids[j]) }
  return bad
}, ids)
const canvasVar = (p, sel) => p.evaluate(sel => { const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } return Math.round(s2 / n - (s / n) ** 2) }, sel)
const glVar = p => p.evaluate(() => { window.omuApi.render(); const c = document.querySelector('#view canvas'); const x = document.createElement('canvas'); x.width = 64; x.height = 128; const g = x.getContext('2d'); g.drawImage(c, 0, 0, 64, 128); const d = g.getImageData(0, 0, 64, 128).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } return Math.round(s2 / n - (s / n) ** 2) })
const tapEl = async (p, id) => { const b = await p.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, id); await p.touchscreen.tap(b.x, b.y) }
const toEnd = `(() => { const a = window.omuApi; a.setO({ x: 2.5, z: 816, vx: 0, vz: 4 }); a.run.holes.length = 0; a.run.g.st = 'wait'; a.run.g.tm = 99; a.dbg.pause(false) })()`

const browser = await chromium.launch(GPU)
const p = await open(browser, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, '?lang=ja&seed=7')
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', r); return r
})
await t('OGP 一式と canonical・転送がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]'), !!document.querySelector('link[rel=canonical]'), !!document.getElementById('ghMove')))
  expect(r.every(Boolean), r)
})
await t('タイトルの3Dが描けている（輝度のばらつき）', async () => { const v = await glVar(p); expect(v > 150, v); return v })
await t('タイトル: 一画面・はみ出しなし', async () => { const f = await fit(p), o = await overflow(p); await p.screenshot({ path: ROOT + '/shots/v-title.png' }); expect(!f.over.length && o.sw <= o.W && !o.bad.length, { f, o }) })
await t('本（いじわるじいさんの1冊）を指で押すと語りが出て、タップで転がり出す・実際は無音', async () => {
  await tapEl(p, 'bGreedy')
  await p.waitForFunction(() => window.omuApi.state() === 'intro', null, { timeout: 4000 })
  const intro = await p.evaluate(() => document.getElementById('introT').textContent)
  await p.touchscreen.tap(195, 500)
  await p.waitForFunction(() => window.omuApi.state() === 'play', null, { timeout: 4000 })
  const r = await p.evaluate(() => ({ ok: window.__muteOk(), calls: window.__soundCalls }))
  expect(r.ok && /じいさん/.test(intro), { r, intro }); return { intro: intro.slice(0, 12) }
})
await t('物理は固定 60Hz（60 回進めると 1 秒）', async () => {
  const r = await p.evaluate(async () => { const P = await import('./js/phys.js?v=6'); const run = P.newRun(3); for (let i = 0; i < 60; i++) P.step(run, {}); return +run.t.toFixed(4) })
  expect(Math.abs(r - 1) < 1e-6, r); return r
})
await t('本物の指で右斜め前へはじくと、前へ転がって画面の右へ曲がる。はじかないと15秒以内に止まる', async () => {
  await p.evaluate(async () => { const C = await import('./js/course.js?v=6'); const a = window.omuApi; a.dbg.pause(true); a.setO({ x: C.cx(80), z: 80, vx: 0, vz: 0 }); a.run.g.st = 'wait'; a.run.g.tm = 99; a.run.holes.length = 0; a.stepN(2) })
  const x0 = await p.evaluate(() => window.omuApi.run.o.x)
  await p.mouse.move(180, 640); await p.mouse.down(); await p.mouse.move(230, 560, { steps: 4 }); await p.mouse.up()
  const r = await p.evaluate(() => { const a = window.omuApi; a.stepN(1); const sp1 = a.run.o.sp; a.stepN(40); return { sp1, x1: a.run.o.x } })
  // 画面の右がどちらの向きか（おむすびの 1m 横を映して確かめる）
  const scr = await p.evaluate(() => { const a = window.omuApi, o = a.run.o, x = o.x; a.setO({ x: x - 1 }); a.stepN(1); const m = a.oniXY().x; a.setO({ x: x + 2 }); a.stepN(1); const pl = a.oniXY().x; return { minusX: Math.round(m), plusX: Math.round(pl) } })
  // はじかずに 6 秒
  const stop = await p.evaluate(() => { const a = window.omuApi; a.setO({ z: 90, vx: 0, vz: 6 }); a.stepN(900); return +a.run.o.sp.toFixed(2) })
  expect(r.sp1 > 2 && r.x1 < x0 - 0.3 && scr.minusX > scr.plusX && stop === 0, { x0, r, scr, stop }); return { sp: +r.sp1.toFixed(1), dx: +(r.x1 - x0).toFixed(2), stop }
})
await t('キーボード ↑ ← → が押しになる', async () => {
  const r = await p.evaluate(() => { const a = window.omuApi; a.setO({ z: 100, vx: 0, vz: 0 }); a.stepN(1); return a.run.o.sp })
  await p.keyboard.press('ArrowUp'); const up = await p.evaluate(() => { window.omuApi.stepN(2); return window.omuApi.run.o.sp })
  expect(r === 0 && up > 1.5, { r, up }); return { up: +up.toFixed(2) }
})
await t('遊び中: 一画面・はみ出しなし・絵巻と音のボタンが重ならない', async () => {
  const f = await fit(p), o = await overflow(p), ov = await overlaps(p, ['emaki', 'bMute2'])
  await p.screenshot({ path: ROOT + '/shots/v-play.png' })
  expect(!f.over.length && o.sw <= o.W && !o.bad.length && !ov.length, { f, o, ov })
})
await t('同じ種・同じ入力なら同じ結果（決定的）', async () => {
  const r = await p.evaluate(async () => {
    const P = await import('./js/phys.js?v=6'), B = await import('./js/bot.js?v=6')
    const go = m => { const run = P.newRun(42, { mode: m }), bot = B.makeBot('human', 42); while (!run.done && run.t < 200) P.step(run, bot(run)); return run.end.key + ':' + run.o.r.toFixed(6) + ':' + run.steps }
    const go2 = s2 => { const run = P.newRun(s2), bot = B.makeBot('human', s2); while (!run.done && run.t < 300) P.step(run, bot(run)); return run.end.key + ':' + run.o.r.toFixed(6) + ':' + run.steps }
    return [go('greedy'), go('greedy'), go2(7), go2(7)]
  })
  expect(r[0] === r[1] && r[2] === r[3], r); return r
})
await t('はじかないと止まって、拾われて穴に落とされる（12通り）', async () => {
  const r = await p.evaluate(async () => {
    const P = await import('./js/phys.js?v=6'), out = {}
    for (const m of ['greedy']) for (let s = 1; s <= 12; s++) { const run = P.newRun(s, { mode: m }); while (!run.done && run.t < 200) P.step(run, {}); const k = run.end ? run.end.key : 'timeout'; out[k] = (out[k] || 0) + 1 }
    return out
  })
  expect(!r.eatenKind && !r.eatenGreedy && !r.greedyKorin && !r.timeout && (r.thrown || 0) >= 10, r); return r
})
await t('穴: 自分より大きい穴に落ち、小さい穴は乗り越える。速くても抜けない', async () => {
  const r = await p.evaluate(async () => {
    const P = await import('./js/phys.js?v=6'), C = await import('./js/course.js?v=6')
    const at = (r0, hr, vz) => { const run = P.newRun(5, { mode: 'kind' }); run.g.st = 'wait'; run.g.tm = 99; const z = 150; run.holes = [{ x: C.cx(z), z, hr, size: 'x', t0: 0, i: 0 }]; run.hcd = new Float32Array(1); Object.assign(run.o, { x: C.cx(z - 0.3), z: z - 0.3, vx: 0, vz, r: r0 }); for (let i = 0; i < 30 && !run.done; i++) P.step(run, {}); return run.done ? run.end.key : 'pass' }
    return { smallOni: at(0.25, 0.34, 6), bigOni: at(0.45, 0.34, 6), fast: at(0.25, 0.34, 12.4) }
  })
  expect(r.smallOni === 'korin' && r.bigOni === 'pass' && r.fast === 'korin', r); return r
})
await t('いじわるじいさん: 振り上げた時に横へ逃げれば空振り、逃げなければ蹴られる', async () => {
  const r = await p.evaluate(async () => {
    const P = await import('./js/phys.js?v=6'), C = await import('./js/course.js?v=6')
    const go = steer => { const run = P.newRun(9, { mode: 'greedy' }); run.holes = []; run.hcd = new Float32Array(0); const z = 260; Object.assign(run.o, { x: C.cx(z), z, vx: 0, vz: 6, sp: 6 }); Object.assign(run.g, { x: C.cx(z - 1.5), z: z - 1.5, st: 'run', tm: 0, cool: 0, v: 6, hist: [] }); const ev = []; for (let i = 0; i < 90; i++) { P.step(run, ev.includes('windup') && !run.__d ? (run.__d = 1, { lat: steer }) : (i % 20 === 0 && !ev.includes('windup') ? { push: 0.6 } : {})); for (const e of run.ev) ev.push(e.k); run.ev.length = 0 } return ev.filter(k => /windup|kick|whiff/.test(k)).slice(0, 2).join(',') }
    return { stay: go(0), dodge: go(1) }
  })
  expect(r.stay === 'windup,kick' && r.dodge === 'windup,whiff', r); return r
})
await t('凸凹: 速いと跳ねて着地で少し欠ける。遅いと跳ねない（2026-11-21）', async () => {
  const r = await p.evaluate(async () => {
    const P = await import('./js/phys.js?v=6'), C = await import('./js/course.js?v=6')
    const b = C.BUMPS.find(q => q.z > 430 && q.hw > 2)
    const go = vz => { const run = P.newRun(4); run.holes = []; run.hcd = new Float32Array(0); run.g.st = 'wait'; run.g.tm = 99; Object.assign(run.o, { x: C.cx(b.z - 2) + b.u, z: b.z - 2, vx: 0, vz, r: 0.3 }); const ev = []; for (let i = 0; i < 90 && !run.done; i++) { P.step(run, { push: i % 15 === 0 && vz > 6 ? 0.5 : 0 }); for (const e of run.ev) ev.push(e.k); run.ev.length = 0 } return { hop: ev.includes('hop'), land: ev.includes('land'), r: +run.o.r.toFixed(4) } }
    return { fast: go(9), slow: go(3.5) }
  })
  expect(r.fast.hop && r.fast.land && r.fast.r < 0.3 && !r.slow.hop, r); return r
})
await t('石ころ: 後半、いじわるじいさんが投げる。まっすぐだと当たり、横へ逃げるとよけられる（2026-11-21）', async () => {
  const r = await p.evaluate(async () => {
    const P = await import('./js/phys.js?v=6'), C = await import('./js/course.js?v=6')
    const go = dodge => { const run = P.newRun(6); run.holes = []; run.hcd = new Float32Array(0); const z = 470; Object.assign(run.o, { x: C.cx(z), z, vx: 0, vz: 4.5, r: 0.3 }); Object.assign(run.g, { x: C.cx(z - 6), z: z - 6, st: 'run', tm: 0, cool: 99, v: 4, hist: [] }); run.pebT = 0; const ev = []; let thrown = 0
      for (let i = 0; i < 80 && !run.done; i++) { const inp = thrown && dodge && !run.__d ? (run.__d = 1, { lat: 1.2, push: 0.3 }) : {}; P.step(run, inp); for (const e of run.ev) { ev.push(e.k); if (e.k === 'peb') thrown = 1 } run.ev.length = 0; if (ev.includes('pebHit') || ev.includes('pebMiss')) break }
      return ev.filter(k => /^peb/.test(k)).join(',') }
    return { stay: go(false), dodge: go(true) }
  })
  expect(/peb,pebHit/.test(r.stay) && /peb,pebMiss/.test(r.dodge), r); return r
})
await t('穴の列には、どこも通り抜けられるすき間がある（16通り・穴と岩を前後1.5mで重ねて数える）', async () => {
  // 2026-11-21: 前は上手い bot の転がり落ち 2/16 以下で見ていたが、64通りでは前の版も 24/64 落ちていて、16通りが偶然通っていただけだった。すき間そのものを数える
  const r = await p.evaluate(async () => {
    const C = await import('./js/course.js?v=6'), ROCKS = C.OBJ.filter(b => !b.decor), need = 2 * (C.START_R + 0.1)
    let rows = 0, minGap = 9; const blocked = []
    for (let seed = 1; seed <= 16; seed++) { const H = C.makeHoles(seed).filter(h => !h.first)
      for (const h0 of H) { const z = h0.z, w = C.widths(z).road, bl = []
        for (const h of H) if (Math.abs(h.z - z) < 1.5) { const u = h.x - C.cx(h.z); bl.push([u - h.hr, u + h.hr]) }
        for (const b of ROCKS) if (Math.abs(b.z - z) < 1.5) { const u = b.x - C.cx(b.z); bl.push([u - b.r, u + b.r]) }
        bl.sort((a, b) => a[0] - b[0]); let x = -w, best = 0
        for (const [a, b] of bl) { best = Math.max(best, a - x); x = Math.max(x, b) } best = Math.max(best, w - x)
        rows++; minGap = Math.min(minGap, best); if (best < need) blocked.push(seed + '@' + z.toFixed(0)) } }
    return { rows, minGap: +minGap.toFixed(2), blocked: blocked.slice(0, 5) }
  })
  expect(r.rows > 300 && !r.blocked.length, r); return r
})
await t('最後まで進めると結末 → 絵本のページが描けて、図鑑に残る', async () => {
  await p.evaluate(toEnd)
  await p.waitForFunction(() => window.omuApi.state() === 'result', null, { timeout: 20000 })
  await p.waitForTimeout(1200)
  const v = await canvasVar(p, '#res'), z = await p.evaluate(() => JSON.parse(localStorage.getItem('omusubi-zukan') || '{}'))
  await p.screenshot({ path: ROOT + '/shots/v-result.png' })
  expect(v > 300 && z.eatenGreedy, { v, z }); return { v, z }
})
await t('結果画面: 一画面・はみ出しなし', async () => { const f = await fit(p), o = await overflow(p); expect(!f.over.length && o.sw <= o.W && !o.bad.length, { f, o }) })
await t('Xでポストの文に結末と URL が入る', async () => {
  const u = await p.evaluate(() => new Promise(res => { const o = window.open; window.open = (u) => { window.open = o; res(u) }; document.getElementById('bPost').click() }))
  expect(/x\.com\/intent\/post/.test(u) && /tom3games\.com%2Fplay%2Fomusubi-korin/.test(u) && /「.+」/.test(decodeURIComponent(u)), u); return u.slice(0, 70)
})
await t('「もう一方の話」のボタンは出ていない（話は1つ）', async () => {
  const v = await p.evaluate(() => getComputedStyle(document.getElementById('bOther')).display)
  expect(v === 'none', v); return v
})
await t('英語に切り替えられる', async () => {
  await p.evaluate(() => { document.getElementById('bBack').click(); document.getElementById('bLang').click() })
  const s = await p.evaluate(() => [document.getElementById('bGreedyT').textContent, document.getElementById('tH2').textContent])
  await p.evaluate(() => document.getElementById('bLang').click())
  expect(/Greedy/.test(s[0]) && /Falling/.test(s[1]), s); return s
})
await t('エラーなし（通しのあと）', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- スマホ縦3サイズ × タイトル・遊び・結果
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]) {
  const q = await open(browser, { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, '?lang=ja&seed=3')
  const views = {}
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  const tov = await overlaps(q, ['daisen', 'bKind', 'bGreedy', 'bHow'])
  await q.evaluate(() => { const a = window.omuApi; a.start('greedy', 3); a.dbg.pause(true); a.setO({ x: a.run.o.x, z: 140, vz: 8 }); a.stepN(30) })
  views.play = await fit(q); const ov = await overlaps(q, ['emaki', 'bMute2']); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await q.evaluate(toEnd)
  await q.waitForFunction(() => window.omuApi.state() === 'result', null, { timeout: 20000 })
  await q.waitForTimeout(900)
  views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, r) })
  await t(`${name}: タイトルの部品・遊び中の部品が重ならない`, async () => { expect(!ov.length && !tov.length, { ov, tov }) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}
// ---- X のアプリ内（下に 52px の帯）
{
  const q = await open(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, '?lang=ja&inapp=x')
  const r1 = await q.evaluate(() => { const b = document.getElementById('bKind').getBoundingClientRect(), l = document.getElementById('bHow').getBoundingClientRect(); return { gap: Math.round(innerHeight - Math.max(b.bottom, l.bottom)) } })
  await q.evaluate(() => window.omuApi.start('greedy', 3))
  await q.evaluate(toEnd)
  await q.waitForFunction(() => window.omuApi.state() === 'result', null, { timeout: 20000 })
  await q.waitForTimeout(800)
  const r2 = await q.evaluate(() => { let m = 0; for (const b of document.querySelectorAll('#vEnd button')) { if (!b.offsetParent) continue; m = Math.max(m, b.getBoundingClientRect().bottom) } return { gap: Math.round(innerHeight - m) } })
  await t('X のアプリ内: タイトルと結果のボタンが下の帯（52px）に入らない', async () => { expect(r1.gap >= 52 && r2.gap >= 52, { r1, r2 }); return { r1, r2 } })
  await q.close()
}
await browser.close()
// ---- WebKit（iPhone 相当）
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, '?lang=ja&seed=4')
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: 本を指で押して始められ、実際には無音', async () => {
  await tapEl(wp, 'bGreedy')
  await wp.waitForFunction(() => window.omuApi.state() === 'intro', null, { timeout: 20000 })
  await wp.touchscreen.tap(195, 500)
  await wp.waitForFunction(() => window.omuApi.state() === 'play', null, { timeout: 20000 })
  const r = await wp.evaluate(() => ({ ok: window.__muteOk(), st: window.omuApi.state() }))
  expect(r.ok, r); return r
})
await t('WebKit: 描けている・エラーなし', async () => { const v = await glVar(wp); expect(v > 100 && wp.errs.length === 0, v + ' ' + wp.errs.join('|')); return v })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
