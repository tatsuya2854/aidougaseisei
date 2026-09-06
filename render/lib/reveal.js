/* ------------------------------------------------------------------
   The "?" -> product reveal, drawn on two 2D canvases: one behind the
   bottle image and one in front of it.

   The swap itself happens on a single frame while the front canvas is
   fully opaque over the bottle, so the illustrated product artwork is
   only ever shown as-is, never cross-dissolved or warped.
   ------------------------------------------------------------------ */

export const T = {
  aura:  [19.42, 19.86],   // purple magic gathers behind the "?" bottle
  bats:  [19.62, 20.22],   // bats spiral in
  smoke: [19.86, 20.22],   // smoke climbs and engulfs it
  swap:  20.205,           // <- the cut, hidden inside the smoke
  burst: [20.20, 20.58],   // flash, shockwave rings, star sparks
  clear: [20.21, 20.62],   // smoke lifts, bats scatter
  fall:  [20.55, 24.00]    // candy-corn confetti settles
};

const CX = 540, CY = 1121;              // bottle centre inside the 1080x1920 frame
const RX = 300, RY = 590;               // bottle half-extents, generously

const cl = (v, a, b) => v < a ? a : (v > b ? b : v);
const pr = (t, a, b) => cl((t - a) / (b - a), 0, 1);
const lp = (a, b, x) => a + (b - a) * x;
const eO = x => 1 - Math.pow(1 - x, 3);
const eI = x => x * x * x;
const eIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function rnd(i) {                        // deterministic per-particle noise
  let x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function glow(g, x, y, r, stops) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const s of stops) gr.addColorStop(s[0], s[1]);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
}

/* ---------------- bat ---------------- */
function wing(g) {
  g.moveTo(0, -0.05);
  g.bezierCurveTo(-0.52, -0.60, -1.02, -0.34, -1.18, 0.06);
  g.bezierCurveTo(-0.88, -0.06, -0.74, 0.12, -0.62, 0.32);
  g.bezierCurveTo(-0.54, 0.10, -0.37, 0.10, -0.27, 0.28);
  g.bezierCurveTo(-0.21, 0.10, -0.10, 0.05, 0, 0.15);
  g.closePath();
}
function bat(g, x, y, s, rot, flap, alpha, col) {
  if (alpha <= 0.004) return;
  g.save();
  g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.globalAlpha = alpha; g.fillStyle = col;
  g.beginPath(); g.ellipse(0, 0, 0.17, 0.30, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(-0.13, -0.24); g.lineTo(-0.05, -0.46); g.lineTo(0.02, -0.25);
  g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0.13, -0.24); g.lineTo(0.05, -0.46); g.lineTo(-0.02, -0.25);
  g.closePath(); g.fill();
  g.save(); g.scale(1, flap); g.beginPath(); wing(g); g.fill(); g.restore();
  g.save(); g.scale(-1, flap); g.beginPath(); wing(g); g.fill(); g.restore();
  g.restore();
}

/* ---------------- 4-point sparkle ---------------- */
function spark(g, x, y, r, alpha, col, rot) {
  if (alpha <= 0.004) return;
  g.save(); g.translate(x, y); g.rotate(rot || 0);
  g.globalAlpha = alpha; g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, -r); g.quadraticCurveTo(0.16 * r, -0.16 * r, r, 0);
  g.quadraticCurveTo(0.16 * r, 0.16 * r, 0, r);
  g.quadraticCurveTo(-0.16 * r, 0.16 * r, -r, 0);
  g.quadraticCurveTo(-0.16 * r, -0.16 * r, 0, -r);
  g.fill(); g.restore();
}

/* ---------------- candy corn ---------------- */
function candyCorn(g, x, y, s, rot, alpha) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.globalAlpha = alpha;
  const seg = [[-0.5, -0.16, '#FFFFFF'], [-0.16, 0.20, '#FFA53C'], [0.20, 0.5, '#FFD84A']];
  for (const q of seg) {
    const w0 = 0.30 + 0.34 * (q[0] + 0.5), w1 = 0.30 + 0.34 * (q[1] + 0.5);
    g.fillStyle = q[2]; g.beginPath();
    g.moveTo(-w0, q[0]); g.lineTo(w0, q[0]); g.lineTo(w1, q[1]); g.lineTo(-w1, q[1]);
    g.closePath(); g.fill();
  }
  g.restore();
}


/* ---------------- the smoke cloud ---------------- */
let _off = null;
function offscreen() {
  if (!_off) { _off = document.createElement('canvas'); _off.width = 1080; _off.height = 1920; }
  return _off;
}
function cloud(t, rise, lift) {
  const c = offscreen(), g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, 1080, 1920);

  const drift = lift * 900;                   // the whole cloud lifts away
  const puff = [];
  for (let i = 0; i < 58; i++) {
    const r0 = rnd(i), r1 = rnd(i + 90), r2 = rnd(i + 180), r3 = rnd(i + 260);
    const born = r0 * 0.44;
    const a = pr(rise, born, born + 0.44);
    if (a <= 0) continue;
    const spin = (0.55 + r2 * 1.25) * (i % 2 ? 1 : -1);
    const ang = r1 * 6.283 + t * spin * 0.55 + eO(a) * 1.5 * spin;
    const spread = lp(0.26, 1.00, eO(a)) * (1 + lift * 0.85);
    puff.push({
      x: CX + Math.cos(ang) * RX * spread * (0.50 + r2 * 0.85),
      y: CY + Math.sin(ang) * RY * spread * (0.34 + r0 * 0.62) - drift * (0.5 + r1 * 0.95),
      r: lp(40, 152, eO(a)) * (0.40 + r3 * 1.30) * (1 + lift * 0.45),
      s: r3
    });
  }
  // a spine of big lobes, so the bottle is genuinely covered at the peak
  const cover = Math.pow(pr(t, T.smoke[0] + 0.10, T.swap), 1.25)
                * (1 - pr(t, T.swap, T.swap + 0.22));
  for (let k = 0; k < 7; k++) {
    const yy = 620 + k * 170 - drift * 0.85;
    puff.push({ x: CX + Math.sin(t * 1.6 + k) * 46, y: yy,
                r: 250 * cover * (1 + lift * 0.35), s: 0.4 + 0.3 * rnd(k + 33) });
  }

  g.fillStyle = '#3B1F63';
  for (const p of puff) {
    if (p.r <= 1) continue;
    g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * (0.82 + p.s * 0.34), 0, 0, 7); g.fill();
  }

  // form: light on the upper left, ember warmth low down
  g.globalCompositeOperation = 'source-atop';
  for (const p of puff) {
    if (p.r <= 1) continue;
    const gr = g.createRadialGradient(p.x - p.r * 0.34, p.y - p.r * 0.40, 0,
                                      p.x - p.r * 0.34, p.y - p.r * 0.40, p.r * 1.25);
    gr.addColorStop(0.00, 'rgba(186,146,236,0.92)');
    gr.addColorStop(0.42, 'rgba(132,88,196,0.55)');
    gr.addColorStop(1.00, 'rgba(60,32,100,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(p.x - p.r * 0.34, p.y - p.r * 0.40, p.r * 1.25, 0, 7); g.fill();
  }
  for (let i = 0; i < 7; i++) {
    const r0 = rnd(i + 620), r1 = rnd(i + 700);
    const ex = CX + (r0 - 0.5) * 620, ey = CY + 220 + (r1 - 0.5) * 620 - drift;
    const gr = g.createRadialGradient(ex, ey, 0, ex, ey, 260);
    gr.addColorStop(0, 'rgba(255,158,80,0.30)');
    gr.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(ex, ey, 260, 0, 7); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  return c;
}

/* ================= behind the bottle ================= */
export function drawBack(g, t) {
  g.clearRect(0, 0, 1080, 1920);
  if (t < T.aura[0] || t > 24.0) return;

  // purple magic pooling behind the mystery bottle
  const up = pr(t, T.aura[0], T.aura[1]) * (1 - pr(t, T.burst[0], T.burst[0] + 0.16));
  if (up > 0.004) {
    const puls = 0.86 + 0.14 * Math.sin(t * 5.4);
    g.globalCompositeOperation = 'source-over';
    glow(g, CX, CY, 640 * puls, [
      [0, 'rgba(150,96,220,' + (0.42 * up).toFixed(3) + ')'],
      [0.45, 'rgba(120,74,190,' + (0.18 * up).toFixed(3) + ')'],
      [1, 'rgba(120,74,190,0)']]);
  }

  // afterglow once the product is out
  const ag = pr(t, T.burst[0], 20.55) * (1 - pr(t, 23.2, 24.0));
  if (ag > 0.004) {
    glow(g, CX, CY - 40, 700, [
      [0, 'rgba(255,196,224,' + (0.34 * ag).toFixed(3) + ')'],
      [0.42, 'rgba(206,168,255,' + (0.16 * ag).toFixed(3) + ')'],
      [1, 'rgba(206,168,255,0)']]);
    // slow rays
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * 6.283 + t * 0.16;
      const len = 520 + 150 * Math.sin(i * 2.1 + t * 0.9);
      g.globalAlpha = 0.055 * ag;
      g.strokeStyle = i % 2 ? '#FFD9EC' : '#D9C2FF';
      g.lineWidth = 26; g.beginPath();
      g.moveTo(CX + Math.cos(a) * 120, CY + Math.sin(a) * 120);
      g.lineTo(CX + Math.cos(a) * len, CY + Math.sin(a) * len);
      g.stroke();
    }
    g.restore();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

/* ================= in front of the bottle ================= */
export function drawFront(g, t) {
  g.clearRect(0, 0, 1080, 1920);
  if (t < T.bats[0] || t > 24.0) return;

  /* ---- smoke: hard-edged lobes on an offscreen layer, so the cloud
     keeps a real puffy silhouette instead of dissolving into an
     airbrushed haze ---- */
  const rise = pr(t, T.smoke[0], T.smoke[1]);
  const lift = pr(t, T.clear[0], T.clear[1]);
  if (rise > 0 && lift < 1) {
    const cl2 = cloud(t, rise, lift);
    const A = Math.pow(1 - lift, 2.0);
    g.save(); g.globalAlpha = A;
    if (lift > 0) g.filter = 'blur(' + (lift * 88).toFixed(1) + 'px)';
    g.drawImage(cl2, 0, 0); g.filter = 'none'; g.restore();

    // eyes watching from inside the cloud, gone the instant it flashes
    const eyeOn = pr(t, T.smoke[0] + 0.20, T.swap - 0.03)
                  * (1 - pr(t, T.swap - 0.03, T.swap));
    if (eyeOn > 0.01) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const r0 = rnd(i + 1300), r1 = rnd(i + 1400);
        const ex = CX + (r0 - 0.5) * 560, ey = CY + (r1 - 0.5) * 860;
        const bl = 0.5 + 0.5 * Math.sin(t * (5 + r0 * 7) + i * 2.1);
        const a = eyeOn * bl * (0.65 + r1 * 0.35);
        const sz = 20 + r0 * 15;
        for (const sx of [-1, 1]) {
          const px = ex + sx * sz * 1.55;
          glow(g, px, ey, sz * 3.4, [
            [0, 'rgba(255,172,64,' + (a * 0.80).toFixed(3) + ')'],
            [1, 'rgba(255,132,32,0)']]);
          g.globalAlpha = a; g.fillStyle = '#FFE0A0';
          g.beginPath();
          g.moveTo(px - sz * 0.52, ey + sz * 0.44);
          g.lineTo(px + sz * 0.52, ey + sz * 0.44);
          g.lineTo(px, ey - sz * 0.50);
          g.closePath(); g.fill();
        }
      }
      g.restore(); g.globalAlpha = 1;
    }
  }

  /* ---- bats: spiral in, then scatter on the burst ---- */
  const inn = pr(t, T.bats[0], T.bats[1]);
  const out = pr(t, T.burst[0] + 0.02, T.clear[1] - 0.10);
  for (let i = 0; i < 10; i++) {
    const r0 = rnd(i + 7), r1 = rnd(i + 41), r2 = rnd(i + 77);
    const th0 = i / 10 * 6.283 + r0 * 0.7;
    let rad, th, al, sc;
    if (out <= 0) {
      const k = eIO(cl(pr(t, T.bats[0] + r1 * 0.18, T.bats[1]), 0, 1));
      rad = lp(1180, 210 + r2 * 90, k);
      th = th0 + k * 2.6;
      al = pr(t, T.bats[0] + r1 * 0.18, T.bats[0] + r1 * 0.18 + 0.12) * (0.85 + r0 * 0.15);
      sc = lp(46, 88, k);
    } else {
      const k = eO(cl(pr(t, T.burst[0] + 0.02 + r1 * 0.10, T.clear[1] - 0.10), 0, 1));
      rad = lp(210 + r2 * 90, 1500, k);
      th = th0 + 2.6 + k * 1.5;
      al = (1 - k) * (0.85 + r0 * 0.15);
      sc = lp(88, 42, k);
    }
    const bx = CX + Math.cos(th) * rad * 0.62, by = CY + Math.sin(th) * rad;
    const flap = 0.42 + 0.58 * Math.abs(Math.sin(t * 17 + i * 1.9));
    bat(g, bx, by, sc, Math.sin(t * 3 + i) * 0.22, flap, al * 0.92, '#4A3168');
  }
  g.globalAlpha = 1;

  /* ---- the burst ---- */
  const bu = pr(t, T.burst[0], T.burst[1]);
  if (bu > 0 && bu < 1) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const fl = Math.pow(1 - pr(t, T.burst[0], T.burst[0] + 0.26), 1.35);
    if (fl > 0.004) {
      glow(g, CX, CY, 1700, [
        [0, 'rgba(255,253,244,' + fl.toFixed(3) + ')'],
        [0.30, 'rgba(255,244,214,' + (0.92 * fl).toFixed(3) + ')'],
        [0.62, 'rgba(255,214,150,' + (0.45 * fl).toFixed(3) + ')'],
        [1, 'rgba(255,196,130,0)']]);
    }
    for (let r = 0; r < 3; r++) {
      const k = pr(t, T.burst[0] + r * 0.075, T.burst[0] + 0.46 + r * 0.075);
      if (k <= 0 || k >= 1) continue;
      const rr = lp(90, 780, eO(k)), a = Math.pow(1 - k, 2.1) * 0.85;
      g.globalAlpha = a; g.lineWidth = lp(26, 3, k);
      g.strokeStyle = r === 1 ? '#FFD9A0' : '#FFFFFF';
      g.beginPath(); g.ellipse(CX, CY, rr, rr * 1.06, 0, 0, 7); g.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const r0 = rnd(i + 300), r1 = rnd(i + 400);
      const k = pr(t, T.burst[0] + r0 * 0.08, T.burst[0] + 0.55 + r0 * 0.20);
      if (k <= 0 || k >= 1) continue;
      const a = i / 22 * 6.283 + r1 * 0.5;
      const d = lp(60, 620 + r1 * 320, eO(k));
      spark(g, CX + Math.cos(a) * d * 0.72, CY + Math.sin(a) * d,
            lp(46, 6, k), Math.pow(1 - k, 1.5),
            i % 3 === 0 ? '#FFE9B0' : '#FFFFFF', a);
    }
    g.restore(); g.globalAlpha = 1;
  }

  /* ---- sparkle rain + candy-corn confetti over the product ---- */
  const sp = pr(t, T.burst[0] + 0.10, T.burst[0] + 0.35) * (1 - pr(t, 22.4, 23.4));
  if (sp > 0.004) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const r0 = rnd(i + 500), r1 = rnd(i + 620), r2 = rnd(i + 740);
      const per = 1.5 + r0 * 1.7, ph = (t * (1 / per) + r1) % 1;
      const x = 120 + r1 * 840 + Math.sin(t * 1.1 + i) * 26;
      const y = lp(1560, 420, ph);
      const a = Math.sin(ph * Math.PI) * (0.5 + r2 * 0.5) * sp;
      spark(g, x, y, 10 + r2 * 20, a, r0 > 0.6 ? '#FFE7A8' : '#FFFFFF', t * 0.8 + i);
    }
    g.restore(); g.globalAlpha = 1;
  }
  const cf = pr(t, T.fall[0], T.fall[0] + 0.5) * (1 - pr(t, 23.3, 24.0));
  if (cf > 0.004) {
    for (let i = 0; i < 20; i++) {
      const r0 = rnd(i + 900), r1 = rnd(i + 950), r2 = rnd(i + 990);
      const sp2 = 210 + r0 * 190;
      const y = ((t - T.fall[0]) * sp2 + r1 * 2100) % 2280 - 200;
      const x = 60 + r1 * 960 + Math.sin(t * (0.7 + r2) + i) * 44;
      candyCorn(g, x, y, 30 + r2 * 26, Math.sin(t * (1.1 + r0) + i) * 0.9,
                cf * (0.62 + r2 * 0.38));
    }
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-over';
}
