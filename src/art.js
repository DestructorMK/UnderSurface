// Undersurface — flat vector art: organisms, cutaways, sample surfaces
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function rgbStr(c, a) { return a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function shade(c, k) { return k >= 0 ? c.map(v => v + (255 - v) * k) : c.map(v => v * (1 + k)); }
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

// ---------- organisms (origin = centre, facing +x, s = body length in px) ----------
function legs(ctx, pts, s, t, col, lw) {
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  pts.forEach((p, i) => {
    const w = Math.sin(t * 9 + i * 1.7) * 0.06 * s;
    ctx.beginPath(); ctx.moveTo(p[0] * s, p[1] * s);
    ctx.quadraticCurveTo(p[2] * s + w, p[3] * s, p[4] * s + w, p[5] * s); ctx.stroke();
  });
}
function ell(ctx, x, y, rx, ry, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

const DRAW = {
  dustmite(ctx, s, t, c, k) {
    const legPts = [];
    [-1, 1].forEach(sd => { [0.28, 0.12, -0.08, -0.24].forEach((x, i) => legPts.push([x, sd * 0.2, x + (i < 2 ? 0.12 : -0.12), sd * 0.42, x + (i < 2 ? 0.2 : -0.2), sd * 0.5])); });
    legs(ctx, legPts, s, t, k, Math.max(1, s * 0.035));
    ell(ctx, 0, 0, s * 0.42, s * 0.3, c);
    ell(ctx, s * 0.42, 0, s * 0.1, s * 0.08, k);
    ctx.strokeStyle = k; ctx.lineWidth = Math.max(0.8, s * 0.015);
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.38, (i - 1.5) * s * 0.08); ctx.lineTo(-s * 0.55, (i - 1.5) * s * 0.14); ctx.stroke(); }
    if (c !== k) { ctx.globalAlpha *= 0.35; ell(ctx, -s * 0.05, -s * 0.06, s * 0.2, s * 0.1, '#fff'); ctx.globalAlpha /= 0.35; }
  },
  predmite(ctx, s, t, c, k) {
    const legPts = [];
    [-1, 1].forEach(sd => { [0.22, 0.08, -0.06, -0.2].forEach((x, i) => legPts.push([x, sd * 0.16, x + (i < 2 ? 0.16 : -0.14), sd * 0.4, x + (i < 2 ? 0.26 : -0.24), sd * 0.52])); });
    legs(ctx, legPts, s, t, k, Math.max(1, s * 0.035));
    ell(ctx, -s * 0.02, 0, s * 0.36, s * 0.24, c);
    ell(ctx, s * 0.34, 0, s * 0.1, s * 0.08, k);
    ctx.strokeStyle = k; ctx.lineWidth = Math.max(1.2, s * 0.05); ctx.lineCap = 'round';
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(s * 0.4, sd * s * 0.05); ctx.quadraticCurveTo(s * 0.6, sd * s * 0.2, s * 0.62, sd * s * 0.04); ctx.stroke(); });
  },
  booklouse(ctx, s, t, c, k) {
    const legPts = [];
    [-1, 1].forEach(sd => { [0.12, 0.02, -0.08].forEach((x, i) => legPts.push([x, sd * 0.1, x + 0.02 - i * 0.06, sd * 0.28, x - i * 0.1, sd * 0.36])); });
    legs(ctx, legPts, s, t, k, Math.max(0.8, s * 0.025));
    ell(ctx, -s * 0.15, 0, s * 0.33, s * 0.17, c);
    ell(ctx, s * 0.25, 0, s * 0.15, s * 0.14, c);
    if (c !== k) { ctx.strokeStyle = k; ctx.lineWidth = Math.max(1, s * 0.02); ctx.beginPath(); ctx.ellipse(-s * 0.15, 0, s * 0.33, s * 0.17, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(s * 0.25, 0, s * 0.15, s * 0.14, 0, 0, 7); ctx.stroke(); }
    ell(ctx, s * 0.32, -s * 0.07, s * 0.03, s * 0.03, k); ell(ctx, s * 0.32, s * 0.07, s * 0.03, s * 0.03, k);
    ctx.strokeStyle = k; ctx.lineWidth = Math.max(0.8, s * 0.02);
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(s * 0.38, sd * s * 0.05); ctx.quadraticCurveTo(s * 0.6, sd * s * 0.12 + Math.sin(t * 4) * s * 0.03, s * 0.7, sd * s * 0.3); ctx.stroke(); });
    ctx.strokeStyle = k; ctx.globalAlpha *= 0.3; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.15 - i * s * 0.06 + s * 0.12, -s * 0.15); ctx.lineTo(-s * 0.15 - i * s * 0.06 + s * 0.12, s * 0.15); ctx.stroke(); } ctx.globalAlpha /= 0.3;
  },
  beetle(ctx, s, t, c, k) {
    const n = 9, cc = hex2rgb(c);
    for (let i = n - 1; i >= 0; i--) {
      const x = s * (0.42 - i * 0.1), w = s * (0.13 - Math.abs(i - 3) * 0.008) + Math.sin(t * 3 + i) * s * 0.004;
      ell(ctx, x, 0, s * 0.07, w, rgbStr(i % 2 ? shade(cc, 0.18) : cc));
    }
    ctx.strokeStyle = k; ctx.lineWidth = Math.max(0.8, s * 0.012);
    for (let i = 0; i < 10; i++) { const a = (i / 9 - 0.5) * 1.6; ctx.beginPath(); ctx.moveTo(-s * 0.42, 0); ctx.lineTo(-s * 0.42 - Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.22); ctx.stroke(); }
    for (let i = 0; i < 9; i++) { const x = s * (0.42 - i * 0.1); [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(x, sd * s * 0.12); ctx.lineTo(x + s * 0.02, sd * s * 0.19); ctx.stroke(); }); }
    ell(ctx, s * 0.5, 0, s * 0.07, s * 0.08, k);
  },
  silverfish(ctx, s, t, c, k) {
    const cc = hex2rgb(c); ctx.fillStyle = c; ctx.beginPath();
    ctx.moveTo(s * 0.45, 0); ctx.quadraticCurveTo(s * 0.4, -s * 0.13, s * 0.15, -s * 0.13);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.1, -s * 0.38, -s * 0.02); ctx.lineTo(-s * 0.38, s * 0.02);
    ctx.quadraticCurveTo(-s * 0.2, s * 0.1, s * 0.15, s * 0.13); ctx.quadraticCurveTo(s * 0.4, s * 0.13, s * 0.45, 0); ctx.fill();
    ctx.strokeStyle = rgbStr(shade(cc, -0.2)); ctx.lineWidth = Math.max(0.6, s * 0.01);
    for (let i = 0; i < 9; i++) { const x = s * (0.3 - i * 0.07), h = s * 0.12 * (1 - Math.max(0, -x / s) * 1.6); ctx.beginPath(); ctx.moveTo(x, -h); ctx.quadraticCurveTo(x - s * 0.02, 0, x, h); ctx.stroke(); }
    ctx.strokeStyle = k; ctx.lineWidth = Math.max(0.8, s * 0.012);
    [-1, 0, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(-s * 0.38, 0); ctx.quadraticCurveTo(-s * 0.55, sd * s * 0.06, -s * 0.72, sd * s * 0.16 + Math.sin(t * 5) * s * 0.02); ctx.stroke(); });
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(s * 0.45, sd * s * 0.03); ctx.quadraticCurveTo(s * 0.65, sd * s * 0.08, s * 0.78, sd * s * 0.22 + Math.sin(t * 6) * s * 0.02); ctx.stroke(); });
  },
  spider(ctx, s, t, c, k) {
    const legPts = [];
    [-1, 1].forEach(sd => { [[0.25, 0.55, 0.62], [0.17, 0.25, 0.6], [0.1, -0.05, 0.58], [0.05, -0.3, 0.55]].forEach(([x0, x2, y2], i) => legPts.push([x0 + 0.1, sd * 0.08, (x0 + x2) / 2 + 0.05, sd * 0.42, x2, sd * y2 * 0.85])); });
    legs(ctx, legPts, s, t * 0.3, k, Math.max(1, s * 0.03));
    ell(ctx, -s * 0.18, 0, s * 0.26, s * 0.24, c);
    ell(ctx, s * 0.17, 0, s * 0.14, s * 0.12, rgbStr(shade(hex2rgb(c), -0.25)));
    ctx.fillStyle = rgbStr(shade(hex2rgb(c), 0.35)); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-s * 0.25 + i * s * 0.08, -s * 0.05 + (i % 2) * s * 0.1, s * 0.035, 0, 7); ctx.fill(); }
  },
  springtail(ctx, s, t, c, k) {
    const legPts = [];
    [-1, 1].forEach(sd => { [0.15, 0.05, -0.05].forEach((x, i) => legPts.push([x, sd * 0.08, x, sd * 0.2, x - 0.04, sd * 0.26])); });
    legs(ctx, legPts, s, t, k, Math.max(0.8, s * 0.025));
    ell(ctx, -s * 0.05, 0, s * 0.33, s * 0.11, c);
    ell(ctx, s * 0.3, 0, s * 0.1, s * 0.09, rgbStr(shade(hex2rgb(c), -0.2)));
    ctx.strokeStyle = k; ctx.lineWidth = Math.max(0.9, s * 0.025);
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(s * 0.38, sd * s * 0.03); ctx.lineTo(s * 0.5, sd * s * 0.1); ctx.lineTo(s * 0.62, sd * s * 0.12 + Math.sin(t * 5) * s * 0.02); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.lineTo(-s * 0.55, s * 0.02); ctx.stroke();
  },
  woodworm(ctx, s, t, c, k) {
    const cc = hex2rgb(c);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.15 + i * 0.12) + Math.sin(t * 1.5) * 0.04, r = s * 0.28;
      ell(ctx, Math.cos(a) * r - s * 0.05, Math.sin(a) * r - s * 0.1, s * 0.11 - i * s * 0.004, s * 0.11 - i * s * 0.004, rgbStr(i % 2 ? shade(cc, -0.06) : cc));
    }
    const a0 = Math.PI * 0.12; ell(ctx, Math.cos(a0) * s * 0.28 - s * 0.03, Math.sin(a0) * s * 0.28 - s * 0.12, s * 0.07, s * 0.07, k);
  },
};

function drawColony(ctx, sp, size, seed, sil, t) {
  const r = rng(seed), col = sil || sp.color, k = sil || sp.ink;
  ctx.strokeStyle = sil || (sp === SPECIES.fungus ? '#F7F4EA' : sp.color); ctx.lineCap = 'round';
  const branch = (x, y, a, len, w, depth) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * len * 0.4, (y + y2) / 2 + (r() - 0.5) * len * 0.4, x2, y2); ctx.stroke();
    if (depth > 0) { branch(x2, y2, a + (r() - 0.5) * 1.2 - 0.3, len * 0.72, w * 0.75, depth - 1); if (r() < 0.75) branch(x2, y2, a + (r() - 0.5) * 1.2 + 0.3, len * 0.62, w * 0.7, depth - 1); }
    else if (sp === SPECIES.mold) { ctx.fillStyle = k; ctx.beginPath(); ctx.arc(x2, y2, w * 2.2, 0, 7); ctx.fill(); ctx.fillStyle = col; for (let i = 0; i < 5; i++) { const aa = a + (i - 2) * 0.5; ctx.beginPath(); ctx.arc(x2 + Math.cos(aa) * w * 3.2, y2 + Math.sin(aa) * w * 3.2, w * 1.1, 0, 7); ctx.fill(); } }
  };
  const arms = 7 + (r() * 4 | 0);
  for (let i = 0; i < arms; i++) branch(0, 0, i / arms * Math.PI * 2 + r() * 0.4, size * 0.34, Math.max(1, size * 0.03), 3);
  ctx.fillStyle = sil || (sp === SPECIES.fungus ? '#E2DAC4' : sp.ink); ctx.beginPath(); ctx.arc(0, 0, size * 0.06, 0, 7); ctx.fill();
}

function drawOrganism(ctx, id, x, y, size, ang, t, opts = {}) {
  const sp = SPECIES[id];
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  if (sp.colony) drawColony(ctx, sp, size, opts.seed || 7, opts.sil, t);
  else DRAW[id](ctx, size, t, opts.sil || sp.color, opts.sil ? opts.sil : sp.ink);
  ctx.restore();
}

const _thumbs = {};
function thumb(id, locked) {
  const key = id + (locked ? ':l' : ''); if (_thumbs[key]) return _thumbs[key];
  const c = document.createElement('canvas'); c.width = c.height = 240; const ctx = c.getContext('2d');
  drawOrganism(ctx, id, 120, 120, SPECIES[id].colony ? 210 : 150, SPECIES[id].colony ? 0 : -0.35, 0.4, { sil: locked ? '#C9C7C1' : null, seed: 11 });
  return (_thumbs[key] = c.toDataURL());
}

// ---------- seamless cutaway tiles (tile size T, world-anchored) ----------
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
}
function h01(a, b) { return hash((a * 73856093) ^ (b * 19349663)); }
// base(x, T): drawn once and periodic by construction. shapes(x, T, r): drawn in a 3x3 wrap so edges join.
function tile(T, scale, seed, base, shapes) {
  const c = document.createElement('canvas'); c.width = c.height = Math.round(T * scale); const x = c.getContext('2d'); x.scale(scale, scale);
  base(x, T);
  if (shapes) for (const dx of [-T, 0, T]) for (const dy of [-T, 0, T]) { x.save(); x.translate(dx, dy); shapes(x, T, rng(seed)); x.restore(); }
  return c;
}
function blob(x, cx, cy, rr, r, col) { x.fillStyle = col; x.beginPath(); for (let j = 0; j < 7; j++) { const a = j / 7 * Math.PI * 2, q = rr * (0.6 + r() * 0.6); j ? x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q) : x.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fill(); }

function cutaway(biome, tier, T, B, seed, scale = 1) {
  const S = seed + tier * 101;
  if (biome === 'carpet') {
    if (tier === 1) return tile(T, scale, S, (x, T) => { x.fillStyle = rgbStr(shade(B, -0.45)); x.fillRect(0, 0, T, T); }, (x, T, r) => {
      x.lineCap = 'round';
      for (let i = 0; i < 900; i++) {
        const px = r() * T, py = r() * T, len = T * (0.03 + r() * 0.035), a = -Math.PI / 2 + (r() - 0.5) * 0.9;
        x.strokeStyle = rgbStr(shade(B, (r() - 0.5) * 0.35)); x.lineWidth = T / 230 + r() * T / 420;
        x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.6) * len * 0.5, py + Math.sin(a + 0.6) * len * 0.5, px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke();
      }
      for (let i = 0; i < 120; i++) { x.fillStyle = 'rgba(240,232,216,0.8)'; x.fillRect(r() * T, r() * T, 1.5 + r() * 2, 1.5 + r() * 2); }
    });
    if (tier === 2) return tile(T, scale, S, (x, T) => { x.fillStyle = rgbStr(shade(B, -0.55)); x.fillRect(0, 0, T, T); }, (x, T, r) => {
      x.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const y0 = r() * T, w = T * (0.04 + r() * 0.03), col = shade(B, (r() - 0.5) * 0.3), c1 = (r() - 0.5) * T * 0.6, c2 = (r() - 0.5) * T * 0.6;
        x.strokeStyle = rgbStr(col); x.lineWidth = w;
        x.beginPath(); x.moveTo(0, y0); x.bezierCurveTo(T * 0.33, y0 + c1, T * 0.66, y0 + c2, T, y0); x.stroke();
        x.strokeStyle = rgbStr(shade(col, 0.18)); x.lineWidth = w * 0.22;
        x.beginPath(); x.moveTo(0, y0 - w * 0.2); x.bezierCurveTo(T * 0.33, y0 + c1 - w * 0.2, T * 0.66, y0 + c2 - w * 0.2, T, y0 - w * 0.2); x.stroke();
      }
      for (let i = 0; i < 40; i++) blob(x, r() * T, r() * T, T * (0.01 + r() * 0.018), r, '#EFE7D6');
    });
    return tile(T, scale, S, (x, T) => {
      x.fillStyle = rgbStr(shade(B, 0.25)); x.fillRect(0, 0, T, T);
      x.strokeStyle = rgbStr(shade(B, -0.08)); x.lineWidth = Math.max(1, T / 400);
      const sc = T / 12, rs = T / 16;
      for (let row = -1; row <= 16; row++) for (let col = -1; col <= 12; col++) { const cx = col * sc + (((row % 2) + 2) % 2) * sc / 2, cy = row * rs; x.beginPath(); x.arc(cx, cy, sc * 0.55, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); }
    });
  }
  if (biome === 'wall') {
    if (tier === 1) return tile(T, scale, S, (x, T) => {
      x.fillStyle = '#ECEAE4'; x.fillRect(0, 0, T, T);
      x.fillStyle = rgbStr(B); x.fillRect(0, 0, T, T * 0.1);
      x.fillStyle = '#DDD3BC'; x.fillRect(0, T * 0.1, T, T * 0.03); x.fillRect(0, T * 0.55, T, T * 0.025);
      x.fillStyle = '#2F2C29'; x.fillRect(0, T * 0.575, T, T * 0.425);
      x.fillStyle = '#8A6A47'; x.fillRect(T * 0.62, T * 0.575, T * 0.1, T * 0.425);
      x.strokeStyle = '#6E5236'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(T * 0.63 + i * T * 0.015, T * 0.575); x.lineTo(T * 0.635 + i * T * 0.015, T); x.stroke(); }
    }, (x, T, r) => {
      for (let i = 0; i < 1400; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.5)'; x.fillRect(r() * T, T * 0.14 + r() * T * 0.4, 1 + r() * 2, 1 + r() * 2); }
      for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(220,210,190,0.35)'; x.fillRect(r() * T, T * 0.6 + r() * T * 0.38, 2, 2); }
    });
    if (tier === 2) return tile(T, scale, S, (x, T) => { x.fillStyle = '#D9D5CB'; x.fillRect(0, 0, T, T); }, (x, T, r) => {
      for (let i = 0; i < 420; i++) { const cx = r() * T, cy = r() * T, L = T * (0.025 + r() * 0.05), a = r() * Math.PI; x.save(); x.translate(cx, cy); x.rotate(a); x.fillStyle = r() < 0.5 ? '#F1EEE7' : '#C4BFB3'; x.fillRect(-L / 2, -L * 0.07, L, L * 0.14); x.restore(); }
    });
    return tile(T, scale, S, (x, T) => { x.fillStyle = '#E9E1CF'; x.fillRect(0, 0, T, T); }, (x, T, r) => {
      for (let i = 0; i < 14; i++) { const cx = r() * T, cy = r() * T, a = (r() - 0.5) * 1.4; x.save(); x.translate(cx, cy); x.rotate(a); x.fillStyle = r() < 0.5 ? '#F3ECDD' : '#D9CDB2'; x.fillRect(-T * 0.45, -T * 0.02, T * 0.9, T * 0.04); x.strokeStyle = 'rgba(120,100,70,0.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(-T * 0.45, 0); x.lineTo(T * 0.45, 0); x.stroke(); x.restore(); }
    });
  }
  // floor
  if (tier === 1) return tile(T, scale, S, (x, T) => {
    const n = 5, ph = T / n, r = rng(S);
    for (let p = 0; p < n; p++) {
      const y0 = p * ph, col = shade(B, (r() - 0.5) * 0.22);
      x.fillStyle = rgbStr(col); x.fillRect(0, y0, T, ph);
      x.save(); x.beginPath(); x.rect(0, y0, T, ph); x.clip();
      x.strokeStyle = rgbStr(shade(col, -0.22), 0.55); x.lineWidth = Math.max(1, T / 500);
      for (let g = 0; g < 12; g++) { const yy = y0 + r() * ph, amp = 2 + r() * 5, k = 1 + (r() * 3 | 0), o = r() * 6; x.beginPath(); for (let xx = 0; xx <= T; xx += 6) { const v = yy + Math.sin(xx / T * Math.PI * 2 * k + o) * amp; xx ? x.lineTo(xx, v) : x.moveTo(xx, v); } x.stroke(); }
      const jx = T * (0.15 + r() * 0.7); x.fillStyle = '#3B2716'; x.fillRect(jx, y0, T * 0.006, ph);
      x.restore();
      x.fillStyle = '#3B2716'; x.fillRect(0, y0 + ph - T * 0.005, T, T * 0.01);
      for (let d = 0; d < 10; d++) { x.fillStyle = 'rgba(230,220,200,0.7)'; x.fillRect(r() * T, y0 + ph - T * 0.004, 2, 2); }
    }
    x.fillStyle = '#3B2716'; x.fillRect(0, 0, T, T * 0.005);
  });
  if (tier === 2) return tile(T, scale, S, (x, T) => {
    x.fillStyle = rgbStr(shade(B, -0.35)); x.fillRect(0, 0, T, T);
    const cols = 7, rows = 16, cw = T / cols, chh = T / rows;
    for (let row = -1; row <= rows; row++) for (let col = -1; col <= cols; col++) {
      const wc = ((col % cols) + cols) % cols, wr = ((row % rows) + rows) % rows;
      const cx = col * cw + (wr % 2) * cw / 2 + (h01(wr, wc) - 0.5) * cw * 0.08, cy = row * chh;
      x.fillStyle = rgbStr(shade(B, 0.15 + (h01(wc, wr) - 0.5) * 0.1)); x.beginPath(); x.roundRect(cx + 3, cy + 2, cw - 6, chh - 4, 4); x.fill();
    }
  });
  return tile(T, scale, S, (x, T) => {
    x.fillStyle = rgbStr(shade(B, -0.3)); x.fillRect(0, 0, T, T);
    const cols = 3, rows = 4, cw = T / cols, chh = T / rows;
    for (let row = -1; row <= rows; row++) for (let col = -1; col <= cols; col++) {
      const wc = ((col % cols) + cols) % cols, wr = ((row % rows) + rows) % rows, cx = col * cw + (wr % 2) * cw / 2, cy = row * chh;
      x.fillStyle = rgbStr(shade(B, 0.28)); x.beginPath(); x.roundRect(cx + 8, cy + 8, cw - 16, chh - 16, 12); x.fill();
      x.fillStyle = rgbStr(shade(B, -0.05)); for (let p = 0; p < 6; p++) { x.beginPath(); x.arc(cx + 20 + h01(wr * 10 + p, wc) * (cw - 40), cy + 20 + h01(wc * 10 + p, wr) * (chh - 40), T * 0.008, 0, 7); x.fill(); }
    }
  });
}

// ---------- sample surfaces (seamless, used when no camera) ----------
const SAMPLE_COLOR = { carpet: [150, 138, 122], wall: [232, 228, 220], floor: [176, 124, 80] };
function makeSample(biome, color, seed = 3) {
  const W = 800, H = 600, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); const r = rng(seed);
  const B = color || SAMPLE_COLOR[biome];
  if (biome === 'carpet') {
    x.fillStyle = rgbStr(shade(B, -0.2)); x.fillRect(0, 0, W, H);
    for (let i = 0; i < 26000; i++) {
      const px = r() * W, py = r() * H, a = r() * Math.PI * 2, l = 3 + r() * 6;
      x.strokeStyle = rgbStr(shade(B, (r() - 0.5) * 0.5)); x.lineWidth = 1 + r() * 1.5;
      const ox = [0], oy = [0]; if (px < 12) ox.push(W); if (px > W - 12) ox.push(-W); if (py < 12) oy.push(H); if (py > H - 12) oy.push(-H);
      for (const dx of ox) for (const dy of oy) { x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(px + dx + Math.cos(a) * l, py + dy + Math.sin(a) * l); x.stroke(); }
    }
  } else if (biome === 'wall') {
    x.fillStyle = rgbStr(B); x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.05)'; x.fillRect(r() * W, r() * H, 2, 2); }
  } else {
    const ph = 100;
    for (let p = 0; p < H / ph; p++) {
      const col = shade(B, (r() - 0.5) * 0.2); x.fillStyle = rgbStr(col); x.fillRect(0, p * ph, W, ph);
      x.save(); x.beginPath(); x.rect(0, p * ph, W, ph); x.clip();
      x.strokeStyle = rgbStr(shade(col, -0.25), 0.5); x.lineWidth = 1.5;
      for (let g = 0; g < 22; g++) { const yy = p * ph + r() * ph, amp = 1 + r() * 4, k = 1 + (r() * 4 | 0), o = r() * 6; x.beginPath(); for (let xx = 0; xx <= W; xx += 10) { const v = yy + Math.sin(xx / W * Math.PI * 2 * k + o) * amp; xx ? x.lineTo(xx, v) : x.moveTo(xx, v); } x.stroke(); }
      x.fillStyle = 'rgba(40,25,12,0.8)'; x.fillRect(20 + r() * (W - 40), p * ph, 3, ph);
      x.restore();
      x.fillStyle = 'rgba(40,25,12,0.8)'; x.fillRect(0, p * ph + ph - 2, W, 3);
    }
  }
  return c;
}
