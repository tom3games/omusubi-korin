// おむすびころりん、落ちてたまるか — 本体（画面・入力・演出・音・結末・絵本のページ）
import * as THREE from 'three'
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from '../vendor/jsm/postprocessing/ShaderPass.js'
import { TXT, ENDINGS, TAMA } from './data.js?v=3'
import { makeTsuzura, makeItem } from './tama.js?v=3'
import { S_END, OBJ, YARD, SECTIONS, START_R, cx, height, widths, surfaceAt, sectionAt, clamp } from './course.js?v=3'
import { newRun, step, DT, holeOpen } from './phys.js?v=3'
import { buildWorld, buildSky, buildBackdrop, makeOnigiri, supportH, makeHole, makeMouse, makeParticles, makeLeaves, loadTextures, loadLaterTextures } from './view.js?v=3'
import { loadChars, Person } from './chars.js?v=3'
import { makeBot } from './bot.js?v=3'

window.__jsUp = true
const V = '?v=3'
const $ = id => document.getElementById(id)
const Q = new URLSearchParams(location.search)
const isTouch = matchMedia('(pointer: coarse)').matches
const lowEnd = isTouch && Math.min(screen.width, screen.height) < 500
const NS = 'omusubi-'
const LS = { get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : v } catch (e) { return d } }, set(k, v) { try { localStorage.setItem(NS + k, v) } catch (e) {} } }
let lang = Q.get('lang') || LS.get('lang', (navigator.language || 'ja').slice(0, 2) === 'ja' ? 'ja' : 'en')
if (!TXT[lang]) lang = 'ja'
const t = k => (TXT[lang][k] ?? TXT.ja[k])
const t_ = t

// ------------------------------------------------------------ 描画の土台
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.3 : 1.75))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
$('view').appendChild(renderer.domElement)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 2400)
buildSky(scene); buildBackdrop(scene)
const hemi = new THREE.HemisphereLight(0xdfe9f2, 0x8a7a5a, 0.85); scene.add(hemi)
const sun = new THREE.DirectionalLight(0xffe6c4, 2.5); scene.add(sun, sun.target)
const SUNDIR = new THREE.Vector3(-0.55, 0.7, -0.45).normalize()
sun.castShadow = true
sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048)
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 90 })
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04
scene.fog = new THREE.Fog(0xe9e2d0, 50, 300)
{ // 空の色から周りの光
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene()
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(vec3(0.95,0.91,0.82), vec3(0.42,0.6,0.85), pow(h, 0.6)) : vec3(0.5,0.45,0.32); gl_FragColor = vec4(c, 1.0); }' })
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), m)); scene.environment = pm.fromScene(es, 0.02).texture; scene.environmentIntensity = 0.45
}
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: lowEnd ? 0 : 4 }))
composer.setPixelRatio(renderer.getPixelRatio())
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.25, 0.5, 0.96)
composer.addPass(bloom)
composer.addPass(new OutputPass())
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(innerWidth, innerHeight) }, dark: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; uniform float dark; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, 1.05) * vec3(1.02, 1.0, 0.96);
      vec2 d = vUv - 0.5; float v = smoothstep(0.95, 0.3, length(d * vec2(1.1, 1.0)));
      c.rgb *= mix(0.7 - dark * 0.6, 1.0, v);
      c.rgb *= 1.0 - dark * 0.55;
      float g = fract(sin(dot(vUv * res + time, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (g - 0.5) * 0.018;
      gl_FragColor = c; }`,
})
composer.addPass(grade)
function onResize() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); grade.uniforms.res.value.set(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix()
  if (P) P.pts.material.uniforms.scale.value = innerHeight * 0.75
}
addEventListener('resize', onResize)

// ------------------------------------------------------------ 音
Snd.def({ rock: ['snd/rock1.mp3', 'snd/rock2.mp3', 'snd/rock3.mp3'], wood: ['snd/wood1.mp3', 'snd/wood2.mp3'], splash: ['snd/splash1.mp3', 'snd/splash2.mp3'], sq: ['snd/sq1.mp3', 'snd/sq2.mp3', 'snd/sq3.mp3'], chu: 'snd/chu.mp3', kick: ['snd/kick.mp3', 'snd/kick2.mp3'], grunt: ['snd/grunt1.mp3', 'snd/grunt2.mp3'], fall: 'snd/fall.mp3', eat: 'snd/eat.mp3', uguisu: 'snd/uguisu.mp3', click: 'snd/click.mp3', j_good: 'snd/j_good.mp3', j_bad: 'snd/j_bad.mp3', j_rare: 'snd/j_rare.mp3' })
Snd.muted = LS.get('mute', '0') === '1' || Q.get('mute') === '1'
function startAudio() {
  Snd.init()
  if (Snd.ctx && !Snd.loops.roll) { Snd.loop('roll', 'snd/roll.mp3', 0.0001, 0.3); Snd.loop('wind', 'snd/wind.wav', 0.0001, 0.6); Snd.loop('birds', 'snd/birds.mp3', 0.22, 1.5); Snd.loop('bgm', 'snd/bgm.mp3', 0.15, 1.5) }
}
function loopVol(slot, v, tc = 0.15) { const L = Snd.loops[slot]; if (L && L.node && Snd.ctx) L.g.gain.setTargetAtTime(Math.max(0.0001, v), Snd.ctx.currentTime, tc) }
function setMuteIcons() { for (const b of [$('bMute'), $('bMute2')]) { b.querySelector('.wave').style.display = Snd.muted ? 'none' : ''; b.querySelector('.x').style.display = Snd.muted ? '' : 'none' } }
for (const b of [$('bMute'), $('bMute2')]) b.onclick = e => { e.stopPropagation(); startAudio(); Snd.setMute(!Snd.muted); LS.set('mute', Snd.muted ? '1' : '0'); setMuteIcons() }

// ------------------------------------------------------------ 状態
const G = { state: 'load', run: null, mode: 'kind', inp: {}, imp: { push: 0, lat: 0 }, swipes: 0, keys: new Set(), drag: null, acc: 0, last: 0, prev: null, camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), camDir: new THREE.Vector3(0, 0, 1), shake: 0, bubQ: [], bub: null, introT: 0, endT: 0, end: null, zukan: {}, paused: false, bot: null, tutDone: false, sec: '', mouseSay: 0, seed: 1 }
window.omu = G
try { G.zukan = JSON.parse(LS.get('zukan', '{}')) } catch (e) { G.zukan = {} }
G.tutDone = LS.get('tut', '0') === '1'
let W = null, oni = null, P = null, leaves = null, gpa = null, gpaG = null, baba = null, babaG = null
const HV = [] // 穴の見た目

// ------------------------------------------------------------ 読み込み
let ldN = 0; const ldMax = 4 + 4
function ldStep() { ldN++; $('ldBar').firstElementChild.style.width = Math.min(100, ldN / ldMax * 100) + '%' }
async function boot() {
  applyLang()
  await loadTextures(V, ldStep)
  W = buildWorld(scene); ldStep()
  oni = makeOnigiri(); scene.add(oni)
  P = makeParticles(scene, lowEnd ? 500 : 800); P.pts.material.uniforms.scale.value = innerHeight * 0.75
  leaves = makeLeaves(scene, lowEnd ? 30 : 60)
  gpaG = new THREE.Group(); scene.add(gpaG)
  babaG = new THREE.Group(); babaG.position.set(YARD.house.x - 1.2, height(YARD.house.x, YARD.house.z) + 0.7, YARD.house.z - 3.6); babaG.rotation.y = Math.PI; scene.add(babaG)
  baba = new Person(babaG, { look: 'baba', anim: 'sit', scale: 1.05 })
  ldStep(); ldStep(); ldStep()
  setupRun(1, 'kind'); camTitle(true)
  enter('title')
  renderer.compile(scene, camera)
  window.__omuReady = true
  setTimeout(() => { loadLaterTextures(V); loadChars(V) }, 50)
  const l = $('loading'); l.style.opacity = '0'; l.style.pointerEvents = 'none'; setTimeout(() => l.remove(), 450)
  // 検査用: ?auto=kind|greedy&bot=human で自動で始めて最後まで遊ぶ（シミュレーター用。音は ?mute=1 で切る）
  if (Q.get('auto')) setTimeout(() => { startRun(+(Q.get('seed') || 3), Q.get('auto') === 'greedy' ? 'greedy' : 'kind'); G.bot = makeBot(Q.get('bot') || 'human', 3); setTimeout(beginPlay, 2500) }, 1500)
}
setTimeout(() => { const l = $('loading'); if (l && G.state === 'load') l.style.opacity = '0' }, 12000)

// ------------------------------------------------------------ 言葉
function applyLang() {
  document.documentElement.lang = lang
  if ($('ldTxt')) $('ldTxt').textContent = t('loading')
  $('tH1').textContent = t('title1'); $('tH2').textContent = t('title2'); $('tK').innerHTML = t('titleK'); $('tPick').textContent = t('pick')
  $('bKindT').innerHTML = t('modeKind'); $('bKindTag').textContent = t('modeKindTag'); $('bGreedyT').innerHTML = t('modeGreedy'); $('bGreedyTag').textContent = t('modeGreedyTag')
  $('bHow').textContent = t('how'); $('bLang').textContent = t('lang')
  $('bAgain').textContent = t('again'); $('bOther').textContent = t('other'); $('bSave').textContent = t('save'); $('bPost').textContent = t('post'); $('bZukan2').textContent = t('toZukan'); $('bBack').textContent = t('back')
  $('howH').textContent = t('howH'); $('howBody').innerHTML = t('howBody').map(s => `<li>${s}</li>`).join(''); $('howCred').textContent = t('howCred'); $('howClose').textContent = t('close')
  $('zH').textContent = t('zukanH'); $('zClose').textContent = t('close')
  $('tutT').textContent = isTouch ? t('tutSP') : t('tutPC')
  refreshTitle(); setMuteIcons(); drawEmaki()
}
function zCount() { return ENDINGS.filter(e => G.zukan[e.key]).length }
function refreshTitle() {
  $('bZukan').innerHTML = `${t('zukan')} <b>${t('zcount')(zCount(), ENDINGS.length)}</b>`
  const best = +LS.get('best', 0); $('tBest').textContent = best > 0 ? t('best')(best) : ''
}
function openZukan() {
  $('zGrid').innerHTML = ENDINGS.map(e => { const got = G.zukan[e.key]; return `<div class="z ${got ? '' : 'no'} ${e.rare ? 'rare' : ''} ${got && e.stamp === 'good' ? 'good' : ''}"><b>${got ? t('endName')[e.key] : t('unknown')}</b><i>${t('endHint')[e.key]}</i></div>` }).join('')
  $('zukan').hidden = false
}
$('bHow').onclick = () => { Snd.play('click', { vol: 0.5 }); $('how').hidden = false }
$('howClose').onclick = () => { $('how').hidden = true }
$('bZukan').onclick = $('bZukan2').onclick = () => { Snd.play('click', { vol: 0.5 }); openZukan() }
$('zClose').onclick = () => { $('zukan').hidden = true }
$('bLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; LS.set('lang', lang); applyLang() }

// ------------------------------------------------------------ 画面の切り替え
function enter(s) {
  G.state = s
  $('vTitle').hidden = s !== 'title'
  $('vPlay').hidden = !(s === 'intro' || s === 'play' || s === 'ending')
  $('vEnd').hidden = s !== 'result'
  $('vPlay').classList.toggle('cine', s === 'ending' || s === 'intro')
  if (s !== 'play' && s !== 'intro') hideBub()
  if (s === 'title') refreshTitle()
}
$('bKind').onclick = () => go('kind')
$('bGreedy').onclick = () => go('greedy')
$('bAgain').onclick = () => go(G.mode)
$('bOther').onclick = () => go(G.mode === 'kind' ? 'greedy' : 'kind')
$('bBack').onclick = () => { Snd.play('click', { vol: 0.5 }); setupRun(G.seed, 'kind'); camTitle(true); enter('title') }
function go(mode) {
  startAudio(); Snd.play('click', { vol: 0.6 })
  const seed = Q.get('seed') ? +Q.get('seed') : (Date.now() % 100000) + 1
  startRun(seed, mode)
}

// ------------------------------------------------------------ 1回ぶんの準備
function setupRun(seed, mode) {
  G.seed = seed; G.mode = mode
  G.run = newRun(seed, { mode })
  // 穴を作り直す
  for (const H of HV) scene.remove(H.g)
  HV.length = 0
  for (const h of G.run.holes) HV.push(makeHole(scene, h))
  // おじいさん
  if (gpa) gpaG.remove(gpa.root)
  gpaAlpha = 1
  gpa = new Person(gpaG, { look: mode, anim: mode === 'kind' ? 'sit' : 'idle', scale: 1.15 })
  const r = G.run
  gpaG.position.set(r.g.x, height(r.g.x, r.g.z), r.g.z)
  gpaG.rotation.set(0, mode === 'kind' ? -0.7 : 0.1, 0); gpaG.scale.setScalar(1)
  gpaG.userData = { sink: 0 }
  oni.scale.setScalar(START_R); oni.userData.mat.userData.u.mud.value = 0
  oni.setFace('calm')
  if (mode === 'kind') { oni.position.set(cx(-4.5) + 1.6 + 0.1, height(cx(-4.5) + 1.6, -4.5) + 0.45 + supportH(START_R, 0) + 0.02, -4.4); oni.userData.spin.rotation.x = 0 }
  else placeOni()
  G.end = null; G.endT = 0; if (G.tamaG) { scene.remove(G.tamaG); G.tamaG = null } G.tama = null; G.wearShown = 0; G.prev = null; G.acc = 0; G.sec = ''; G.inp = {}; G.imp.push = 0; G.imp.lat = 0; G.swipes = 0; G.drag = null
  G.camDir.set(0, 0, 1); grade.uniforms.dark.value = 0
  babaG.visible = true; baba.play('sit')
  drawEmaki()
}
function startRun(seed, mode) {
  setupRun(seed, mode)
  G.introT = 0; enter('intro')
  $('introT').textContent = t('intro')[mode]; $('introS').textContent = t('tap')
  $('intro').classList.add('on')
  $('tut').style.opacity = G.tutDone ? '0' : '1'
  if (mode === 'greedy') { gpa.play('idle'); say(t('bub').gStart, 'gpa', { extra: 0.8 }) }
  if (window.TM) TM.start()
}
function beginPlay() {
  if (G.state !== 'intro') return
  $('intro').classList.remove('on')
  const r = G.run
  if (G.mode === 'kind') { placeOni(); dust(oni.position, 8); Snd.play('wood', { vol: 0.5 }); say(t('bub').kStart, 'gpa') }
  else { gpa.play('attack-kick-right', true); Snd.play('kick', { vol: 0.7 }) }
  enter('play')
  G.prev = null
  camSnap()
}

// ------------------------------------------------------------ 入力: 指ではじく（前へはじくと転がる・斜めにはじくと曲がる）
// 1回のスワイプ = 1回の押し。画面の上 = 前、右 = 右。速くはじくほど少し強い
function swipe(dx, dy, ms) {
  const d = Math.hypot(dx, dy), unit = Math.min(130, innerWidth * 0.3)
  const spd = clamp(0.8 + (d / Math.max(16, ms)) * 0.22, 0.8, 1.25)
  const push = clamp(-dy / unit, 0, 1) * spd, lat = clamp(dx / unit, -1, 1) * spd
  G.imp.push = Math.min(1.3, G.imp.push + push); G.imp.lat = clamp(G.imp.lat + lat, -1.3, 1.3)
  G.swipes++
}
const KEYS = { ArrowUp: [0.9, 0], w: [0.9, 0], W: [0.9, 0], ArrowLeft: [0, -0.7], a: [0, -0.7], A: [0, -0.7], ArrowRight: [0, 0.7], d: [0, 0.7], D: [0, 0.7] }
addEventListener('keydown', e => {
  if (e.key in KEYS && G.state === 'play') { const [p, l] = KEYS[e.key]; G.imp.push = Math.min(1.3, G.imp.push + p); G.imp.lat = clamp(G.imp.lat + l, -1.3, 1.3); G.swipes++; e.preventDefault() }
  if ((e.key === ' ' || e.key === 'Enter') && G.state === 'intro') beginPlay()
})
const cv = renderer.domElement
cv.addEventListener('pointerdown', e => { if (G.state === 'intro') { beginPlay() } if (G.state !== 'play' && G.state !== 'intro') return; G.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now() }; try { cv.setPointerCapture(e.pointerId) } catch (er) {} })
cv.addEventListener('pointermove', e => {
  const D = G.drag; if (!D || e.pointerId !== D.id) return
  const dx = e.clientX - D.x0, dy = e.clientY - D.y0
  // 指を離さずに続けてなぞっても、70px ごとに1回はじいたことにする
  if (Math.hypot(dx, dy) > 70) { swipe(dx, dy, performance.now() - D.t0); D.x0 = e.clientX; D.y0 = e.clientY; D.t0 = performance.now(); D.used = 1 }
})
const endDrag = e => { const D = G.drag; if (!D || e.pointerId !== D.id) return; const dx = e.clientX - D.x0, dy = e.clientY - D.y0; if (Math.hypot(dx, dy) > 20) swipe(dx, dy, performance.now() - D.t0); G.drag = null }
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', e => { G.drag = null })
$('vPlay').addEventListener('pointerdown', e => { if (G.state === 'intro' && !e.target.closest('button')) beginPlay() })
function readInput() {
  if (G.forceInp) return G.forceInp
  if (G.bot) return G.bot(G.run)
  if (!G.imp.push && !G.imp.lat) return {}
  const r = { push: G.imp.push, lat: G.imp.lat }; G.imp.push = 0; G.imp.lat = 0; return r
}

// ------------------------------------------------------------ おむすびを置く・動かす
function placeOni() {
  const o = G.run.o, r = o.r
  oni.scale.setScalar(r)
  oni.position.set(o.x, o.y || height(o.x, o.z), o.z)
  oni.position.y = height(o.x, o.z) + supportH(r, o.ang)
}
function oniVisual(alpha) {
  const o = G.run.o, p = G.prev
  const x = p ? p.x + (o.x - p.x) * alpha : o.x, z = p ? p.z + (o.z - p.z) * alpha : o.z, ang = p ? p.ang + (o.ang - p.ang) * alpha : o.ang
  const r = o.r
  oni.scale.setScalar(r)
  oni.position.set(x, height(x, z) + supportH(r, ang) + o.bump * 0.12 * Math.abs(Math.sin(G.run.t * 30)), z)
  // 進む向きに向ける（横に回すと向きが変わる）
  const sp = Math.hypot(o.vx, o.vz)
  if (sp > 0.3) { const yaw = Math.atan2(o.vx, o.vz) + 0.5; oni.rotation.y += ((yaw - oni.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 0.25 } // 少しカメラの方へ向けて三角の面を見せる
  oni.userData.spin.rotation.x = ang
  // 削れた分だけ、うしろに米粒がこぼれる（0.0005 ごとに1粒）
  const wr = G.run.st.wear || 0
  if (wr - (G.wearShown || 0) > 0.0005) { G.wearShown = wr; crumb(oni.position, o.r); checkSize() }
}
function crumb(p, r) { const a = Math.random() * 6.28; P.emit(p.x + Math.cos(a) * r * 0.5, p.y - r * 0.6, p.z + Math.sin(a) * r * 0.5, Math.cos(a) * 0.4, 0.6 + Math.random() * 0.6, Math.sin(a) * 0.4, 0.9 + Math.random() * 0.4, 0.04 + Math.random() * 0.025, [1, 0.99, 0.95], 1.2, 9, 0) }

// ------------------------------------------------------------ カメラ
function camSnap() { const o = oni.position; G.camPos.set(o.x, o.y + 1.8, o.z - 4); G.camLook.set(o.x, o.y, o.z + 3); camera.position.copy(G.camPos); camera.lookAt(G.camLook) }
function camTitle(snap) {
  // タイトル: 畑の切り株とおむすび、ふもとへ続く道
  const x = cx(-4) + 1.6
  G.camPos.set(x - 2.6, height(x, -4) + 1.3, -7.6); G.camLook.set(x + 0.2, height(x, -4) + 0.6, -3.5)
  if (snap) { camera.position.copy(G.camPos); camera.lookAt(G.camLook) }
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3()
function camFollow(dt) {
  const o = G.run.o, r = o.r
  const sp = Math.hypot(o.vx, o.vz)
  // カメラはコースの向きの真後ろ。スワイプの左右（phys.js はコースの向き基準）と画面の左右をそろえる
  { const dcx = (cx(o.z + 1) - cx(o.z - 1)) / 2, fl = Math.hypot(dcx, 1); _v.set(dcx / fl, 0, 1 / fl); G.camDir.lerp(_v, 1 - Math.exp(-dt * 2.5)).normalize() }
  const narrow = innerWidth / innerHeight < 0.6 ? 1.1 : 1
  const dist = (2.7 + r * 4 + sp * 0.05) * narrow, up = 2.3 + r * 2.8
  const op = oni.position
  // 真後ろから見る（2026-11-20 本人「斜め後ろは操作しづらい」）。三角の面は、おむすびの向きを少しずらして見せる
  _w.set(op.x - G.camDir.x * dist, 0, op.z - G.camDir.z * dist)
  _w.y = Math.max(height(_w.x, _w.z) + 0.6, op.y + up)
  G.camPos.lerp(_w, 1 - Math.exp(-dt * 6))
  _v.set(op.x + G.camDir.x * 2.6, op.y - 0.1, op.z + G.camDir.z * 2.6)
  G.camLook.lerp(_v, 1 - Math.exp(-dt * 8))
  camera.position.copy(G.camPos)
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake; camera.position.y += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt * 1.6) }
  camera.lookAt(G.camLook)
  camera.fov += ((62 + Math.min(10, sp * 0.6)) - camera.fov) * (1 - Math.exp(-dt * 3)); camera.updateProjectionMatrix()
}
function camTo(pos, look, dt, k = 2.5) { G.camPos.lerp(pos, 1 - Math.exp(-dt * k)); G.camPos.y = Math.max(G.camPos.y, height(G.camPos.x, G.camPos.z) + 0.8); G.camLook.lerp(look, 1 - Math.exp(-dt * k)); camera.position.copy(G.camPos); camera.lookAt(G.camLook) }

// ------------------------------------------------------------ 吹き出し（1つずつ）
function say(text, who, o = {}) { if (G.bubQ.length > 1) return; G.bubQ.push({ text, who, mouse: !!o.mouse, pos: o.pos ? o.pos.clone() : null, ttl: 0.9 + text.length * 0.09 + (o.extra || 0) }) }
function hideBub() { $('bub').classList.remove('on'); G.bub = null; G.bubQ.length = 0 }
function updateBub(dt) {
  if (!G.bub && G.bubQ.length) { G.bub = G.bubQ.shift(); const el = $('bub'); el.textContent = G.bub.text; el.className = G.bub.mouse ? 'mouse on' : 'on' }
  if (!G.bub) return
  G.bub.ttl -= dt; if (G.bub.ttl <= 0) { $('bub').classList.remove('on'); G.bub = null; return }
  if (G.bub.who === 'gpa') _v.copy(gpaG.position).add(_w.set(0, 1.55, 0)); else if (G.bub.pos) _v.copy(G.bub.pos); else _v.copy(oni.position).add(_w.set(0, 0.8, 0))
  _v.project(camera)
  const el = $('bub'), vis = _v.z < 1, hw = el.offsetWidth / 2 + 8
  const x = clamp((_v.x * 0.5 + 0.5) * innerWidth, hw, innerWidth - hw), y = clamp((-_v.y * 0.5 + 0.5) * innerHeight - 6, 110, innerHeight - 140)
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.opacity = vis ? '' : '0'
}
function pop(text, red) { const el = $('pop'); el.textContent = text; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); el.classList.toggle('red', !!red) }

// ------------------------------------------------------------ 上の絵巻
function drawEmaki() {
  const s = $('emakiSvg'); if (!s) return
  let d = 'M0 26'; for (let i = 1; i <= 30; i++) { const x = i * 10, y = 26 - 8 * Math.sin(i / 30 * Math.PI) + 3 * Math.sin(i * 1.3); d += ` L${x} ${y.toFixed(1)}` }
  const ticks = SECTIONS.slice(1, 5).map(q => { const x = (q.s0 / S_END * 300).toFixed(1); return `<line x1="${x}" y1="4" x2="${x}" y2="34" stroke="rgba(107,82,54,.25)" stroke-width="1"/>` }).join('')
  s.innerHTML = `${ticks}<path d="${d}" stroke="#a08a66" stroke-width="2.4" fill="none" stroke-dasharray="1 4" stroke-linecap="round"/>
<text class="lbl" x="2" y="12">${t('strip').start}</text><text class="lbl" x="298" y="12" text-anchor="end">${t('strip').end}</text>
<g id="emG"><circle r="5" fill="#8a4a2a" stroke="#3a2412" stroke-width="1.5"/></g>
<g id="emO"><path d="M0 -8 C3 -8 9 2 9 4 C9 7 7 7.5 0 7.5 C-7 7.5 -9 7 -9 4 C-9 2 -3 -8 0 -8Z" fill="#fff" stroke="#2a2320" stroke-width="1.5"/><path d="M-5 7.5 L-4 2 L4 2 L5 7.5Z" fill="#26301f"/></g>`
}
function emakiY(x) { const i = x / 10; return 26 - 8 * Math.sin(i / 30 * Math.PI) + 3 * Math.sin(Math.round(i) * 1.3) }
function updateEmaki() {
  const o = G.run.o, g = G.run.g
  const ox = clamp(o.z / S_END, 0, 1) * 300, gx = clamp(g.z / S_END, 0, 1) * 300
  const eo = $('emO'), eg = $('emG'); if (!eo) return
  eo.setAttribute('transform', `translate(${ox.toFixed(1)} ${(emakiY(ox) - 4).toFixed(1)})`)
  eg.setAttribute('transform', `translate(${gx.toFixed(1)} ${(emakiY(gx) - 2).toFixed(1)})`)
  eg.style.display = g.st === 'gone' ? 'none' : ''
}

// ------------------------------------------------------------ 出来事
function onEvent(e) {
  (G.evLog || (G.evLog = [])).push(e.k)
  const r = G.run, o = r.o, B = t('bub'), PP = t('pop')
  switch (e.k) {
    case 'bump': {
      if (e.kind === 'rock') { Snd.play('rock', { vol: clamp(0.4 + e.sp * 0.08, 0.4, 1) }); G.shake = 0.12; oni.setFace('dizzy'); G.faceT = 0.8; riceBurst(oni.position, 10 + e.sp * 2); if (e.dr < -0.015) pop(PP.chip, true); checkSize() }
      else Snd.play('wood', { vol: 0.6 })
      break
    }
    case 'over': Snd.play('wood', { vol: 0.8, rate: 0.8 }); G.shake = 0.08; pop(PP.over); dust(oni.position, 8); break
    case 'edge': pop(PP.edge, true); oni.setFace('scared'); G.faceT = 0.9; Snd.play('sq', { vol: 0.5 }); break
    case 'fall': { Snd.play('fall', { vol: 0.9 }); Snd.play('chu', { vol: 0.8, delay: 0.5 }); Snd.duck(0.3, 2.5); oni.setFace('scared'); break }
    case 'dig': { const H = HV.find(q => q.h.i === e.h) || addHoleVisual(r.holes[e.h]); H.dig = 1; Snd.play('sq', { vol: 0.7 }); say(B.mDig, null, { mouse: 1, pos: _w.set(H.h.x, height(H.h.x, H.h.z) + 0.6, H.h.z) }); break }
    case 'gRun': gpa.play('sprint', true); say(G.mode === 'kind' ? B.kRun : B.gRun, 'gpa'); break
    case 'gTrip': gpa.play('fall', true); Snd.play('grunt', { vol: 0.7 }); say(G.mode === 'kind' ? B.kTrip : B.gTrip, 'gpa'); break
    case 'windup': gpa.play('attack-kick-right', true, 0.55); say(B.gWindup, 'gpa'); oni.setFace('scared'); G.faceT = 0.7; break
    case 'kick': Snd.play('kick', { vol: 1 }); G.shake = 0.25; dust(oni.position, 14); say(B.gKick, 'gpa'); break
    case 'whiff': gpa.play('fall', true); Snd.play('grunt', { vol: 0.8 }); say(B.gWhiff, 'gpa'); pop(PP.dodge); break
    case 'gFall': Snd.play('fall', { vol: 0.9 }); Snd.play('grunt', { vol: 0.9, delay: 0.15 }); gpaG.position.set(G.run.g.x, height(G.run.g.x, G.run.g.z), G.run.g.z); break
    case 'gCatch': gpa.play('pick-up', true); break
    case 'stop': pop(t('pop').stop, true); oni.setFace('scared'); G.faceT = 99; say(G.mode === 'kind' ? B.kStop : B.gStop, 'gpa'); break
    case 'push': if (e.push > 0.2) dust(oni.position, 3); if (G.faceT > 50) { G.faceT = 0.01 } break
    case 'digGiveUp': say(B.mSad, null, { mouse: 1 }); break
    case 'end': startEnding(e.key); break
  }
}
let lastR = START_R
function checkSize() { const r = G.run.o.r; if (r < 0.25 && lastR >= 0.25 || r < 0.2 && lastR >= 0.2) pop(t('pop').small, true); if (r > 0.38 && lastR <= 0.38 || r > 0.48 && lastR <= 0.48) pop(t('pop').big); lastR = r }
function riceBurst(p, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 1.5 + Math.random() * 3; P.emit(p.x, p.y, p.z, Math.cos(a) * v, 2 + Math.random() * 3, Math.sin(a) * v, 0.8 + Math.random() * 0.5, 0.05 + Math.random() * 0.04, [1, 0.99, 0.95], 1.2, 9, 0) } }
function dust(p, n, c = [0.55, 0.45, 0.34]) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 0.4 + Math.random() * 1.2; P.emit(p.x + Math.cos(a) * 0.15, p.y - 0.15, p.z + Math.sin(a) * 0.15, Math.cos(a) * v, 0.4 + Math.random() * 0.8, Math.sin(a) * v, 0.6 + Math.random() * 0.5, 0.07 + Math.random() * 0.08, c, 2, 0.5, 1.2) } }
function addHoleVisual(h) { const H = makeHole(scene, h); HV.push(H); return H }

// ------------------------------------------------------------ 穴とねずみ・おじいさんの見た目
function updateHoles(dt) {
  const r = G.run, o = r.o
  let sayDone = false
  for (const H of HV) {
    const h = H.h, dz = h.z - o.z
    // 掘っている穴: 開くまで土を噴き、だんだん大きく
    const open = holeOpen(r, h)
    if (!open) { const k = clamp(1 - (h.t0 - r.t) / 0.95, 0, 1); H.g.scale.setScalar(Math.max(0.001, k)); if (Math.random() < 0.6) dust(_w.set(h.x, height(h.x, h.z) + 0.1, h.z), 2, [0.45, 0.35, 0.25]) }
    else if (H.g.scale.x < 1) H.g.scale.setScalar(Math.min(1, H.g.scale.x + dt * 3))
    H.g.visible = dz > -8 && dz < 70
    if (!H.g.visible) continue
    // ねずみ: 入ってしまう大きさなら顔を出して手まねき、入らなければ引っこんでしょんぼり
    const fits = o.r < h.hr, near = dz > -2 && dz < 26
    const want = G.end && (((G.end.key === 'korin' || G.end.key === 'kicked') && G.end.h === h.i) || ((G.end.key === 'picked' || G.end.key === 'thrown') && G.dropH === h)) ? 1.25 : (fits && near ? 1 : 0.25)
    H.mood += (want - H.mood) * (1 - Math.exp(-dt * 4))
    H.ph += dt * (fits ? 9 : 2)
    const m = H.mouse, u = m.userData, hop = want > 1 ? Math.abs(Math.sin(H.ph * 0.9)) * 0.25 : 0
    m.position.y = -0.3 + H.mood * 0.3 + hop
    u.armL.rotation.z = -0.6 - (fits ? 1.2 + Math.sin(H.ph) * 0.8 : 0.1); u.armR.rotation.z = 0.6 + (fits ? 1.2 + Math.sin(H.ph + 1) * 0.8 : 0.1)
    u.earL.rotation.z = fits ? 0.3 : -0.4; u.earR.rotation.z = fits ? -0.3 : 0.4
    u.head.rotation.x = fits ? Math.sin(H.ph * 0.5) * 0.15 : 0.35
    // ねずみはおむすびの方を向く
    m.rotation.y = Math.atan2(o.x - h.x, o.z - h.z) - H.g.rotation.y
    if (!sayDone && fits && dz > 6 && dz < 11 && r.t > G.mouseSay && G.state === 'play') { sayDone = true; G.mouseSay = r.t + 4.5; say(t('bub').mBeckon, null, { mouse: 1, pos: _w.set(h.x, height(h.x, h.z) + 0.55, h.z) }); Snd.play('chu', { vol: 0.35, rate: 1.2 }) }
  }
}
let gpaAlpha = 1
function fadeGpa(a, dt) {
  const na = gpaAlpha + (a - gpaAlpha) * Math.min(1, dt * 8); if (Math.abs(na - gpaAlpha) < 0.002) return; gpaAlpha = na
  gpaG.traverse(n => { if (n.isMesh) { n.material.transparent = gpaAlpha < 0.99; n.material.opacity = gpaAlpha; n.material.depthWrite = gpaAlpha > 0.99 } })
}
function updateGpa(dt) {
  const g = G.run.g
  if (G.state === 'intro') { gpa.update(dt); return }
  if (g.st === 'wait') { gpa.update(dt); return }
  const gx = g.x, gz = g.z
  if (g.st !== 'gone') {
    const gy = height(gx, gz)
    gpaG.position.x += (gx - gpaG.position.x) * Math.min(1, dt * 20); gpaG.position.z += (gz - gpaG.position.z) * Math.min(1, dt * 20)
    gpaG.position.y = gy
    const o = G.run.o, yaw = Math.atan2(o.x - gx, o.z - gz)
    gpaG.rotation.y += ((yaw - gpaG.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8)
    if (g.st === 'run' && gpa.anim !== 'sprint' && !(gpa.act && gpa.act.isRunning() && /fall|kick|pick/.test(gpa.anim))) gpa.play('sprint')
    if (gpa.anim === 'sprint' && gpa.act) gpa.act.timeScale = clamp(g.v / 6, 0.6, 1.6)
    // 尻すべりで追いつく時は寝そべる
    gpaG.rotation.x = g.slide ? -1.1 : 0
    if (g.slide && Math.random() < 0.3) dust(gpaG.position, 1)
    // カメラの近くに来たら透かす（おむすびと穴が隠れないように）
    if (G.state === 'play') fadeGpa(gpaG.position.distanceTo(camera.position) < 2.8 ? 0.3 : 1, dt)
  } else {
    // 頭から穴にはまって、足だけ出てじたばた
    const u = gpaG.userData; u.sink = Math.min(1, u.sink + dt * 2.2)
    gpaG.rotation.x = Math.PI * u.sink; gpaG.rotation.z = Math.sin(performance.now() / 90) * 0.12 * u.sink
    gpaG.position.y = height(gpaG.position.x, gpaG.position.z) + 0.62 * u.sink
    if (gpa.anim !== 'sprint') gpa.play('sprint', true, 2.2)
  }
  gpa.update(dt)
}

// ------------------------------------------------------------ 結末
function startEnding(key) {
  G.end = { key, ...G.run.end }
  G.endT = 0
  enter('ending')
  const B = t('bub')
  hideBub()
  if (key === 'korin' || key === 'kicked') { say(B.mSing, null, { mouse: 1, pos: _w.set(G.run.o.x, height(G.run.o.x, G.run.o.z) + 0.7, G.run.o.z), extra: 1 }); Snd.play('sq', { vol: 0.8, delay: 0.9 }); Snd.play('sq', { vol: 0.7, delay: 1.3 }) }
  else if (key === 'greedyKorin' || key === 'kindKorin') { Snd.play('sq', { vol: 0.8, delay: 0.6 }) }
  else if (key === 'picked' || key === 'thrown') {
    // 拾ったおむすびを落とす穴: 近くて、入る大きさの穴（無ければ一番近い穴）
    // 近く（5m 以内）に入る大きさの穴があればそこ。無ければ、ねずみがその場で掘る
    const gp = gpaG.position, r = G.run.o.r; let best = null, bd = 5
    for (const h of G.run.holes) { if (!holeOpen(G.run, h) || h.hr <= r) continue; const d = Math.hypot(h.x - gp.x, h.z - gp.z); if (d < bd) { bd = d; best = h } }
    if (!best) {
      const fx = Math.sin(gpaG.rotation.y), fz = Math.cos(gpaG.rotation.y), hz = gp.z + fz * 1.6, w = widths(hz)
      const hx = cx(hz) + clamp(gp.x + fx * 1.6 - cx(hz), -(w.road - 0.5), w.road - 0.5)
      best = { x: hx, z: hz, hr: Math.min(0.52, Math.max(0.22, r + 0.07)), size: 'mid', t0: 0, i: G.run.holes.length, dug: 1 }
      G.run.holes.push(best)
      const H = addHoleVisual(best); H.g.scale.setScalar(0.05)
      say(t('bub').mDig, null, { mouse: 1, pos: _w.set(hx, height(hx, hz) + 0.6, hz) }); Snd.play('sq', { vol: 0.7, delay: 0.3 })
    } else if (!HV.find(H => H.h === best)) addHoleVisual(best)
    G.dropH = best; G.dropSaid = 0; G.dropFx = 0
  }
  else { say(B.baba, null, { pos: _w.set(babaG.position.x, babaG.position.y + 1.3, babaG.position.z), extra: 0.5 }); Snd.play('eat', { vol: 0.9, delay: 1.6 }) }
  if (key.startsWith('eaten') || key === 'greedyKorin') oni.setFace('happy')
}
function updateEnding(dt) {
  G.endT += dt
  if (G.tama) { updateTama(dt); return }
  const k = G.end.key, o = G.run.o
  if (k === 'korin' || k === 'kicked') {
    // 穴に吸いこまれる
    const s = Math.min(1, G.endT / 0.9)
    oni.position.y = height(o.x, o.z) + supportH(o.r, o.ang) - s * s * o.r * 3.2
    oni.userData.spin.rotation.x += dt * 10 * (1 - s)
    _v.set(o.x - G.camDir.x * 1.6, height(o.x, o.z) + 2.4, o.z - G.camDir.z * 1.6); _w.set(o.x, height(o.x, o.z) - 0.3, o.z)
    camTo(_v, _w, dt, 3)
    grade.uniforms.dark.value = clamp((G.endT - 1.6) / 1.4, 0, 0.35)
  } else if (k === 'greedyKorin' || k === 'kindKorin') {
    _v.set(gpaG.position.x + 1.8, height(gpaG.position.x, gpaG.position.z) + 1.5, gpaG.position.z + 2.4); _w.set(gpaG.position.x, height(gpaG.position.x, gpaG.position.z) + 0.4, gpaG.position.z)
    fadeGpa(1, 1)
    camTo(_v, _w, dt, 2.2)
    oniVisualStop(dt)
  } else if (k === 'picked' || k === 'thrown') {
    // 拾って、いちばん近い穴まで歩いて、落とす
    const h = G.dropH, gp = gpaG.position
    const hand = _w.copy(gp).add(_v.set(Math.sin(gpaG.rotation.y) * 0.35, 1.05, Math.cos(gpaG.rotation.y) * 0.35))
    if (G.endT < 0.8) { oni.position.lerp(hand, Math.min(1, dt * 6)) }
    else if (G.endT < 2.4 && h) {
      // 穴のふちまで歩く
      const tx = h.x - Math.sin(gpaG.rotation.y) * 0.6, tz = h.z - Math.cos(gpaG.rotation.y) * 0.6, dx = tx - gp.x, dz = tz - gp.z, d = Math.hypot(dx, dz)
      if (d > 0.05) { const st = Math.min(d, dt * 2.6); gp.x += dx / d * st; gp.z += dz / d * st; gp.y = height(gp.x, gp.z); gpaG.rotation.y = Math.atan2(h.x - gp.x, h.z - gp.z); if (gpa.anim !== 'walk') gpa.play('walk', true) }
      else if (gpa.anim !== 'idle') { gpa.play('idle', true); if (!G.dropSaid) { G.dropSaid = 1; say(G.mode === 'kind' ? t('bub').kDrop : t('bub').gKick, 'gpa') } }
      oni.position.lerp(hand, Math.min(1, dt * 8))
    } else if (h) {
      // 落ちる
      const s2 = Math.min(1, (G.endT - 2.4) / 0.6)
      _w.set(h.x, height(h.x, h.z) + 0.9 * (1 - s2) - s2 * s2 * 0.8, h.z)
      oni.position.lerp(_w, Math.min(1, dt * 10)); oni.userData.spin.rotation.x += dt * 8
      if (!G.dropFx && s2 > 0.6) { G.dropFx = 1; Snd.play('fall', { vol: 0.9 }); Snd.play('sq', { vol: 0.8, delay: 0.3 }); say(t('bub').mSing, null, { mouse: 1, pos: _v.set(h.x, height(h.x, h.z) + 0.7, h.z) }) }
    }
    // 横から見る。道の真ん中の側に立つ（土手に埋まらない）
    const mx = (gp.x + (h ? h.x : gp.x)) / 2, mz = (gp.z + (h ? h.z : gp.z)) / 2, side = cx(mz) - mx >= 0 ? 1 : -1
    _v.set(mx + side * 3.2, height(mx, mz) + 2.0, mz - 1.4); _w.set(mx, height(mx, mz) + 0.6, mz)
    fadeGpa(1, 1)
    camTo(_v, _w, dt, 2.5)
    gpa.update(dt)
    if (G.endT > 3.8) startTama()
    return
  } else {
    // ふもとの家: 庭で止まって、家ごと見せる
    oniVisualStop(dt)
    if (k === 'oomusubi') oni.scale.setScalar(o.r * (1 + Math.min(0.4, G.endT * 0.15)))
    if (k === 'hitokuchi' && G.endT > 1.5) oni.scale.setScalar(o.r * Math.max(0.2, 1 - (G.endT - 1.5) * 0.6))
    _v.set(o.x - 3.2, height(o.x, o.z) + 2.4, o.z - 6.5); _w.set((o.x + YARD.house.x) / 2, height(o.x, o.z) + 1.0, o.z + 3.5)
    camTo(_v, _w, dt, 1.6)
    if (gpa && G.run.g.st !== 'gone') { const g = G.run.g; g.x += (o.x - 0.9 - g.x) * dt * 1.5; g.z += (o.z - 1.2 - g.z) * dt * 1.5; if (Math.hypot(o.x - g.x, o.z - g.z) < 1.6 && gpa.anim === 'sprint') gpa.play('idle') }
  }
  updateGpa(dt)
  if (G.endT > 3.2) startTama()
}
function oniVisualStop(dt) { const o = G.run.o; oni.position.y = height(oni.position.x, oni.position.z) + supportH(o.r, o.ang); const want = Math.atan2(camera.position.z - oni.position.z, -(camera.position.x - oni.position.x)); oni.rotation.y += ((want - oni.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 3); oni.userData.spin.rotation.x += (Math.round(oni.userData.spin.rotation.x / 2.0944) * 2.0944 - oni.userData.spin.rotation.x) * Math.min(1, dt * 4) }


// ------------------------------------------------------------ 結末のあと: ねずみがつづらを持ってくる（中身はランダム）
function pickTama(stampKind) {
  if (G.forceTama) return TAMA.find(q => q.key === G.forceTama) || TAMA[0]
  const tot = TAMA.reduce((a, q) => a + q.w[stampKind], 0); let r = Math.random() * tot
  for (const q of TAMA) { r -= q.w[stampKind]; if (r <= 0) return q }
  return TAMA[0]
}
function startTama() {
  const E = G.end, def = ENDINGS.find(q => q.key === E.key), o = G.run.o, k = E.key
  // 置き場所: 穴に落ちた結末はその穴から、じいさんが落ちた結末はじいさんの所、家の結末はおむすびの手前
  let px, pz
  if (k === 'korin' || k === 'kicked') { px = o.x; pz = o.z }
  else if ((k === 'picked' || k === 'thrown') && G.dropH) { px = G.dropH.x; pz = G.dropH.z }
  else if (k === 'greedyKorin' || k === 'kindKorin') { px = gpaG.position.x; pz = gpaG.position.z }
  else { const dx = camera.position.x - oni.position.x, dz = camera.position.z - oni.position.z, d = Math.hypot(dx, dz) || 1; px = oni.position.x + dx / d * 0.5 + dz / d * 0.95; pz = oni.position.z + dz / d * 0.5 - dx / d * 0.95 } // おむすびの横（手前に置くとおむすびが隠れる）
  const item = pickTama(def.stamp)
  const g = new THREE.Group(), box = makeTsuzura(), it = makeItem(item.shape, lang === 'ja')
  g.add(box); it.visible = false; g.add(it)
  const mice = [makeMouse(), makeMouse({ band: 1 })]; mice.forEach((m, i) => { m.position.set((i ? 1 : -1) * 0.48, 0, 0.08); g.add(m) })
  const gy = height(px, pz)
  g.position.set(px, gy - 0.6, pz)
  // 正面を向ける向き: おじいさんが近くにいれば、その反対側から写す（手前に被らない）。いなければ今のカメラの方
  const gp = gpaG.position, gd = Math.hypot(gp.x - px, gp.z - pz)
  g.rotation.y = gpaG.visible !== false && gd < 3.5 && gd > 0.05 ? Math.atan2(px - gp.x, pz - gp.z) + 0.95 : Math.atan2(camera.position.x - px, camera.position.z - pz)
  // 足元の穴のふちのねずみは隠す（つづらの手前に被る）
  for (const H of HV) if (Math.hypot(H.h.x - px, H.h.z - pz) < 1.2) H.mouse.visible = false
  scene.add(g); G.tamaG = g
  G.tama = { t: 0, item, box, it, mice, gy, px, pz, opened: 0, said: 0 }
  grade.uniforms.dark.value = Math.min(grade.uniforms.dark.value, 0.12)
  hideBub()
}
function updateTama(dt) {
  const T = G.tama, g = G.tamaG; T.t += dt
  const t = T.t, rise = Math.min(1, t / 0.7), e = 1 - Math.pow(1 - rise, 3)
  g.position.y = T.gy - 0.6 + e * 0.6
  T.mice.forEach((m, i) => { m.userData.armL.rotation.z = -0.6 - Math.sin(t * 9 + i) * 0.5; m.userData.armR.rotation.z = 0.6 + Math.sin(t * 9 + i) * 0.5; m.rotation.y = (i ? -1 : 1) * 0.35 })
  if (!T.said && t > 0.5) { T.said = 1; Snd.play('sq', { vol: 0.8 }); T.mice[1].getWorldPosition(_w); _w.y += 0.5; say(t_('bub').mGift, null, { mouse: 1, pos: _w, extra: 0.3 }) }
  // ふたが開いて、中身が飛び出す
  if (t > 1.2) {
    const lo = Math.min(1, (t - 1.2) / 0.22); T.box.userData.lid.rotation.x = -lo * 2.45
    if (!T.opened) {
      T.opened = 1; T.it.visible = true; Snd.play('wood', { vol: 0.9 })
      const p = _v.set(T.px, T.gy + 0.4, T.pz)
      if (T.item.shape === 'empty') dust(p, 14, [0.75, 0.7, 0.62]); else riceBurst(p, T.item.rare ? 30 : 12)
      if (T.item.rare) Snd.play('j_rare', { vol: 0.7, jitter: 0, delay: 0.25 })
      showTamaCard(T.item)
    }
    const f = Math.min(1, (t - 1.2) / 0.5), up = f < 1 ? Math.sin(f * Math.PI * 0.5) * 0.95 : 0.95 - Math.min(0.28, (t - 1.7) * 0.6)
    T.it.position.set(0, T.box.userData.H + 0.05 + up, 0.02)
    // 紙の物は回さない（裏から写ると字が鏡文字になる）。正面のまま少し揺らす
    const flat = ['bill', 'card', 'photo', 'nori'].includes(T.item.shape)
    T.it.rotation.y = flat ? Math.sin(t * 2.2) * 0.25 : t * (T.item.shape === 'box' ? 1.2 : 1.8); T.it.scale.setScalar(Math.min(1, f * 1.6))
  }
  // 近くから見る
  const bx = T.px, bz = T.pz, gy = T.gy, dx = Math.sin(g.rotation.y), dz = Math.cos(g.rotation.y)
  _v.set(bx + dx * 2.7, gy + 1.55, bz + dz * 2.7); _w.set(bx, gy + 0.6, bz)
  camTo(_v, _w, dt, 3)
  if (gpa) gpa.update(dt)
  if (t > 3.6) { hideTamaCard(); showResult() }
}
function showTamaCard(item) { const el = $('tama'), L = t_('tama')[item.key]; el.querySelector('b').textContent = L[0]; el.querySelector('span').textContent = L[1]; el.querySelector('small').textContent = t_('tamaHead'); el.classList.toggle('rare', !!item.rare); el.classList.add('on') }
function hideTamaCard() { $('tama').classList.remove('on') }

// ------------------------------------------------------------ 結果: 絵本の1ページ
function showResult() {
  const E = G.end, def = ENDINGS.find(q => q.key === E.key)
  // 今の3Dの絵を撮る（描いた直後に写す）
  // つづらがあれば、撮る瞬間だけ画角を広げて、つづらと中身を中心に切り抜く（縦長の画面の真ん中だけだと中身が切れる）
  const fov0 = camera.fov; let cy = 0.5
  if (G.tamaG) {
    camera.fov = Math.min(100, fov0 * (camera.aspect < 1 ? 1.55 : 1.15)); camera.updateProjectionMatrix()
    G.tamaG.getWorldPosition(_v); _v.y += 0.6; _v.project(camera); cy = clamp(0.5 - _v.y * 0.5, 0.2, 0.8)
  }
  composer.render()
  const snap = document.createElement('canvas'); snap.width = 960; snap.height = 640
  { const s = renderer.domElement, sw = s.width, sh = s.height, ar = 960 / 640; let w = sw, h = sw / ar; if (h > sh) { h = sh; w = sh * ar } const sy = clamp(sh * cy - h / 2, 0, sh - h); snap.getContext('2d').drawImage(s, (sw - w) / 2, sy, w, h, 0, 0, 960, 640) }
  if (camera.fov !== fov0) { camera.fov = fov0; camera.updateProjectionMatrix() }
  const first = !G.zukan[E.key]
  G.zukan[E.key] = 1; LS.set('zukan', JSON.stringify(G.zukan))
  const m = Math.max(0, Math.round(G.run.o.z)); if (m > +LS.get('best', 0)) LS.set('best', m)
  if (!G.tutDone) { G.tutDone = true; LS.set('tut', '1') }
  G.result = { key: E.key, m, def, snap, tama: G.tama ? G.tama.item : null }
  enter('result')
  $('newEnd').textContent = first ? t('newEnd') : ''
  drawPage().then(() => { const c = $('res'); c.classList.remove('in'); void c.offsetWidth; c.classList.add('in') })
  Snd.play(def.rare ? 'j_rare' : def.stamp === 'good' ? 'j_good' : def.stamp === 'bad' ? 'j_bad' : 'j_rare', { vol: 0.8, jitter: 0 })
  loopVol('roll', 0.0001); loopVol('wind', 0.0001)
  if (window.TM) TM.end(m, def.stamp === 'good')
}
async function drawPage() {
  const R = G.result, c = $('res'), x = c.getContext('2d'), W2 = 1080, H2 = 1350
  try { await Promise.race([Promise.all(['400 60px "Zen Antique"', '400 40px "Zen Kurenaido"', '700 30px "Zen Kaku Gothic New"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]) } catch (e) {}
  // 和紙
  x.fillStyle = '#f3ead6'; x.fillRect(0, 0, W2, H2)
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${120 + Math.random() * 40 | 0},${90 + Math.random() * 30 | 0},50,${0.04 + Math.random() * 0.05})`; const px = Math.random() * W2, py = Math.random() * H2; x.fillRect(px, py, 1 + Math.random() * 6, 1) }
  // 絵（少しにじんだ縁）
  x.save(); x.translate(60, 70)
  x.fillStyle = 'rgba(80,60,40,.18)'; x.fillRect(6, 8, 960, 640)
  x.drawImage(R.snap, 0, 0)
  const g = x.createRadialGradient(480, 320, 300, 480, 320, 620); g.addColorStop(0, 'rgba(243,234,214,0)'); g.addColorStop(1, 'rgba(243,234,214,.55)'); x.fillStyle = g; x.fillRect(0, 0, 960, 640)
  x.strokeStyle = 'rgba(60,40,20,.55)'; x.lineWidth = 3; x.strokeRect(0, 0, 960, 640)
  // おみやげの札（絵の左下に貼る）
  if (R.tama) {
    const L = t('tama')[R.tama.key], head = t('tamaLabel') + (lang === 'ja' ? '：' : ': ') + L[0]
    x.font = '700 30px "Zen Kaku Gothic New", sans-serif'; const w1 = x.measureText(head).width
    x.font = '400 28px "Zen Kurenaido", sans-serif'; const w2 = x.measureText(L[1]).width
    const bw = Math.min(900, Math.max(w1, w2) + 48), bh = 104
    x.save(); x.translate(24, 640 - bh - 24); x.rotate(-0.012)
    x.fillStyle = 'rgba(40,25,10,.25)'; x.fillRect(4, 5, bw, bh)
    x.fillStyle = R.tama.rare ? '#f6e3a8' : '#f6eedc'; x.fillRect(0, 0, bw, bh)
    x.fillStyle = '#c23a2b'; x.fillRect(0, 0, 8, bh)
    x.fillStyle = '#2a2320'; x.textBaseline = 'alphabetic'
    x.font = '700 30px "Zen Kaku Gothic New", sans-serif'; x.fillText(head, 26, 42, bw - 40)
    x.font = '400 28px "Zen Kurenaido", sans-serif'; x.fillStyle = '#5a4630'; x.fillText(L[1], 26, 84, bw - 40)
    x.restore()
  }
  x.restore()
  // どちらの昔話か
  x.fillStyle = G.mode === 'kind' ? '#2f4a72' : '#8a4a2a'; x.fillRect(60, 742, 14, 44)
  x.fillStyle = '#5a4630'; x.font = '700 28px "Zen Kaku Gothic New", sans-serif'; x.textBaseline = 'middle'
  x.fillText(t('modeLong')[G.mode], 90, 765)
  // 結末の名前
  x.fillStyle = '#2a2320'; x.font = '400 66px "Zen Antique", serif'; x.textBaseline = 'alphabetic'
  fitText(x, t('endName')[R.key], 60, 870, 960, 66, '"Zen Antique", serif')
  // 語り
  x.font = '400 40px "Zen Kurenaido", sans-serif'; x.fillStyle = '#3a2e24'
  wrap(x, t('story')[R.key], 60, 950, 770, 62)
  // 数字
  const o = G.run.o
  x.font = '700 38px "Zen Kaku Gothic New", sans-serif'; x.fillStyle = '#5a4630'
  x.fillText(t('stats')(R.m, (o.r / START_R).toFixed(1), G.run.st.chips || 0), 60, 1245)
  // はんこ
  stamp(x, 950, 1105, t('stamp')[R.def.stamp], R.def.stamp)
  // 題名
  x.font = '400 34px "Zen Antique", serif'; x.fillStyle = '#6b5a48'; x.textAlign = 'left'
  x.fillText(t('title1') + t('title2'), 60, 1305)
  x.font = '700 30px "Zen Kaku Gothic New", sans-serif'; x.textAlign = 'right'; x.fillText('tom3games.com', 1020, 1305); x.textAlign = 'left'
}
function fitText(x, s, px, py, maxW, size, fam) { let sz = size; x.font = `400 ${sz}px ${fam}`; while (x.measureText(s).width > maxW && sz > 30) { sz -= 2; x.font = `400 ${sz}px ${fam}` } x.fillText(s, px, py) }
function wrap(x, s, px, py, maxW, lh) {
  const words = lang === 'ja' ? s.split(/(?<=[ 、。」])/) : s.split(/(?<= )/)
  let line = '', y = py
  for (const w of words) { const tt = line + w; if (x.measureText(tt.trim()).width > maxW && line) { x.fillText(line.trim(), px, y); y += lh; line = w } else line = tt }
  if (line) x.fillText(line.trim(), px, y)
}
function stamp(x, cx0, cy, text, kind) {
  x.save(); x.translate(cx0, cy); x.rotate(-0.18)
  const col = kind === 'bad' ? 'rgba(40,55,90,.85)' : 'rgba(194,58,43,.88)'
  x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 7
  x.beginPath(); x.arc(0, 0, 92, 0, 7); x.stroke(); x.lineWidth = 2.5; x.beginPath(); x.arc(0, 0, 80, 0, 7); x.stroke()
  x.textAlign = 'center'; x.textBaseline = 'middle'
  const n = text.length, sz = lang === 'ja' ? Math.min(52, 150 / Math.max(2, n) * 1.15) : 30
  x.font = `400 ${sz}px "Zen Antique", serif`
  if (lang === 'ja' && n <= 4) { const ch = [...text]; if (n === 4) { x.fillText(ch[0] + ch[1], 0, -sz * 0.55); x.fillText(ch[2] + ch[3], 0, sz * 0.55) } else x.fillText(text, 0, 0) } else x.fillText(text, 0, 0)
  // かすれ
  x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.6})`; x.fillRect((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 2 + Math.random() * 4, 1 + Math.random() * 2) }
  x.restore()
}
$('bSave').onclick = () => {
  const a = document.createElement('a'); a.download = 'omusubi-' + G.result.key + '.png'; a.href = $('res').toDataURL('image/png'); a.click()
  if (window.TM) TM.share('save')
}
$('bPost').onclick = () => {
  if (window.TM) TM.share('x')
  const text = t('postTxt')(t('endName')[G.result.key], G.result.m) + ' ' + t('hashtag')
  open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://tom3games.com/play/omusubi-korin/'), '_blank', 'noopener')
}

// ------------------------------------------------------------ 毎コマ
function tick(now) {
  requestAnimationFrame(tick)
  if (G.state === 'load') return
  const dt = Math.min(0.05, (now - (G.last || now)) / 1000); G.last = now
  if (G.paused) { composer.render(); return }
  frame(dt)
}
function frame(dt) {
  const r = G.run
  if (G.state === 'title') {
    // 切り株の上のおむすびがゆれる
    oni.userData.spin.rotation.x = Math.sin(performance.now() / 700) * 0.06
    camTitle(false); camTo(G.camPos.clone(), G.camLook.clone(), dt)
    gpa.update(dt); baba.update(dt)
  } else if (G.state === 'intro') {
    G.introT += dt
    const sx = cx(-4) + 1.6, sy = height(sx, -4)
    const a = G.introT * 0.25
    _v.set(sx - 2.4 * Math.cos(a) - 1, sy + 1.4, -8 + Math.sin(a) * 0.6); _w.set(sx - 0.8, sy + 0.6, -3.5)
    camTo(_v, _w, dt, 2)
    gpa.update(dt); baba.update(dt); updateBub(dt)
    if (G.introT > 4.2) beginPlay()
  } else if (G.state === 'play') {
    G.acc += dt
    let n = 0
    while (G.acc >= DT && n < 5) {
      G.prev = { x: r.o.x, z: r.o.z, ang: r.o.ang }
      G.inp = readInput()
      step(r, G.inp)
      for (const e of r.ev) onEvent(e)
      r.ev.length = 0
      G.acc -= DT; n++
      if (G.state !== 'play') break
    }
    if (G.state === 'play') {
      oniVisual(G.acc / DT)
      camFollow(dt)
      playFx(dt)
    }
    updateGpa(dt)
  } else if (G.state === 'ending') {
    updateEnding(dt)
  } else if (G.state === 'result') {
    // 背景は止めたまま
  }
  if (G.state === 'play' || G.state === 'ending') { updateHoles(dt); updateBub(dt); updateEmaki() }
  P.update(dt)
  leaves.update(dt, cx(oni.position.z), oni.position.z, sectionAt(oni.position.z) !== 'take' && sectionAt(oni.position.z) !== 'tanbo')
  baba.update(dt)
  // 影はおむすびの周りだけ
  sun.position.copy(oni.position).addScaledVector(SUNDIR, 40); sun.target.position.copy(oni.position)
  grade.uniforms.time.value = performance.now() / 1000
  composer.render()
}
function playFx(dt) {
  const r = G.run, o = r.o, sp = Math.hypot(o.vx, o.vz)
  const sf = surfaceAt(o.x, o.z)
  loopVol('roll', Snd.muted ? 0.0001 : clamp(sp / 10, 0, 1) * (sf === 'paddy' ? 0.15 : 0.55))
  loopVol('wind', clamp((sp - 6) / 8, 0, 1) * 0.4)
  // 土ぼこり・田んぼの泥
  if (sf === 'paddy') { if (Math.random() < 0.5) dust(oni.position, 1, [0.4, 0.33, 0.24]); if (!G.inPaddy) { G.inPaddy = 1; Snd.play('splash', { vol: 0.6 }); pop(t('pop').grow) } oni.userData.mat.userData.u.mud.value = Math.min(0.5, oni.userData.mat.userData.u.mud.value + dt * 0.08); checkSize() }
  else { G.inPaddy = 0; if (sp > 4 && Math.random() < 0.25) dust(oni.position, 1) }
  // 顔
  if (G.faceT > 0) { G.faceT -= dt; if (G.faceT <= 0) oni.setFace('calm') }
  // 区間の名前
  const sec = sectionAt(o.z)
  if (sec !== G.sec) { G.sec = sec; if (t('sec')[sec]) { const el = $('secT'); el.textContent = t('sec')[sec]; el.classList.add('on'); clearTimeout(G.secTO); G.secTO = setTimeout(() => el.classList.remove('on'), 1800); if (sec === 'take' && Math.random() < 0.7) Snd.play('uguisu', { vol: 0.5, jitter: 0 }) } }
  // 操作の案内は、動かすか最初の穴を越えたら消す
  if (!G.tutDone && (G.swipes >= 3 || o.z > 60)) { G.tutDone = true; LS.set('tut', '1'); $('tut').style.opacity = '0' }
}

// ------------------------------------------------------------ 検査用の窓口
window.omuApi = {
  G, get run() { return G.run },
  start(mode = 'kind', seed = 1) { startAudio(); startRun(seed, mode); beginPlay() },
  bot(kind) { G.bot = kind ? makeBot(kind, G.seed) : null },
  dbg: { pause(v = true) { G.paused = v }, step(n = 1) { for (let i = 0; i < n; i++) frame(1 / 60) } },
  oniXY() { _v.copy(oni.position).project(camera); return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight } },
  state: () => G.state,
  render() { composer.render() },
  obj: () => ({ oni, gpaG, gpa, HV, camera, frame }),
  setO(o) { Object.assign(G.run.o, o); G.prev = null },
  forceTama(k) { G.forceTama = k || null },
  tama: () => G.tama && { t: G.tama.t, key: G.tama.item.key },
  stepN(n, inp) { G.forceInp = inp || null; for (let i = 0; i < n; i++) frame(1 / 60); G.forceInp = null },
}

requestAnimationFrame(tick)
boot().catch(e => { console.error(e); throw e })
