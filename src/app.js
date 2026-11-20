// Undersurface — prototype app
const Q = new URLSearchParams(location.search);
const SPEED = Math.max(0.01, +Q.get('speed') || 1);
const DEV = Q.has('dev');
const MS_SIM_DAY = 86400000 / 7;           // 1 real day = 1 simulated week
const MAX_DAY = 500, FORECAST = 56, START_DAY = 14;
const TIERS = [null, { mag: '×10', name: 'Hand lens', bar: '5 mm' }, { mag: '×60', name: 'Microscope', bar: '0.5 mm' }, { mag: '×400', name: 'High power', bar: '50 µm' }];
const SIZE = { beetle: 0.36, silverfish: 0.5, spider: 0.42, woodworm: 0.3, dustmite: 0.2, predmite: 0.2, booklouse: 0.2, springtail: 0.24 };
const BIOME_LIST = ['wall', 'carpet', 'floor'];

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const spName = s => store.guide[s] ? SPECIES[s].name : 'Unidentified ' + 'ABCDEFGHIJ'[Object.keys(SPECIES).indexOf(s)];
const dayLabel = d => `Week ${Math.floor(d / 7) + 1}, day ${(d % 7) + 1}`;

// ---------- storage + research log ----------
const KEY = 'undersurface.v1';
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) {} return { v: 1, install: rid(), sites: [], guide: {}, log: [], cases: {} }; }
let store = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const SESSION = rid();
function log(type, data = {}) {
  store.log.push({ t: new Date().toISOString(), install: store.install, session: SESSION, type, ...data });
  if (store.log.length > 8000) store.log.splice(0, store.log.length - 8000);
  save();
}
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

// ---------- app state ----------
let mode = 'home', prevScreen = 'home';
let site = null, tier = 1, viewOffset = 0, agents = [], bg = null, lens = { x: 0, y: 0, R: 120 };
let pendingScan = null;

function currentDay(s) { return Math.min(MAX_DAY, s.anchorDay + Math.floor((Date.now() - s.anchorReal) * SPEED / MS_SIM_DAY)); }
let playing = false; const PLAY_RATE = 3.5;   // simulated days per second during a time-lapse
function viewDayF() { const n = currentDay(site); return clamp(n + viewOffset, 0, n + FORECAST); }
function viewDay() { return Math.round(viewDayF()); }
const isToday = () => Math.round(viewOffset) === 0;

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  mode = id;
  $('stage').classList.toggle('on', id === 'scan' || id === 'xray');
  if (id === 'home') renderHome();
  if (id === 'guide') renderGuide();
  requestAnimationFrame(layout);
}

let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }

function sheet(html, onMount) {
  $('sheet').innerHTML = html; $('scrim').classList.add('on');
  $('sheet').querySelectorAll('[data-close]').forEach(b => b.onclick = closeSheet);
  onMount && onMount($('sheet'));
}
function closeSheet() { $('scrim').classList.remove('on'); }
$('scrim').addEventListener('pointerdown', e => { if (e.target.id === 'scrim') closeSheet(); });

// ---------- camera + backgrounds ----------
const cam = $('cam'); let camStream = null;
async function startCamera() {
  if (camStream) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    cam.srcObject = camStream; await cam.play(); return true;
  } catch (e) { log('camera_error', { name: e.name }); return false; }
}
function stopCamera() { if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; } }
function bgSource() {
  if (!bg) return null;
  if (bg.kind === 'camera') return cam.videoWidth ? [cam, cam.videoWidth, cam.videoHeight] : null;
  return [bg.canvas, bg.canvas.width, bg.canvas.height];
}

// ---------- surface classifier (heuristic stand-in for the trained model) ----------
function classify(src, sw, sh) {
  const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const x = cv.getContext('2d', { willReadFrequently: true });
  const side = Math.min(sw, sh) * 0.6; x.drawImage(src, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data, g = new Float32Array(N * N); let R = 0, G = 0, B = 0;
  for (let i = 0; i < N * N; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2]; R += r; G += gg; B += b; g[i] = 0.299 * r + 0.587 * gg + 0.114 * b; }
  R /= N * N; G /= N * N; B /= N * N;
  let mag = 0, jxx = 0, jyy = 0, jxy = 0, n = 0;
  for (let y = 1; y < N - 1; y++) for (let xx = 1; xx < N - 1; xx++) {
    const i = y * N + xx;
    const gx = (g[i - N + 1] + 2 * g[i + 1] + g[i + N + 1]) - (g[i - N - 1] + 2 * g[i - 1] + g[i + N - 1]);
    const gy = (g[i + N - 1] + 2 * g[i + N] + g[i + N + 1]) - (g[i - N - 1] + 2 * g[i - N] + g[i - N + 1]);
    mag += Math.hypot(gx, gy); jxx += gx * gx; jyy += gy * gy; jxy += gx * gy; n++;
  }
  mag /= n; const coh = Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / (jxx + jyy + 1e-6);
  const warm = (R - B) / 255;
  const sig = v => 1 / (1 + Math.exp(-v));
  const flat = sig((22 - mag) / 5);
  const grain = sig((coh - 0.32) / 0.07 + warm * 2);
  const scores = { wall: flat, floor: (1 - flat) * grain, carpet: (1 - flat) * (1 - grain) };
  const best = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
  return { best, conf: scores[best], scores, color: [R, G, B], features: { mag: +mag.toFixed(1), coh: +coh.toFixed(3), warm: +warm.toFixed(3) } };
}

// ---------- sites ----------
function createSite(biome, color, source) {
  const n = store.sites.filter(s => s.biome === biome && !s.mystery).length + 1;
  const s = { id: rid(), name: `${BIOMES[biome].name} ${n}`, biome, seed: (Math.random() * 1e9) | 0, rh0: BIOMES[biome].rh + (Math.random() * 4 - 2),
    color: color.map(v => Math.round(v)), source, created: Date.now(), anchorReal: Date.now(), anchorDay: START_DAY, events: [], readings: [] };
  store.sites.unshift(s); save(); log('site_created', { site: s.id, biome, source }); return s;
}
function mysterySite() {
  let s = store.sites.find(x => x.id === 'case-mites');
  if (!s) {
    s = { id: 'case-mites', mystery: 'mites', name: "Maya's carpet", biome: 'carpet', seed: 4242, rh0: 66, color: [128, 118, 132], source: 'sample',
      created: Date.now(), anchorReal: Date.now(), anchorDay: 28, events: [{ day: 7, type: 'heating', hidden: true }], readings: [] };
    store.sites.push(s); save();
  }
  return s;
}

async function openSite(s) {
  site = s; tier = 1; viewOffset = 0; agents = []; _cut = {}; off.x = off.y = 0; zoom = 1; playing = false; trans = null; prevG = null;
  if (s.source === 'camera' && await startCamera()) bg = { kind: 'camera' };
  else { stopCamera(); bg = { kind: 'sample', canvas: makeSample(s.sampleBiome || s.biome, s.source === 'camera' ? s.color : null, s.sampleSeed || s.seed % 1000) }; }
  show('xray'); renderXray(); setTab('measure');
  $('bCase').style.display = s.mystery ? '' : 'none';
  log('site_open', { site: s.id, biome: s.biome, day: currentDay(s) });
  store.hints = (store.hints || 0) + 1; save();
  if (store.hints <= 3 && !(s.mystery && !(store.cases[s.mystery] || {}).briefed)) setTimeout(() => toast(bg.kind === 'camera' ? 'Move slowly to explore the surface. Drag the circle, pinch to zoom.' : 'Drag the circle to explore. Drag outside it to slide the surface. Pinch or scroll to zoom.'), 600);
  if (s.mystery && !(store.cases[s.mystery] || {}).briefed) { caseBrief(); store.cases[s.mystery] = { ...(store.cases[s.mystery] || {}), briefed: true }; save(); }
}

// ---------- home ----------
function renderHome() {
  const real = store.sites.filter(s => !s.mystery);
  $('siteCount').textContent = real.length ? `${real.length} saved` : '';
  $('sites').innerHTML = real.length ? real.map(s => `<button class="row" data-site="${s.id}"><span><span class="t">${esc(s.name)}</span><br><span class="s">${BIOMES[s.biome].name} · ${dayLabel(currentDay(s))} · ${s.readings.length} readings</span></span><span class="s">${s.source === 'camera' ? 'Camera' : 'Sample'}</span><span class="arrow">→</span></button>`).join('')
    : `<div class="empty">No sites yet. Scan a wall, carpet or floor to start one.</div>`;
  const c = store.cases.mites || {};
  $('cases').innerHTML = `<button class="row" data-case="mites"><span><span class="t">The vanishing mites</span><br><span class="s">Carpet · Why did a dust-mite colony crash?</span></span><span class="s">${c.solved ? 'Solved' : c.briefed ? 'In progress' : 'New'}</span><span class="arrow">→</span></button>`;
  document.querySelectorAll('[data-site]').forEach(b => b.onclick = () => openSite(store.sites.find(s => s.id === b.dataset.site)));
  document.querySelectorAll('[data-case]').forEach(b => b.onclick = () => openSite(mysterySite()));
  $('logCount').textContent = `${store.log.length} events logged`;
  $('bDev').style.display = DEV ? '' : 'none';
}

$('bScan').onclick = async () => {
  log('scan_start', { source: 'camera' });
  if (await startCamera()) { bg = { kind: 'camera' }; show('scan'); }
  else { toast('Camera unavailable here. Try a sample surface.'); sampleSheet(); }
};
$('bSample').onclick = sampleSheet;
function sampleSheet() {
  sheet(`<div class="sheet-h"><div><div class="caps">No camera needed</div><h2>Choose a sample surface</h2></div><button class="btn quiet" data-close>Cancel</button></div>
  <p>Useful on a laptop or for testing. The scanner still has to work out which surface it is.</p>
  <div class="choice">${BIOME_LIST.map(b => `<button data-b="${b}">${BIOMES[b].name}</button>`).join('')}</div>`, el => {
    el.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { closeSheet(); stopCamera(); const seed = 1 + (Math.random() * 998) | 0; bg = { kind: 'sample', biome: b.dataset.b, seed, canvas: makeSample(b.dataset.b, null, seed) }; log('scan_start', { source: 'sample', sample: b.dataset.b }); show('scan'); });
  });
}
$('bShutter').onclick = () => {
  const src = bgSource(); if (!src) { toast('Camera is still starting'); return; }
  const r = classify(...src); pendingScan = { ...r, chosen: r.best, source: bg.kind === 'camera' ? 'camera' : 'sample', sample: bg.biome };
  const sure = r.conf > 0.75 ? 'Fairly sure' : r.conf > 0.5 ? 'Best guess' : 'Not sure';
  sheet(`<div class="sheet-h"><div><div class="caps">${sure}</div><h2>This looks like ${BIOMES[r.best].name.toLowerCase()}</h2></div><button class="btn quiet" data-close>Rescan</button></div>
    <p>Wrong? Pick the right surface.</p>
    <div class="choice">${BIOME_LIST.map(b => `<button data-b="${b}" class="${b === r.best ? 'on' : ''}">${BIOMES[b].name}<small class="num">${Math.round(r.scores[b] * 100)}%</small></button>`).join('')}</div>
    <button class="btn primary" id="bConfirm" style="width:100%">Open x-ray view</button>`, el => {
    el.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { pendingScan.chosen = b.dataset.b; el.querySelectorAll('[data-b]').forEach(x => x.classList.toggle('on', x === b)); });
    $('bConfirm').onclick = () => {
      const p = pendingScan; closeSheet();
      log('scan_classified', { guess: p.best, chosen: p.chosen, overridden: p.best !== p.chosen, conf: +p.conf.toFixed(2), features: p.features, source: p.source, sample: p.sample || null });
      const s = createSite(p.chosen, p.color, p.source);
      if (p.source === 'sample') { s.sampleSeed = bg.seed; s.sampleBiome = bg.biome; save(); }
      openSite(s);
    };
  });
};

// ---------- x-ray screen ----------
function renderXray() {
  $('xName').textContent = site.name;
  $('rail').innerHTML = [1, 2, 3].map(t => `<button data-t="${t}" class="${t === tier ? 'on' : ''}"><b>${TIERS[t].mag}</b><span>${TIERS[t].name}</span></button>`).join('');
  $('rail').querySelectorAll('[data-t]').forEach(b => b.onclick = () => setTier(+b.dataset.t));
  $('acts').innerHTML = Object.keys(ACTIONS).map(k => `<button class="btn" data-a="${k}">${ACTIONS[k].label}</button>`).join('');
  $('acts').querySelectorAll('[data-a]').forEach(b => b.onclick = () => act(b.dataset.a));
  $('readout').innerHTML = 'Take readings on different days, then graph them.';
  updateTimeUI(true);
}
function setTab(name) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'p-' + name));
  requestAnimationFrame(layout);
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { setTab(b.dataset.tab); log('tab', { tab: b.dataset.tab }); });

let lastLabel = '';
function updateTimeUI(force) {
  if (!site) return;
  const now = currentDay(site), vd = viewDay(), o = vd - now;
  const sub = (o === 0 ? `Today · ${dayLabel(now)}` : `${o > 0 ? 'Forecast' : 'Looking back'} · ${dayLabel(vd)}`) + (playing ? ' ' : '');
  if (sub !== lastLabel || force) {
    lastLabel = sub; $('xSub').textContent = sub.trim();
    const sc = $('scrub'); sc.max = now + FORECAST; if (!scrubbing) sc.value = vd; $('maxL').textContent = `+${FORECAST / 7} wk`;
    $('timeLabel').innerHTML = o === 0 ? `<b>Today</b> · ${dayLabel(now)}` : `<b>${o > 0 ? 'Forecast' : 'Past'}</b> · ${dayLabel(vd)} <span class="caps">(${o > 0 ? '+' : ''}${o} days)</span>`;
    $('bNow').disabled = o === 0 && !playing;
    $('bPlay').textContent = playing ? 'Pause' : vd >= now + FORECAST ? 'Replay' : 'Play';
    const max = now + FORECAST, pct = v => (v / max * 100).toFixed(2) + '%';
    $('ticks').innerHTML = `<i class="now" style="left:${pct(now)}"></i>` + site.events.filter(e => !e.hidden).map(e => `<i class="ev" style="left:${pct(e.day)}" title="${e.type}"></i>`).join('');
    $('acts').querySelectorAll('button').forEach(b => b.disabled = o !== 0);
    $('actNote').textContent = o !== 0 ? 'You can only change the ecosystem today. Return to today to act.' : 'Each action happens today. Then press Play in Time to watch what follows.';
  }
}
let scrubbing = false;
$('scrub').oninput = e => { scrubbing = true; playing = false; viewOffset = +e.target.value - currentDay(site); updateTimeUI(true); };
$('scrub').onchange = () => { scrubbing = false; log('scrub', { site: site.id, offset: Math.round(viewOffset) }); };
$('bNow').onclick = () => { playing = false; viewOffset = 0; updateTimeUI(true); };
$('bPlay').onclick = () => {
  if (playing) { playing = false; log('timelapse_pause', { site: site.id, day: viewDay() }); }
  else { if (viewDay() >= currentDay(site) + FORECAST) viewOffset = -currentDay(site); playing = true; log('timelapse_play', { site: site.id, from: viewDay() }); }
  updateTimeUI(true);
};

function act(type) {
  if (!isToday()) return;
  const now = currentDay(site);
  if (site.events.some(e => e.day === now && e.type === type)) { toast('Already done today. Let some time pass first.'); return; }
  site.events.push({ day: now, type }); save(); updateTimeUI(true);
  log('perturb', { site: site.id, type, day: now });
  toast(`${ACTIONS[type].label}. ${ACTIONS[type].note}`);
}

function addReading(r) {
  const i = site.readings.findIndex(x => x.day === r.day && x.kind === r.kind && x.species === r.species);
  if (i >= 0) site.readings[i] = r; else site.readings.push(r);
}
document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => measure(b.dataset.m));
function measure(kind) {
  playing = false;
  const vd = viewDay(), st = stateAt(site, vd), nz = k => noise(site.seed + 99, vd, k);
  if (kind === 'rh') { const v = Math.round(st.env.rh + nz(1) * 1.5); addReading({ day: vd, kind, value: v }); $('readout').innerHTML = `Humidity <b class="num">${v}%</b> · ${dayLabel(vd)}`; log('measure', { site: site.id, kind, day: vd, value: v }); }
  if (kind === 'temp') { const v = +(st.env.temp + nz(2) * 0.3).toFixed(1); addReading({ day: vd, kind, value: v }); $('readout').innerHTML = `Temperature <b class="num">${v} °C</b> · ${dayLabel(vd)}`; log('measure', { site: site.id, kind, day: vd, value: v }); }
  if (kind === 'count') {
    const here = Object.keys(st.pops).filter(s => SPECIES[s].tier === tier);
    if (!here.length) { $('readout').textContent = 'Nothing to count at this magnification. Try another lens.'; return; }
    const parts = here.map(s => {
      const seen = inLensAgents().filter(a => a.s === s && !a.speck).length, est = Math.round(st.pops[s] * (1 + nz(s.length) * 0.08));
      addReading({ day: vd, kind: 'pop', species: s, value: est });
      const nm = store.guide[s] ? SPECIES[s].name.toLowerCase() : spName(s);
      return `<b class="num">${est}</b> ${nm}${SPECIES[s].colony ? ' (colony units)' : ''} <span class="caps">${seen} in view</span>`;
    });
    $('readout').innerHTML = `Estimated in this patch · ${dayLabel(vd)}: ` + parts.join(' · ');
    log('measure', { site: site.id, kind: 'count', tier, day: vd });
  }
  save();
}

// ---------- graph ----------
const SERIES_LABEL = k => k === 'rh' ? 'Humidity (%)' : k === 'temp' ? 'Temperature (°C)' : `${spName(k.slice(4))} (estimated count)`;
const seriesKey = r => r.kind === 'pop' ? 'pop:' + r.species : r.kind;
$('bGraph').onclick = () => graphSheet();
function graphSheet(sel) {
  const keys = [...new Set(site.readings.map(seriesKey))];
  log('graph_open', { site: site.id, series: keys.length });
  if (!keys.length) { sheet(`<div class="sheet-h"><h2>Nothing to graph yet</h2><button class="btn quiet" data-close>Done</button></div><p>Take a few readings with Measure. Move through time and measure again to build a graph.</p>`); return; }
  sel = sel && keys.includes(sel) ? sel : keys[0];
  const pts = site.readings.filter(r => seriesKey(r) === sel).sort((a, b) => a.day - b.day);
  sheet(`<div class="sheet-h"><div><div class="caps">${esc(site.name)}</div><h2>${esc(SERIES_LABEL(sel))}</h2></div><button class="btn quiet" data-close>Done</button></div>
    <div class="chips">${keys.map(k => `<button data-k="${k}" class="${k === sel ? 'on' : ''}">${esc(SERIES_LABEL(k).replace(/ \(.*\)/, ''))}</button>`).join('')}</div>
    ${chartSVG(pts, sel)}
    <p class="caps" style="margin-top:8px">${pts.length} reading${pts.length === 1 ? '' : 's'}${pts.length < 2 ? ' · take more on other days to see a trend' : ''}</p>`, el => {
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => graphSheet(b.dataset.k));
  });
}
function chartSVG(pts, key) {
  const Wd = 560, Ht = 240, L = 44, Rm = 16, T = 16, Bm = 32;
  const maxDay = Math.max(currentDay(site), ...pts.map(p => p.day)) + 1;
  let ymax = key === 'rh' ? 100 : Math.max(...pts.map(p => p.value)) * 1.2 || 1; let ymin = key === 'temp' ? Math.floor(Math.min(...pts.map(p => p.value)) - 2) : 0;
  if (key === 'temp') ymax = Math.ceil(Math.max(...pts.map(p => p.value)) + 2);
  const X = d => L + d / maxDay * (Wd - L - Rm), Y = v => T + (1 - (v - ymin) / (ymax - ymin)) * (Ht - T - Bm);
  const nice = (ymax - ymin) / 4; let ty = ''; for (let i = 0; i <= 4; i++) { const v = ymin + nice * i; ty += `<line x1="${L}" x2="${Wd - Rm}" y1="${Y(v)}" y2="${Y(v)}" stroke="#D9D8D4" stroke-width="1"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#6B6A66">${key === 'temp' ? v.toFixed(0) : Math.round(v)}</text>`; }
  let tx = ''; const step = maxDay > 70 ? 14 : 7; for (let d = 0; d <= maxDay; d += step) tx += `<text x="${X(d)}" y="${Ht - 10}" text-anchor="middle" font-size="11" fill="#6B6A66">W${d / 7 + 1}</text>`;
  const line = pts.map(p => `${X(p.day).toFixed(1)},${Y(p.value).toFixed(1)}`).join(' ');
  const evs = site.events.filter(e => !e.hidden).map(e => `<line x1="${X(e.day)}" x2="${X(e.day)}" y1="${T}" y2="${Ht - Bm}" stroke="#E2401C" stroke-width="1" stroke-dasharray="3 3"/><text x="${X(e.day) + 4}" y="${T + 10}" font-size="10" fill="#E2401C">${esc(ACTIONS[e.type] ? ACTIONS[e.type].label : e.type)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="${esc(SERIES_LABEL(key))} over time" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">${ty}${tx}<line x1="${L}" x2="${Wd - Rm}" y1="${Ht - Bm}" y2="${Ht - Bm}" stroke="#111"/>${evs}
    ${pts.length > 1 ? `<polyline points="${line}" fill="none" stroke="#111" stroke-width="1.5"/>` : ''}${pts.map(p => `<circle cx="${X(p.day)}" cy="${Y(p.value)}" r="3.5" fill="#F7F7F5" stroke="#111" stroke-width="1.5"/>`).join('')}</svg>`;
}

// ---------- field guide ----------
function speciesSheet(id, fromTap) {
  const sp = SPECIES[id], g = store.guide[id] || { seen: 0 };
  const found = Object.keys(BIOMES).filter(b => sp && BIOMES[b].start[id] != null).map(b => BIOMES[b].name.toLowerCase()).join(', ');
  sheet(`<div class="sheet-h"><div><div class="caps">Field guide · ${TIERS[sp.tier].name} ${TIERS[sp.tier].mag}</div><h2>${sp.name}</h2><div class="latin">${sp.latin}</div></div><button class="btn quiet" data-close>Done</button></div>
    <div class="entry"><img src="${thumb(id)}" alt="${sp.name}"><div><ul>${sp.facts.map(f => `<li>${f}</li>`).join('')}</ul></div></div>
    <p class="caps" style="margin-top:16px">Lives in ${found} · Spotted ${g.seen} time${g.seen === 1 ? '' : 's'}</p>`);
}
function spot(id) {
  const first = !store.guide[id];
  store.guide[id] = { seen: ((store.guide[id] || {}).seen || 0) + 1, first: (store.guide[id] || {}).first || new Date().toISOString() };
  save(); log('organism_tap', { site: site && site.id, species: id, first, tier });
  if (first) toast(`New in your field guide: ${SPECIES[id].name}`);
  speciesSheet(id, true);
}
function renderGuide() {
  const ids = Object.keys(SPECIES), n = ids.filter(i => store.guide[i]).length;
  $('gSub').textContent = `${n} of ${ids.length} found`;
  $('ggrid').innerHTML = ids.map(i => { const f = store.guide[i]; return `<button class="cell" data-g="${i}" ${f ? '' : 'disabled'}><img src="${thumb(i, !f)}" alt=""><b>${f ? SPECIES[i].name : 'Not yet found'}</b><span>${f ? `<i>${SPECIES[i].latin}</i>` : TIERS[SPECIES[i].tier].name + ' ' + TIERS[SPECIES[i].tier].mag}</span></button>`; }).join('');
  $('ggrid').querySelectorAll('[data-g]').forEach(b => b.onclick = () => speciesSheet(b.dataset.g));
}
$('bGuide').onclick = () => { prevScreen = 'home'; show('guide'); log('guide_open', { from: 'home' }); };
$('bXGuide').onclick = () => { prevScreen = 'xray'; show('guide'); log('guide_open', { from: 'xray' }); };
$('gBack').onclick = () => show(prevScreen);
$('xBack').onclick = () => { stopCamera(); site = null; show('home'); };
$('sBack').onclick = () => { stopCamera(); show('home'); };

// ---------- mystery ----------
const CAUSES = [['pred', 'Predatory mites ate them'], ['vac', 'Someone vacuumed the carpet'], ['dry', 'The air became too dry'], ['food', 'They ran out of food']];
function caseBrief() {
  log('case_brief', { case: 'mites' });
  sheet(`<div class="sheet-h"><div><div class="caps">Case file</div><h2>The vanishing mites</h2></div><button class="btn quiet" data-close>Close</button></div>
    <p>Four weeks ago, Maya's bedroom carpet held a healthy dust-mite colony. Today it has almost disappeared.</p>
    <p>Use <b>Time</b> to look back at earlier weeks, <b>Measure</b> what you find, and work out what changed. When you're ready, open <b>Case</b> and make your claim.</p>
    <button class="btn primary" data-close style="width:100%;margin-top:8px">Start investigating</button>`);
}
$('bCase').onclick = claimSheet;
function claimSheet() {
  const rs = site.readings.slice().sort((a, b) => a.day - b.day);
  const lbl = r => r.kind === 'rh' ? `Humidity ${r.value}%` : r.kind === 'temp' ? `Temperature ${r.value} °C` : `${spName(r.species)} ≈ ${r.value}`;
  sheet(`<div class="sheet-h"><div><div class="caps">Claim board</div><h2>What made the mites vanish?</h2></div><button class="btn quiet" data-close>Close</button></div>
    <div class="caps">1. Your claim</div>
    ${CAUSES.map(([k, t]) => `<label class="opt"><input type="radio" name="cause" value="${k}"><span>${t}</span></label>`).join('')}
    <div class="caps" style="margin-top:20px">2. Pin your evidence</div>
    ${rs.length ? rs.map((r, i) => `<label class="opt"><input type="checkbox" value="${i}"><span>${lbl(r)} <span class="caps">${dayLabel(r.day)}</span></span></label>`).join('') : `<p class="readout">No readings yet. Go back in time with Time, then use Measure.</p>`}
    <button class="btn primary" id="bClaim" style="width:100%;margin-top:16px">Submit explanation</button>
    <div id="fb"></div>`, el => {
    $('bClaim').onclick = () => {
      const c = (el.querySelector('input[name=cause]:checked') || {}).value;
      if (!c) { toast('Choose a claim first'); return; }
      const ev = [...el.querySelectorAll('input[type=checkbox]:checked')].map(i => rs[+i.value]);
      const hum = ev.filter(r => r.kind === 'rh');
      const before = hum.some(r => r.day < 8 && r.value >= 55), after = hum.some(r => r.day >= 10 && r.value <= 48);
      const mites = ev.filter(r => r.kind === 'pop' && r.species === 'dustmite');
      let msg, good = false;
      if (c === 'dry' && before && after) { good = true; msg = `<b>Strong explanation.</b> Humidity fell from above 55% to below 48% around week 2, when the heating came on. Dust mites can't drink. They absorb water from the air, so dry air dehydrated the colony.${mites.length >= 2 ? ' Your mite counts show the crash following the drop.' : ' Add mite counts from before and after to make it airtight.'}`; }
      else if (c === 'dry') msg = `<b>Right idea, thin evidence.</b> Pin a humidity reading from before the change (week 1) and one from after (week 3 or later) to show the air really dried out.`;
      else if (c === 'pred') msg = `<b>Check the predators.</b> Count predatory mites over time. If they ate the colony, their numbers should rise as dust mites fall. Do they?`;
      else if (c === 'vac') msg = `<b>Look at the timeline.</b> Vacuuming removes mites at once and they bounce back. Was this a single drop, or a steady decline? What else changed?`;
      else msg = `<b>Think about the food.</b> Maya still lives there and sheds skin every day. What else does a dust mite need besides food?`;
      el.querySelector('#fb').innerHTML = `<div class="feedback ${good ? 'good' : ''}">${msg}</div>`;
      log('claim_submit', { case: 'mites', cause: c, evidence: ev.length, humidity_before: before, humidity_after: after, correct: good });
      if (good) { store.cases.mites = { ...(store.cases.mites || {}), solved: true, solvedAt: new Date().toISOString() }; save(); }
    };
  });
}

// ---------- research log ----------
$('bLog').onclick = () => {
  sheet(`<div class="sheet-h"><div><div class="caps">Research</div><h2>Research log</h2></div><button class="btn quiet" data-close>Done</button></div>
    <p>This device has logged <b class="num">${store.log.length}</b> events. Each event records what was tapped, measured or changed, with a time, a random install ID and a random session ID.</p>
    <p>No names, photos or camera images are stored or sent anywhere. The log stays on this device until you download it.</p>
    <div class="tools"><button class="btn primary" id="bDl">Download JSON</button><button class="btn" id="bCopy">Copy</button></div>`, () => {
    const data = () => JSON.stringify({ app: 'undersurface', version: '0.2', exported: new Date().toISOString(), install: store.install, events: store.log }, null, 1);
    $('bDl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data()], { type: 'application/json' })); a.download = `undersurface-log-${store.install}-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); };
    $('bCopy').onclick = async () => { try { await navigator.clipboard.writeText(data()); toast('Log copied'); } catch (e) { toast('Copy not allowed here. Use Download.'); } };
  });
};
$('bReset').onclick = () => sheet(`<div class="sheet-h"><h2>Erase everything?</h2><button class="btn quiet" data-close>Cancel</button></div><p>Deletes all sites, the field guide, case progress and the research log on this device.</p><button class="btn primary" id="bErase" style="width:100%">Erase</button>`, () => {
  $('bErase').onclick = () => { store = { v: 1, install: rid(), sites: [], guide: {}, log: [], cases: {} }; save(); closeSheet(); renderHome(); toast('Erased'); };
});
$('bDev').onclick = () => { store.sites.forEach(s => s.anchorReal -= 86400000); save(); renderHome(); toast('Moved every site 1 real day (1 simulated week) forward'); };

// ---------- stage: world-anchored x-ray, camera tracking, continuous zoom ----------
const stage = $('stage'), ctx = stage.getContext('2d');
let W = 0, H = 0, DPR = 1, area = { t: 0, b: 0 };
const off = { x: 0, y: 0 };          // how far the real surface has moved on screen (camera tracking, or panning a sample)
let zoom = 1, trans = null, lastZoomInput = 0;
const MULT = [0, 1, 1.8, 3];         // magnified layers slide faster than the surface, like a real lens
const TILE = () => Math.round(lens.R * 3);
const wrapd = (v, T) => ((v % T) + 1.5 * T) % T - T / 2;

function layout() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  if (stage.width !== Math.round(W * DPR) || stage.height !== Math.round(H * DPR)) { stage.width = Math.round(W * DPR); stage.height = Math.round(H * DPR); }
  if (mode === 'xray') {
    const top = document.querySelector('#xray .topbar').offsetHeight, bot = document.querySelector('#xray .panel').offsetHeight;
    area = { t: top, b: H - bot };
    const ah = area.b - area.t, railW = 88;
    const R = Math.round(Math.max(90, W < 600 ? Math.min(W * 0.44, ah * 0.42) : Math.min((W - railW * 2) * 0.5, ah * 0.44, 340)));
    if (R !== lens.R) { lens.R = R; _cut = {}; agents = []; }
    if (!lens.placed) { lens.x = W / 2; lens.y = area.t + ah / 2; }
    clampLens();
    $('rail').style.top = (top + 12) + 'px';
  }
}
function clampLens() { lens.x = clamp(lens.x, lens.R * 0.5, W - lens.R * 0.5); lens.y = clamp(lens.y, area.t + lens.R * 0.5, area.b - lens.R * 0.5); }
addEventListener('resize', layout);
const lensWorld = () => ({ x: lens.x - off.x * MULT[tier], y: lens.y - off.y * MULT[tier] });
function localOf(a, lw, T) { return { x: wrapd(a.wx - lw.x, T), y: wrapd(a.wy - lw.y, T) }; }
function inLensAgents() { const T = TILE(), lw = lensWorld(), half = lens.R / zoom; return agents.filter(a => { if (a.dying) return false; const p = localOf(a, lw, T); return p.x * p.x + p.y * p.y < half * half; }); }

// ---- tier changes: snapshot the old view and zoom through it ----
function snapshot() {
  const R = lens.R, c = document.createElement('canvas'); c.width = c.height = Math.round(2 * R * DPR);
  try { c.getContext('2d').drawImage(stage, (lens.x - R) * DPR, (lens.y - R) * DPR, 2 * R * DPR, 2 * R * DPR, 0, 0, c.width, c.height); } catch (e) {}
  return c;
}
function setTier(t, via) {
  t = clamp(t, 1, 3); if (t === tier || !site) return;
  const dir = t > tier ? 1 : -1;
  if (mode === 'xray') trans = { img: snapshot(), t: 0, dir };
  tier = t; agents = [];
  if (via !== 'pinch') zoom = dir > 0 ? 0.62 : 1.5;
  $('rail').querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', +b.dataset.t === t));
  log('tier', { site: site.id, tier: t, via: via || 'rail' });
}
function applyZoom(z, via) {
  if (z > 1.6 && tier < 3) { setTier(tier + 1, via); z /= 1.6; }
  else if (z < 0.62 && tier > 1) { setTier(tier - 1, via); z *= 1.6; }
  zoom = clamp(z, tier === 1 ? 0.75 : 0.5, tier === 3 ? 1.5 : 2);
  lastZoomInput = performance.now();
  return zoom;
}

// ---- input ----
const ptrs = new Map(); let drag = null, pinch = null;
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
stage.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
stage.addEventListener('pointerdown', e => {
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (mode !== 'xray') return;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, base: zoom }; drag = null; return; }
  const inLens = Math.hypot(e.clientX - lens.x, e.clientY - lens.y) < lens.R;
  drag = { x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, ox: lens.x - e.clientX, oy: lens.y - e.clientY, kind: inLens ? 'lens' : bg && bg.kind === 'sample' ? 'pan' : 'follow', moved: false };
});
stage.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), z = pinch.base * d / pinch.d0, nz = applyZoom(z, 'pinch');
    if (Math.abs(nz - z) > 1e-6) { pinch.base = nz; pinch.d0 = d; }
    return;
  }
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true;
  if (drag.moved) {
    if (drag.kind === 'lens') { lens.x = e.clientX + drag.ox; lens.y = e.clientY + drag.oy; }
    else if (drag.kind === 'follow') { lens.x = e.clientX; lens.y = e.clientY; }
    else { off.x += e.clientX - drag.lx; off.y += e.clientY - drag.ly; }
    if (drag.kind !== 'pan') { lens.placed = true; clampLens(); }
  }
  drag.lx = e.clientX; drag.ly = e.clientY;
});
function endPtr(e) {
  if (drag && !drag.moved && ptrs.size === 1 && mode === 'xray') tap(e.clientX, e.clientY);
  if (drag && drag.moved) log(drag.kind === 'pan' ? 'surface_pan' : 'lens_move', {});
  if (pinch && ptrs.size <= 2) log('pinch', { tier, zoom: +zoom.toFixed(2) });
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) drag = null;
}
stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
let lastWheel = 0;
stage.addEventListener('wheel', e => {
  e.preventDefault(); if (mode !== 'xray') return;
  if (e.ctrlKey) { applyZoom(zoom * Math.exp(-e.deltaY * 0.01), 'trackpad'); return; }   // trackpad pinch
  if (performance.now() - lastWheel < 350 || Math.abs(e.deltaY) < 4) return; lastWheel = performance.now(); setTier(tier + (e.deltaY < 0 ? 1 : -1), 'wheel');
}, { passive: false });

function tap(x, y) {
  if (Math.hypot(x - lens.x, y - lens.y) > lens.R) { lens.x = x; lens.y = y; lens.placed = true; clampLens(); log('lens_move', { via: 'tap' }); return; }
  const T = TILE(), lw = lensWorld(); let best = null, bd = 1e9;
  for (const a of agents) {
    if (a.dying) continue;
    const p = localOf(a, lw, T), ax = lens.x + p.x * zoom, ay = lens.y + p.y * zoom, d = Math.hypot(x - ax, y - ay);
    const hit = a.speck ? 22 : Math.max(26, a.size * zoom * (SPECIES[a.s].colony ? 0.4 : 0.6));
    if (d < hit && d < bd) { bd = d; best = a; }
  }
  if (!best) return;
  if (best.speck) { const sp = SPECIES[best.s]; toast(`Something tiny is here. Zoom in to ${TIERS[sp.tier].name} ${TIERS[sp.tier].mag} to see it.`); log('speck_tap', { species: best.s, tier }); return; }
  spot(best.s);
}

// ---- camera tracking: global image shift between frames (block matching on a 96x72 grey frame) ----
const FW = 96, FH = 72, fcv = document.createElement('canvas'); fcv.width = FW; fcv.height = FH;
const fctx = fcv.getContext('2d', { willReadFrequently: true }); let prevG = null; const track = { ok: false, lost: 0 };
function grey(d, n) { const g = new Float32Array(n); let m = 0; for (let i = 0; i < n; i++) { g[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11; m += g[i]; } m /= n; for (let i = 0; i < n; i++) g[i] -= m; return g; }
function estimateShift(a, b, w, h, S) {          // returns (dx,dy) such that b(p + d) ≈ a(p)
  const m = S + 2; let v = 0, n = 0;
  for (let y = m; y < h - m; y += 2) for (let x = m; x < w - m; x += 2) { v += a[y * w + x] * a[y * w + x]; n++; }
  if (v / n < 25) return null;                        // too little texture to track (e.g. a plain painted wall)
  const N = 2 * S + 1, cost = new Float32Array(N * N); let best = Infinity, bi = 0, sum = 0;
  for (let dy = -S; dy <= S; dy++) for (let dx = -S; dx <= S; dx++) {
    let sad = 0; const o = dy * w + dx;
    for (let y = m; y < h - m; y += 2) { const r = y * w; for (let x = m; x < w - m; x += 2) { const i = r + x; sad += Math.abs(b[i + o] - a[i]); } }
    const k = (dy + S) * N + dx + S; cost[k] = sad; sum += sad; if (sad < best) { best = sad; bi = k; }
  }
  if (best > 0.8 * sum / (N * N)) return null;        // no clear winner: blur or a repeating pattern
  const bx = bi % N - S, by = ((bi / N) | 0) - S, c = i => cost[i];
  const sub = (l, c0, r) => { const den = l - 2 * c0 + r; return den > 0 ? clamp(0.5 * (l - r) / den, -0.5, 0.5) : 0; };
  const sx = Math.abs(bx) < S ? sub(c(bi - 1), best, c(bi + 1)) : 0, sy = Math.abs(by) < S ? sub(c(bi - N), best, c(bi + N)) : 0;
  return { dx: bx + sx, dy: by + sy };
}
function trackCamera() {
  if (!bg || bg.kind !== 'camera' || !cam.videoWidth || cam.readyState < 2) { prevG = null; return; }
  fctx.drawImage(cam, 0, 0, FW, FH);
  const g = grey(fctx.getImageData(0, 0, FW, FH).data, FW * FH);
  if (prevG) {
    const e = estimateShift(prevG, g, FW, FH, 8);
    if (e) {
      const k = (cam.videoWidth / FW) * Math.max(W / cam.videoWidth, H / cam.videoHeight);
      let dx = e.dx * k, dy = e.dy * k; if (Math.hypot(dx, dy) < 0.5) dx = dy = 0;
      off.x += dx; off.y += dy; track.ok = true; track.lost = 0;
    } else { track.lost++; if (track.lost > 20) track.ok = false; }
  }
  prevG = g;
}

// ---- agents live in a wrapping world tile (T x T) per magnification ----
function sizeFor(a) {
  const sp = SPECIES[a.s], R = lens.R;
  if (a.speck) return 2 + (4 - sp.tier) * 0.5;
  if (sp.colony) return R * (0.3 + 0.45 * Math.min(1, a.pop / 120)) * (0.8 + a.r * 0.4);
  return R * (SIZE[a.s] || 0.25) * (0.85 + a.r * 0.3);
}
function syncAgents(st) {
  const T = TILE(), F = T * T / (Math.PI * lens.R * lens.R);
  for (const s in st.pops) {
    const sp = SPECIES[s], pop = st.pops[s];
    let full = 0, specks = 0;
    if (sp.tier === tier) full = Math.min(sp.colony ? 14 : 42, Math.round(pop / sp.per * F));
    else if (sp.tier > tier) specks = Math.min(90, Math.round(pop / sp.per * 1.5 * F));
    for (const [want, speck] of [[full, false], [specks, true]]) {
      const alive = agents.filter(a => a.s === s && a.speck === speck && !a.dying);
      for (let i = alive.length; i < want; i++) {
        const a = { s, speck, wx: Math.random() * T, wy: Math.random() * T, a: Math.random() * 7, r: Math.random(), seed: (Math.random() * 1e6) | 0, pop, ph: Math.random() * 10, al: agents.length ? 0 : 1, dying: false };
        a.size = sizeFor(a); agents.push(a);
      }
      for (let i = want; i < alive.length; i++) alive[(Math.random() * alive.length) | 0].dying = true;
      if (sp.colony && !speck) alive.forEach(a => { if (Math.abs(a.pop - pop) > 1) { a.pop += (pop - a.pop) * 0.2; a.size = sizeFor(a); } });
    }
  }
}
let _cut = {};
function cut(T) {
  const k = tier + '|' + T;
  return _cut[k] || (_cut[k] = cutaway(site.biome, tier, T, site.color && !site.mystery ? site.color : SAMPLE_COLOR[site.biome], site.seed, Math.min(DPR, 1.5)));
}
function drawCover(src, sw, sh) { const s = Math.max(W / sw, H / sh), w = sw * s, h = sh * s; ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h); }
function drawBg() {
  const src = bgSource(); if (!src) return;
  if (bg.kind === 'camera') { drawCover(...src); return; }
  const [c, sw, sh] = src, s = Math.max(W / sw, H / sh), tw = sw * s, th = sh * s;
  const x0 = ((off.x % tw) + tw) % tw - tw, y0 = ((off.y % th) + th) % th - th;
  for (let x = x0; x < W; x += tw) for (let y = y0; y < H; y += th) ctx.drawImage(c, x, y, tw + 1, th + 1);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  if (mode === 'scan' || mode === 'xray') {
    if (mode === 'xray') trackCamera();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, W, H);
    drawBg();
    if (mode === 'scan') drawReticle();
    if (mode === 'xray' && site) drawXray(t, dt);
  }
  requestAnimationFrame(frame);
}
function drawReticle() {
  const s = Math.min(W, H) * 0.5, x = (W - s) / 2, y = (H - s) / 2, L = 28;
  ctx.fillStyle = 'rgba(17,17,17,0.35)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip(); drawBg(); ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  [[x, y, 1, 1], [x + s, y, -1, 1], [x, y + s, 1, -1], [x + s, y + s, -1, -1]].forEach(([cx, cy, dx, dy]) => { ctx.beginPath(); ctx.moveTo(cx + dx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * L); ctx.stroke(); });
}
function drawXray(t, dt) {
  if (playing) {
    const n = currentDay(site); viewOffset += dt * PLAY_RATE;
    if (n + viewOffset >= n + FORECAST) { viewOffset = FORECAST; playing = false; log('timelapse_end', { site: site.id }); }
  }
  updateTimeUI();
  if (!pinch && performance.now() - lastZoomInput > 160) zoom += (1 - zoom) * Math.min(1, dt * 9);
  const st = stateLerp(site, viewDayF()); syncAgents(st);
  const { x, y, R } = lens, T = TILE(), lw = lensWorld(), z = zoom, half = R / z;
  ctx.fillStyle = 'rgba(17,17,17,0.4)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();
  ctx.translate(x, y); ctx.scale(z, z);
  const tl = cut(T);
  for (let kx = Math.floor((lw.x - half) / T); kx <= Math.floor((lw.x + half) / T); kx++)
    for (let ky = Math.floor((lw.y - half) / T); ky <= Math.floor((lw.y + half) / T); ky++) ctx.drawImage(tl, kx * T - lw.x, ky * T - lw.y, T + 0.5, T + 0.5);
  if (st.env.rh > 68) { ctx.fillStyle = `rgba(56,104,150,${Math.min(0.28, (st.env.rh - 68) / 110)})`; ctx.fillRect(-half, -half, half * 2, half * 2); }
  if (st.env.rh < 45) { ctx.fillStyle = `rgba(198,160,104,${Math.min(0.22, (45 - st.env.rh) / 80)})`; ctx.fillRect(-half, -half, half * 2, half * 2); }
  const order = a => a.speck ? 1 : SPECIES[a.s].colony ? 0 : 2;
  agents.sort((p, q) => order(p) - order(q));
  const v0 = 1.4 * R;
  for (const a of agents) {
    const sp = SPECIES[a.s];
    a.al = a.dying ? a.al - dt * 2.5 : Math.min(1, a.al + dt * 2.5);
    if (sp.speed && !a.speck) { a.a += (Math.random() - 0.5) * 3 * dt; a.wx += Math.cos(a.a) * sp.speed * v0 * dt; a.wy += Math.sin(a.a) * sp.speed * v0 * dt; }
    else if (a.speck) { a.wx += (Math.random() - 0.5) * 0.6; a.wy += (Math.random() - 0.5) * 0.6; }
    a.wx = ((a.wx % T) + T) % T; a.wy = ((a.wy % T) + T) % T;
    const p = localOf(a, lw, T), m = half + a.size;
    if (Math.abs(p.x) > m || Math.abs(p.y) > m || a.al <= 0) continue;
    ctx.globalAlpha = Math.max(0, a.al);
    if (a.speck) { ctx.fillStyle = sp.ink; ctx.globalAlpha *= 0.75; ctx.beginPath(); ctx.arc(p.x, p.y, a.size / z, 0, 7); ctx.fill(); }
    else drawOrganism(ctx, a.s, p.x, p.y, a.size, sp.colony ? a.r * 6 : a.a, t + a.ph, { seed: a.seed });
  }
  agents = agents.filter(a => !(a.dying && a.al <= 0));
  ctx.restore(); ctx.globalAlpha = 1;
  if (trans) {
    trans.t += dt / 0.35;
    if (trans.t >= 1) trans = null;
    else { ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip(); ctx.globalAlpha = 1 - trans.t; const s = trans.dir > 0 ? 1 + trans.t * 0.9 : 1 - trans.t * 0.4; ctx.translate(x, y); ctx.scale(s, s); ctx.drawImage(trans.img, -R, -R, R * 2, R * 2); ctx.restore(); ctx.globalAlpha = 1; }
  }
  // ring, ticks and a grip that says "drag me"
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (R - 10), y + Math.sin(a) * (R - 10)); ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); ctx.stroke(); }
  const ga = Math.PI * 0.25, gx = x + Math.cos(ga) * R, gy = y + Math.sin(ga) * R;
  ctx.fillStyle = '#F7F7F5'; ctx.beginPath(); ctx.arc(gx, gy, 9, 0, 7); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.moveTo(gx - 4, gy - 2); ctx.lineTo(gx + 4, gy - 2); ctx.moveTo(gx - 4, gy + 2); ctx.lineTo(gx + 4, gy + 2); ctx.stroke();
  // scale bar + status, fixed top-left like microscope software
  const bw = R * 0.45 * z, bx = 20, by = area.t + 26;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.moveTo(bx, by - 5); ctx.lineTo(bx, by + 5); ctx.moveTo(bx + bw, by - 5); ctx.lineTo(bx + bw, by + 5); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '12px "Helvetica Neue", Helvetica, Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(W < 600 ? TIERS[tier].bar : `${TIERS[tier].bar}  ·  ${TIERS[tier].name} ${TIERS[tier].mag}`, bx, by + 20);
  if (bg.kind === 'camera' && !track.ok) { ctx.fillStyle = '#fff'; ctx.fillText('Not tracking: move slowly over a textured spot', bx, by + 38); }
  if (Math.round(viewOffset) !== 0 || playing) {
    const label = `${viewOffset > 0 ? 'Forecast' : 'Looking back'} · ${dayLabel(viewDay())}`;
    ctx.font = 'bold 14px "Helvetica Neue", Helvetica, Arial, sans-serif'; ctx.textAlign = 'center';
    const ly = y - R - 14 > area.t + 60 ? y - R - 14 : y + R + 24;
    ctx.fillStyle = '#fff'; ctx.fillText(label, x, ly);
  }
}

// ---------- boot ----------
log('session_start', { ua: navigator.userAgent.slice(0, 120), w: innerWidth, h: innerHeight, speed: SPEED });
show('home'); layout(); requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { if (document.hidden) { log('session_hide', {}); } });
