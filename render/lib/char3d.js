/* ------------------------------------------------------------------
   ChenMe halloween character, built as real 3D geometry with a skeleton.

   Proportions traced off the supplied render (722x778 source, feet at
   y=776, centreline x=248): hood 55..435, face 180..415, shoulders 445,
   vest hem 575, shorts 555..660, legs 645..690, shoes 680..765.

   Rule 0 holds by construction: the eyes are painted as closed arcs and
   there is no open-eye variant anywhere in this file.
   ------------------------------------------------------------------ */
import * as THREE from 'three';

export const H = 3.20;                 // world height, sole to hood crown
const S = H / 776;                     // world units per source pixel
const wy = (py) => (776 - py) * S;      // source row -> world height
const wx = (px) => (px - 248) * S;      // source column -> world x

export const COL = {
  skin:   0xF7E2CE,
  hood:   0xF0A233,
  hoodHi: 0xF9C862,
  lining: 0x4B3324,
  hair:   0x4A3122,
  ink:    0x1B1412,
  vest:   0xF5821F,
  trim:   0x211C20,
  white:  0xFFFFFF,
  shorts: 0x4B4750,
  web:    0xE9E4EF,
  blush:  0xF0A0A8,
  tongue: 0xF4697C,
  clip:   0x3B2E54
};

/* ---------------- canvas helpers ---------------- */
function cv(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/* ---------------- face plates ---------------- */
// Drawn on a transparent 512x512 card that gets wrapped on the front of
// the head. Eyes are always closed arcs.
const FACE_W = 512, FACE_H = 320;

function browArc(g, cx, cyy, w, h, lw, tiltA) {
  g.save(); g.translate(cx, cyy); g.rotate(tiltA || 0);
  g.lineWidth = lw; g.lineCap = 'round'; g.strokeStyle = hex(COL.ink);
  g.beginPath(); g.ellipse(0, 0, w, h, 0, Math.PI * 1.06, Math.PI * 1.94);
  g.stroke(); g.restore();
}
function eyeClosed(g, cx, cyy, w, h, lw, style) {
  g.save(); g.translate(cx, cyy);
  g.lineWidth = lw; g.lineCap = 'round'; g.strokeStyle = hex(COL.ink);
  g.beginPath();
  if (style === 'up')        g.ellipse(0, 0, w, h, 0, Math.PI * 1.05, Math.PI * 1.95);
  else if (style === 'down') g.ellipse(0, 0, w, h, 0, Math.PI * 0.06, Math.PI * 0.94);
  else                       g.ellipse(0, 0, w, h, 0, Math.PI * 1.08, Math.PI * 1.92);
  g.stroke(); g.restore();
}
function blush(g, cx, cyy, rx, ry, a) {
  const gr = g.createRadialGradient(cx, cyy, 0, cx, cyy, Math.max(rx, ry));
  gr.addColorStop(0, 'rgba(240,150,162,' + a + ')');
  gr.addColorStop(0.62, 'rgba(240,158,168,' + (a * 0.72) + ')');
  gr.addColorStop(1, 'rgba(240,168,176,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cyy, rx, ry, 0, 0, 7); g.fill();
}
function mouthSmile(g, cx, cyy, w, h, lw) {
  g.lineWidth = lw; g.lineCap = 'round'; g.strokeStyle = hex(COL.ink);
  g.beginPath(); g.ellipse(cx, cyy, w, h, 0, Math.PI * 0.10, Math.PI * 0.90);
  g.stroke();
}
function mouthOpen(g, cx, cyy, w, h, tongue) {
  // a wide grin: flat across the top, round at the bottom
  const path = () => {
    g.beginPath();
    g.moveTo(cx - w, cyy - h * 0.72);
    g.quadraticCurveTo(cx, cyy - h * 0.96, cx + w, cyy - h * 0.72);
    g.bezierCurveTo(cx + w * 1.02, cyy + h * 0.42, cx + w * 0.56, cyy + h, cx, cyy + h);
    g.bezierCurveTo(cx - w * 0.56, cyy + h, cx - w * 1.02, cyy + h * 0.42,
                    cx - w, cyy - h * 0.72);
    g.closePath();
  };
  g.fillStyle = hex(COL.ink); path(); g.fill();
  if (tongue) {
    g.save(); path(); g.clip();
    g.fillStyle = hex(COL.tongue);
    g.beginPath(); g.ellipse(cx, cyy + h * 0.74, w * 0.52, h * 0.52, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,190,200,0.55)';
    g.beginPath(); g.ellipse(cx - w * 0.12, cyy + h * 0.58, w * 0.20, h * 0.16, 0, 0, 7); g.fill();
    g.restore();
  }
  // the upper lip line, so the grin reads at small sizes
  g.strokeStyle = hex(COL.ink); g.lineWidth = Math.max(8, h * 0.20); g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - w * 1.02, cyy - h * 0.70);
  g.quadraticCurveTo(cx, cyy - h * 1.02, cx + w * 1.02, cyy - h * 0.70);
  g.stroke();
}
function mouthO(g, cx, cyy, r) {
  g.fillStyle = hex(COL.ink);
  g.beginPath(); g.ellipse(cx, cyy, r * 0.72, r, 0, 0, 7); g.fill();
  g.fillStyle = hex(COL.tongue);
  g.beginPath(); g.ellipse(cx, cyy + r * 0.18, r * 0.46, r * 0.55, 0, 0, 7); g.fill();
}

export const EXPRESSIONS = ['stand', 'jump', 'reach', 'sit', 'present',
                            'wave', 'hold2', 'shy'];

function faceTex(name) {
  // measured off the reference: face box x42..408, y180..408.
  // brows 89x31 at +/-121, eyes 89x33 at +/-127, mouth 68x20, blush 77x48.
  return cv(FACE_W, FACE_H, (g, W2, H2) => {
    g.clearRect(0, 0, W2, H2);
    const cx = W2 / 2, dx = 126;
    const browY = 97, eyeY = 180, mouthY = 244, blushY = 234;
    let browTilt = 0, eyeStyle = 'up', mouth = 'smile', bl = 0.90;
    let browDY = 0, mouthS = 1;

    switch (name) {
      case 'jump':    mouth = 'laugh'; browTilt = 0.07; bl = 1.00; mouthS = 1.15; break;
      case 'reach':   eyeStyle = 'down'; mouth = 'o'; browTilt = 0.16; browDY = -8; bl = 0.85; break;
      case 'sit':     mouth = 'smile'; bl = 1.10; browDY = 6; break;
      case 'present': mouth = 'laugh'; browTilt = -0.06; bl = 0.98; mouthS = 1.10; break;
      case 'wave':    mouth = 'laugh'; bl = 0.96; break;
      case 'hold2':   mouth = 'o'; browTilt = 0.05; bl = 0.94; break;
      case 'shy':     mouth = 'wavy'; browTilt = 0.12; browDY = 5; bl = 1.25; break;
      default:        mouth = 'smile'; bl = 0.90;
    }

    blush(g, cx - 143, blushY, 56, 35, bl * 0.90);
    blush(g, cx + 143, blushY, 56, 35, bl * 0.90);

    browArc(g, cx - dx, browY + browDY, 66, 26, 27, browTilt);
    browArc(g, cx + dx, browY + browDY, 66, 26, 27, -browTilt);
    eyeClosed(g, cx - dx, eyeY, 66, 27, 25, eyeStyle);
    eyeClosed(g, cx + dx, eyeY, 66, 27, 25, eyeStyle);

    if (mouth === 'smile') mouthSmile(g, cx, mouthY - 4, 50, 28, 19);
    else if (mouth === 'laugh') mouthOpen(g, cx, mouthY + 8, 62 * mouthS, 52 * mouthS, true);
    else if (mouth === 'o') mouthO(g, cx, mouthY + 4, 31);
    else if (mouth === 'wavy') {
      g.lineWidth = 14; g.lineCap = 'round'; g.strokeStyle = hex(COL.ink);
      g.beginPath();
      g.moveTo(cx - 42, mouthY - 2); g.quadraticCurveTo(cx - 21, mouthY - 18, cx, mouthY - 2);
      g.quadraticCurveTo(cx + 21, mouthY + 14, cx + 42, mouthY - 4);
      g.stroke();
    }
  });
}

/* ---------------- hood decal: bats across the brow ---------------- */
function batShape(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath();
  g.moveTo(0, -0.10);
  g.bezierCurveTo(-0.42, -0.62, -0.92, -0.40, -1.10, -0.02);
  g.bezierCurveTo(-0.84, -0.14, -0.70, 0.04, -0.58, 0.26);
  g.bezierCurveTo(-0.50, 0.04, -0.34, 0.02, -0.24, 0.22);
  g.bezierCurveTo(-0.17, 0.04, -0.09, 0.00, 0, 0.14);
  g.bezierCurveTo(0.09, 0.00, 0.17, 0.04, 0.24, 0.22);
  g.bezierCurveTo(0.34, 0.02, 0.50, 0.04, 0.58, 0.26);
  g.bezierCurveTo(0.70, 0.04, 0.84, -0.14, 1.10, -0.02);
  g.bezierCurveTo(0.92, -0.40, 0.42, -0.62, 0, -0.10);
  g.closePath(); g.fill();
  g.beginPath(); g.ellipse(0, -0.02, 0.15, 0.26, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(-0.12, -0.22); g.lineTo(-0.05, -0.44); g.lineTo(0.02, -0.23);
  g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0.12, -0.22); g.lineTo(0.05, -0.44); g.lineTo(-0.02, -0.23);
  g.closePath(); g.fill();
  g.restore();
}
function hoodDecalTex() {
  // patch is 1.45 x 0.42 world, so the card matches that aspect
  return cv(512, 148, (g, W2, H2) => {
    g.clearRect(0, 0, W2, H2);
    g.fillStyle = hex(COL.ink);
    batShape(g, 256, 78, 66);
    batShape(g, 132, 68, 54);
    batShape(g, 380, 68, 54);
  });
}
function earTex() {
  // cone side UV: u around, v bottom..top. The cone is turned so u=0.5 faces
  // forward, and the stitches run up the front edge like the reference.
  return cv(256, 256, (g, W2, H2) => {
    g.fillStyle = hex(COL.hood); g.fillRect(0, 0, W2, H2);
    g.strokeStyle = hex(0x4A3418); g.lineWidth = 11; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const v = 0.20 + i * 0.155;
      const y = H2 * (1 - v);
      const half = 26 * (1 - v * 0.5);
      g.beginPath(); g.moveTo(128 - half, y - half); g.lineTo(128 + half, y + half); g.stroke();
      g.beginPath(); g.moveTo(128 + half, y - half); g.lineTo(128 - half, y + half); g.stroke();
    }
  });
}

/* ---------------- body textures ---------------- */
function jackFace(g, cx, cyy, s) {
  g.fillStyle = hex(COL.ink);
  const tri = (x, y, w, h, flip) => {
    g.beginPath();
    if (flip) { g.moveTo(x - w, y - h); g.lineTo(x + w, y - h); g.lineTo(x, y + h); }
    else { g.moveTo(x - w, y + h); g.lineTo(x + w, y + h); g.lineTo(x, y - h); }
    g.closePath(); g.fill();
  };
  tri(cx - 0.30 * s, cyy - 0.22 * s, 0.15 * s, 0.15 * s, false);
  tri(cx + 0.30 * s, cyy - 0.22 * s, 0.15 * s, 0.15 * s, false);
  tri(cx, cyy - 0.02 * s, 0.11 * s, 0.13 * s, true);
  g.beginPath();
  g.moveTo(cx - 0.42 * s, cyy + 0.20 * s);
  g.lineTo(cx - 0.26 * s, cyy + 0.20 * s); g.lineTo(cx - 0.20 * s, cyy + 0.33 * s);
  g.lineTo(cx - 0.08 * s, cyy + 0.20 * s); g.lineTo(cx + 0.08 * s, cyy + 0.20 * s);
  g.lineTo(cx + 0.20 * s, cyy + 0.33 * s); g.lineTo(cx + 0.26 * s, cyy + 0.20 * s);
  g.lineTo(cx + 0.42 * s, cyy + 0.20 * s);
  g.lineTo(cx + 0.34 * s, cyy + 0.40 * s); g.lineTo(cx - 0.34 * s, cyy + 0.40 * s);
  g.closePath(); g.fill();
}
// cylindrical wrap: u = 0.25 is the front of the torso
function torsoTex() {
  return cv(1024, 512, (g, W2, H2) => {
    g.fillStyle = hex(COL.vest); g.fillRect(0, 0, W2, H2);
    // black collar band across the top, and the hem at the bottom
    g.fillStyle = hex(COL.trim);
    g.fillRect(0, 0, W2, 74);              // black collar
    g.fillRect(0, H2 - 78, W2, 78);        // black hem below the vest
    // the vest is a tabard: black wedges either side of the orange front
    const tab = (cx0) => {
      g.beginPath(); g.moveTo(cx0 - 126, 86); g.lineTo(cx0 + 126, 86);
      g.lineTo(cx0, 220); g.closePath(); g.fill();
    };
    tab(256); tab(768);
    jackFace(g, 256, 304, 172);
  });
}
function sleeveTex() {
  return cv(64, 512, (g, W2, H2) => {
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i % 2 ? hex(COL.white) : hex(COL.trim);
      g.fillRect(0, i * (H2 / 9), W2, H2 / 9 + 1);
    }
  });
}
function web(g, cx, cyy, r) {
  g.strokeStyle = hex(COL.web); g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.02 + 0.96 * i / 6);
    g.beginPath(); g.moveTo(cx, cyy); g.lineTo(cx + Math.cos(a) * r, cyy + Math.sin(a) * r);
    g.stroke();
  }
  for (let k = 1; k <= 4; k++) {
    const rr = r * k / 4;
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI * (0.02 + 0.96 * i / 6);
      const x = cx + Math.cos(a) * rr, y = cyy + Math.sin(a) * rr;
      if (i === 0) g.moveTo(x, y);
      else {
        const pa = Math.PI * (0.02 + 0.96 * (i - 1) / 6);
        const mx = cx + Math.cos((a + pa) / 2) * rr * 0.86;
        const my = cyy + Math.sin((a + pa) / 2) * rr * 0.86;
        g.quadraticCurveTo(mx, my, x, y);
      }
    }
    g.stroke();
  }
}
function shortsTex() {
  return cv(1024, 512, (g, W2, H2) => {
    g.fillStyle = hex(COL.shorts); g.fillRect(0, 0, W2, H2);
    g.fillStyle = hex(COL.trim); g.fillRect(0, 0, W2, 54);
    web(g, 128, 190, 132); web(g, 896, 190, 132);
    web(g, 424, 210, 104); web(g, 648, 210, 104);
  });
}
function shoeTex() {
  return cv(512, 256, (g, W2, H2) => {
    g.fillStyle = hex(COL.white); g.fillRect(0, 0, W2, H2);
    g.fillStyle = hex(COL.trim); g.fillRect(0, H2 - 62, W2, 62);
    // a little ghost face on the toe (u = 0.25 is forward)
    g.fillStyle = hex(COL.trim);
    g.beginPath(); g.ellipse(128, 118, 15, 20, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(178, 118, 15, 20, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(153, 158, 17, 12, 0, 0, 7); g.fill();
  });
}
function candyTex() {
  return cv(64, 256, (g, W2, H2) => {
    g.fillStyle = '#FFD84A'; g.fillRect(0, 0, W2, H2 * 0.40);
    g.fillStyle = '#FF9A2E'; g.fillRect(0, H2 * 0.40, W2, H2 * 0.30);
    g.fillStyle = '#FFFFFF'; g.fillRect(0, H2 * 0.70, W2, H2 * 0.30);
  });
}

/* ---------------- geometry helpers ---------------- */
function toon(color, opt) {
  return new THREE.MeshPhongMaterial(Object.assign({
    color: color, shininess: 22, specular: 0x2a2028, flatShading: false
  }, opt || {}));
}
function ellip(rx, ry, rz, seg) {
  const g = new THREE.SphereGeometry(1, seg || 44, (seg || 44) / 2);
  g.scale(rx, ry, rz); return g;
}

/* hood: a cap. An ellipsoid shell whose front is cut away by a U-shaped
   opening - a half ellipse over the brow, running straight down past the
   cheeks - so the chin comes out below the hood exactly like the reference.
   Vertices inside the cut slide sideways onto the rim, so the edge stays
   smooth instead of stepping along the quad grid. */
function openHalfWidth(open, y) {
  const dy = y - open.cy;
  if (dy >= open.ry) return -1;                 // above the opening
  if (dy <= 0) return open.rx;                  // the slot runs straight down
  return open.rx * Math.sqrt(Math.max(0, 1 - (dy / open.ry) * (dy / open.ry)));
}
function hoodGeometry(R, open) {
  const NU = 128, NV = 74;
  const pos = [], nrm = [], uv = [], idx = [];
  const P = new THREE.Vector3();
  for (let j = 0; j <= NV; j++) {
    const th = Math.PI * j / NV;
    for (let i = 0; i <= NU; i++) {
      const ph = Math.PI * 2 * i / NU;
      const x = Math.sin(th) * Math.sin(ph), y = Math.cos(th), z = Math.sin(th) * Math.cos(ph);
      P.set(x * R.x, y * R.y, z * R.z);
      if (P.z > 0) {
        const hw = openHalfWidth(open, P.y);
        if (hw > 0 && Math.abs(P.x) < hw) {
          const nx = (P.x < 0 ? -1 : 1) * hw;
          const q = 1 - (nx * nx) / (R.x * R.x) - (P.y * P.y) / (R.y * R.y);
          P.set(nx, P.y, R.z * Math.sqrt(Math.max(0, q)));
        }
      }
      pos.push(P.x, P.y, P.z);
      const n = new THREE.Vector3(P.x / (R.x * R.x), P.y / (R.y * R.y), P.z / (R.z * R.z)).normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push(i / NU, 1 - j / NV);
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* the dark fringe inside the brow of the hood */
function liningGeometry(R, open, thick) {
  const N = 96, A0 = -0.34, A1 = Math.PI + 0.34;
  const pos = [], nrm = [], idx = [];
  const on = (a, grow) => {
    const nx = Math.cos(a) * open.rx * grow;
    const ny = open.cy + Math.sin(a) * open.ry * grow;
    const q = 1 - (nx * nx) / (R.x * R.x) - (ny * ny) / (R.y * R.y);
    return new THREE.Vector3(nx, ny, R.z * Math.sqrt(Math.max(0, q)));
  };
  for (let i = 0; i <= N; i++) {
    const a = A0 + (A1 - A0) * i / N;
    // a hood fringe is deep over the brow and thin past the temples
    const th = thick * (0.28 + 0.90 * Math.max(0, Math.sin(a)));
    const o = on(a, 1.0), q = on(a, 1 - th);
    q.z *= 0.955;
    pos.push(o.x, o.y, o.z, q.x, q.y, q.z);
    const n = new THREE.Vector3(o.x, o.y, o.z).normalize();
    nrm.push(n.x, n.y, n.z, n.x, n.y, n.z);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/* a curved patch of an ellipsoid, lifted off it, for decals */
function patchGeometry(R, bC, halfA, halfB, lift, NU, NV) {
  NU = NU || 40; NV = NV || 40;
  const pos = [], nrm = [], uv = [], idx = [];
  for (let j = 0; j <= NV; j++) {
    const b = bC - halfB + 2 * halfB * j / NV;
    for (let i = 0; i <= NU; i++) {
      const a = -halfA + 2 * halfA * i / NU;
      const dir = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b));
      const p = new THREE.Vector3(dir.x * R.x, dir.y * R.y, dir.z * R.z);
      const n = new THREE.Vector3(p.x / (R.x * R.x), p.y / (R.y * R.y), p.z / (R.z * R.z)).normalize();
      pos.push(p.x + n.x * lift, p.y + n.y * lift, p.z + n.z * lift);
      nrm.push(n.x, n.y, n.z);
      uv.push(i / NU, j / NV);
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* the twin-tail: a tapered sweep along a curve */
function plumeGeometry(curve, r0, r1, NL, NR) {
  NL = NL || 40; NR = NR || 20;
  const pos = [], nrm = [], uv = [], idx = [];
  const frames = curve.computeFrenetFrames(NL, false);
  for (let j = 0; j <= NL; j++) {
    const t = j / NL;
    const c = curve.getPointAt(t);
    const N = frames.normals[Math.min(j, NL - 1)], B = frames.binormals[Math.min(j, NL - 1)];
    const rr = (r1 + (r0 - r1) * Math.pow(1 - t, 0.62)) * (0.55 + 0.45 * Math.min(1, t * 9));
    for (let i = 0; i <= NR; i++) {
      const a = Math.PI * 2 * i / NR;
      const ex = Math.cos(a) * rr, ey = Math.sin(a) * rr * 0.72;
      const p = new THREE.Vector3().copy(c)
        .addScaledVector(N, ex).addScaledVector(B, ey);
      const n = new THREE.Vector3().addScaledVector(N, Math.cos(a))
        .addScaledVector(B, Math.sin(a)).normalize();
      pos.push(p.x, p.y, p.z); nrm.push(n.x, n.y, n.z);
      uv.push(i / NR, t);
    }
  }
  for (let j = 0; j < NL; j++) for (let i = 0; i < NR; i++) {
    const a = j * (NR + 1) + i, b = a + 1, c = a + NR + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* ---------------- pom-poms ---------------- */
const POM_COLS = [
  [0xF98A2B, 0xFFA94D, 0x2FC6BC, 0x63DCD4],   // orange + teal
  [0xEE4E97, 0xFF7DBC, 0xA557E8, 0xC287F2]    // pink + purple
];
function pomDecalTex(kind) {
  return cv(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    if (kind === 0) {                    // star
      g.fillStyle = '#FFD84A'; g.strokeStyle = '#2A2018'; g.lineWidth = 7;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 24 : 52;
        const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath(); g.fill(); g.stroke();
    } else if (kind === 1) {             // wrapped candy
      g.strokeStyle = '#2A2018'; g.lineWidth = 7; g.lineJoin = 'round';
      g.fillStyle = '#FFB03A';
      g.beginPath(); g.ellipse(64, 64, 30, 22, 0, 0, 7); g.fill(); g.stroke();
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(64 + d * 28, 64);
        g.lineTo(64 + d * 54, 64 - 24); g.lineTo(64 + d * 54, 64 + 24);
        g.closePath(); g.fill(); g.stroke();
      }
      g.strokeStyle = '#FFF3D0'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(52, 54); g.lineTo(60, 74); g.stroke();
    } else {                             // little jack-o-lantern
      g.fillStyle = '#F7801E'; g.strokeStyle = '#2A2018'; g.lineWidth = 6;
      g.beginPath(); g.ellipse(64, 68, 44, 38, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#5A3C1E'; g.fillRect(58, 22, 12, 14);
      g.fillStyle = '#2A2018';
      g.beginPath(); g.moveTo(40, 62); g.lineTo(58, 62); g.lineTo(49, 46); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(70, 62); g.lineTo(88, 62); g.lineTo(79, 46); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(42, 78); g.lineTo(86, 78); g.lineTo(78, 94); g.lineTo(50, 94);
      g.closePath(); g.fill();
    }
  });
}
// one curled ribbon petal, pointing along +y
function petalGeometry(len, wid, curl) {
  const NL = 12, pos = [], nrm = [], idx = [];
  for (let j = 0; j <= NL; j++) {
    const t = j / NL;
    const cy = t * len, cz = curl * Math.sin(t * Math.PI * 0.72) * len;
    const w = wid * (0.42 + 0.58 * Math.sin(Math.PI * (0.10 + 0.80 * (1 - Math.abs(t - 0.35) / 0.9))))
              * (1 - t * 0.30);
    for (let i = 0; i < 3; i++) {
      const u = (i - 1);
      const bow = (1 - u * u) * wid * 0.36;
      pos.push(u * w, cy, cz + bow);
      nrm.push(u * 0.5, 0.15, 0.85);
    }
  }
  for (let j = 0; j < NL; j++) for (let i = 0; i < 2; i++) {
    const a = j * 3 + i, b = a + 1, c = a + 3, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function makePom(idx) {
  const grp = new THREE.Group();
  const C = POM_COLS[idx % 2];
  const mats = C.map(c => new THREE.MeshPhongMaterial({
    color: c, shininess: 84, specular: 0x6a6a6a, side: THREE.DoubleSide
  }));
  const geo = [petalGeometry(0.300, 0.168, 0.28), petalGeometry(0.268, 0.150, -0.22),
               petalGeometry(0.240, 0.140, 0.34)];
  const N = 34, GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GA * i;
    const dir = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
    const m = new THREE.Mesh(geo[i % 3], mats[i % 4]);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.rotateY(i * 1.7);
    m.position.copy(dir).multiplyScalar(0.055);
    m.castShadow = true;
    grp.add(m);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 14),
    new THREE.MeshPhongMaterial({ color: C[0], shininess: 50 }));
  grp.add(core);
  // a few decals stuck on the outside
  const decals = [pomDecalTex(0), pomDecalTex(1), pomDecalTex(2)];
  const spots = [[0.55, 0.72], [1.95, 0.20], [3.35, -0.45], [4.60, 0.52], [2.70, -0.10]];
  for (let i = 0; i < spots.length; i++) {
    const th = spots[i][0], yy = spots[i][1];
    const rr = Math.sqrt(Math.max(0.02, 1 - yy * yy));
    const dir = new THREE.Vector3(Math.cos(th) * rr, yy, Math.sin(th) * rr);
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.155, 0.155),
      new THREE.MeshPhongMaterial({ map: decals[i % 3], transparent: true,
        shininess: 40, depthWrite: false, side: THREE.DoubleSide }));
    d.position.copy(dir).multiplyScalar(0.30);
    d.lookAt(dir.clone().multiplyScalar(2));
    d.renderOrder = 4;
    grp.add(d);
  }
  grp.userData.jiggle = grp;
  return grp;
}

/* ------------------------------------------------------------------ */
export function makeCharacter() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  const faces = {};
  for (const e of EXPRESSIONS) faces[e] = faceTex(e);

  const M = {
    skin:  toon(COL.skin, { shininess: 16 }),
    hood:  toon(COL.hood, { shininess: 30, specular: 0x4a3a1c }),
    lining: toon(COL.lining, { shininess: 12 }),
    hair:  toon(COL.hair, { shininess: 34, specular: 0x3a2a1c }),
    trim:  toon(COL.trim, { shininess: 26 }),
    white: toon(COL.white, { shininess: 30 }),
    clip:  toon(COL.clip, { shininess: 26 })
  };
  const texMat = (t, extra) => new THREE.MeshPhongMaterial(Object.assign(
    { map: t, shininess: 24, specular: 0x2a2028 }, extra || {}));

  /* ---- world landmarks, straight off the reference ----
     hood 55..435 -> 2.975..1.406   face 180..415 -> 2.458..1.489
     shoulders 445 -> 1.365   vest 445..575 -> 1.365..0.829
     shorts 555..660 -> 0.911..0.478   legs 645..690   shoes 680..765     */
  const Y = {
    hips: 0.802, chest: 1.120, neck: 1.380,
    hood: 2.300, skin: 2.070, torso: 1.120, shorts: 0.742,
    shoulder: 1.290, hip: 0.566
  };
  const mk = (parent, worldY, parentWorldY, x, z) => {
    const g = new THREE.Group();
    g.position.set(x || 0, worldY - parentWorldY, z || 0);
    parent.add(g); return g;
  };

  const hips  = mk(body, Y.hips, 0);
  const chest = mk(hips, Y.chest, Y.hips);
  const neck  = mk(chest, Y.neck, Y.chest);
  const head  = new THREE.Group(); neck.add(head);

  /* ---- head ---- */
  const HR = { x: 0.860, y: 0.620, z: 0.700 };          // skin
  const OR = { x: 0.920, y: 0.700, z: 0.762 };          // hood
  const skinY = Y.skin - Y.neck, hoodY = Y.hood - Y.neck;
  // face opening, relative to the hood centre (face 42..408 x, 180..408 y)
  const OPEN = { rx: 0.762, ry: 0.500, cy: (1.995 - Y.hood) };

  const skin = new THREE.Mesh(ellip(HR.x, HR.y, HR.z, 52), M.skin);
  skin.position.y = skinY; skin.castShadow = true; skin.receiveShadow = true;
  head.add(skin);

  const faceMat = new THREE.MeshPhongMaterial({
    map: faces.stand, transparent: true, shininess: 14, depthWrite: false,
    side: THREE.DoubleSide
  });
  const face = new THREE.Mesh(patchGeometry(HR, -0.121, 1.108, 0.945, 0.006, 60, 60), faceMat);
  face.position.y = skinY; face.renderOrder = 2; head.add(face);

  const hoodMesh = new THREE.Mesh(hoodGeometry(OR, OPEN), M.hood);
  hoodMesh.position.y = hoodY;
  hoodMesh.castShadow = true; hoodMesh.receiveShadow = true;
  head.add(hoodMesh);

  const lining = new THREE.Mesh(liningGeometry(OR, OPEN, 0.295), M.lining);
  lining.position.y = hoodY; lining.material.side = THREE.DoubleSide;
  head.add(lining);

  // bats printed across the brow, just above the opening
  const decal = new THREE.Mesh(
    patchGeometry(OR, 0.520, 0.98, 0.30, 0.012, 58, 26),
    new THREE.MeshPhongMaterial({ map: hoodDecalTex(), transparent: true,
      shininess: 20, depthWrite: false, side: THREE.DoubleSide }));
  decal.position.y = hoodY; decal.renderOrder = 3; head.add(decal);

  // ears: reference span y 20..150, x centres +/- 0.63
  const ears = [];
  for (const sgn of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(sgn * 0.720, hoodY + 0.480, -0.05);
    e.rotation.z = sgn * 0.44; e.rotation.x = -0.06;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.305, 0.66, 34, 1), M.hood);
    cone.scale.set(1, 1, 0.58); cone.position.y = 0.31;
    cone.castShadow = true; e.add(cone);
    const stitchMat = toon(0x4A3418, { shininess: 12 });
    for (let k = 0; k < 4; k++) {
      const v = 0.16 + k * 0.19, yy = v * 0.60;
      const sz = 0.105 * (1 - v * 0.55);
      for (const d of [1, -1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(sz * 2, 0.028, 0.026), stitchMat);
        bar.position.set(0, yy, 0.335 * 0.62 * (1 - v) * 0.88 + 0.012);
        bar.rotation.z = d * 0.85; e.add(bar);
      }
    }
    const base = new THREE.Mesh(ellip(0.305, 0.22, 0.195, 24), M.hood);
    base.position.y = -0.02; e.add(base);
    head.add(e); ears.push(e);
  }

  /* ---- twin-tail ---- */
  const tail = new THREE.Group();
  tail.position.set(0.72, hoodY + 0.40, -0.16);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.34, 0.10, -0.07),
    new THREE.Vector3(0.66, 0.02, -0.16),
    new THREE.Vector3(0.90, -0.22, -0.24),
    new THREE.Vector3(0.98, -0.56, -0.26)
  ]);
  const plume = new THREE.Mesh(plumeGeometry(curve, 0.46, 0.030), M.hair);
  plume.castShadow = true; tail.add(plume);
  const knot = new THREE.Mesh(ellip(0.26, 0.25, 0.24, 24), M.hair);
  tail.add(knot);
  head.add(tail);

  // candy corn and the bat clip where the tail meets the hood
  const corn = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.27, 16),
    texMat(candyTex(), { shininess: 34 }));
  corn.position.set(0.565, hoodY + 0.26, 0.30); corn.rotation.z = -0.26;
  corn.castShadow = true; head.add(corn);
  const cw1 = new THREE.Mesh(ellip(0.22, 0.10, 0.055, 18), M.clip);
  cw1.position.set(0.66, hoodY + 0.06, 0.26); cw1.rotation.z = -0.55; head.add(cw1);
  const cw2 = new THREE.Mesh(ellip(0.15, 0.075, 0.05, 18), M.clip);
  cw2.position.set(0.80, hoodY - 0.10, 0.18); cw2.rotation.z = -0.95; head.add(cw2);

  /* ---- torso: slim tapered vest, not a ball ---- */
  const torso = new THREE.Mesh(ellip(0.408, 0.352, 0.318, 44), texMat(torsoTex()));
  torso.position.y = Y.torso - Y.chest + 0.020;
  torso.castShadow = true; torso.receiveShadow = true; chest.add(torso);
  const collar = new THREE.Mesh(ellip(0.318, 0.086, 0.252, 30), M.trim);
  collar.position.y = Y.torso - Y.chest + 0.330; chest.add(collar);
  // shoulder caps, so the arms grow out of the vest instead of floating
  for (const sgn of [-1, 1]) {
    const cap = new THREE.Mesh(ellip(0.132, 0.118, 0.126, 22), texMat(torsoTex()));
    cap.position.set(sgn * 0.372, Y.shoulder - Y.chest + 0.020, 0.02);
    chest.add(cap);
  }

  /* ---- shorts ---- */
  const shortsT = shortsTex();
  const shorts = new THREE.Mesh(ellip(0.372, 0.230, 0.300, 44), texMat(shortsT));
  shorts.position.y = Y.shorts - Y.hips + 0.040;
  shorts.castShadow = true; shorts.receiveShadow = true; hips.add(shorts);
  for (const sgn of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.152, 0.164, 0.24, 26, 1, false), texMat(shortsT));
    leg.position.set(sgn * 0.168, Y.shorts - Y.hips - 0.140, 0.01);
    leg.rotation.z = sgn * 0.11; leg.castShadow = true; hips.add(leg);
    const cf = new THREE.Mesh(new THREE.TorusGeometry(0.164, 0.021, 8, 30), M.trim);
    cf.rotation.x = Math.PI / 2;
    cf.position.set(sgn * 0.168 + sgn * 0.014, Y.shorts - Y.hips - 0.256, 0.01);
    hips.add(cf);
  }

  /* ---- arms: bare, slim, with striped warmers on the forearm ---- */
  const sleeveT = sleeveTex();
  const arms = [];
  for (const sgn of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(sgn * 0.392, Y.shoulder - Y.chest - 0.010, 0.02);
    chest.add(sh);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.098, 0.20, 8, 20), M.skin);
    upper.position.y = -0.150; upper.castShadow = true; sh.add(upper);

    const el = new THREE.Group(); el.position.y = -0.290; sh.add(el);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.092, 0.10, 8, 20), M.skin);
    fore.position.y = -0.090; fore.castShadow = true; el.add(fore);
    const warm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.098, 0.104, 0.165, 22, 1, false), texMat(sleeveT));
    warm.position.y = -0.150; warm.castShadow = true; el.add(warm);

    const hand = new THREE.Group(); hand.position.y = -0.268; el.add(hand);
    const palm = new THREE.Mesh(ellip(0.112, 0.118, 0.100, 22), M.skin);
    palm.castShadow = true; hand.add(palm);
    const thumb = new THREE.Mesh(ellip(0.040, 0.058, 0.042, 12), M.skin);
    thumb.position.set(-sgn * 0.096, -0.030, 0.030); hand.add(thumb);
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Mesh(ellip(0.036, 0.058, 0.038, 12), M.skin);
      f.position.set((k - 1) * 0.058, -0.108, 0.012); hand.add(f);
    }
    arms.push({ sh: sh, el: el, hand: hand });
  }

  /* ---- legs: slim, and long enough to read as legs ---- */
  const shoeT = shoeTex();
  const legs = [];
  for (const sgn of [-1, 1]) {
    const hp = new THREE.Group();
    hp.position.set(sgn * 0.168, Y.hip - Y.hips, 0);
    hips.add(hp);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.092, 0.10, 8, 20), M.skin);
    thigh.position.y = -0.080; thigh.castShadow = true; hp.add(thigh);
    const kn = new THREE.Group(); kn.position.y = -0.170; hp.add(kn);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.084, 0.09, 8, 20), M.skin);
    shin.position.y = -0.070; shin.castShadow = true; kn.add(shin);
    const ank = new THREE.Group(); ank.position.y = -0.150; kn.add(ank);
    const shoe = new THREE.Mesh(ellip(0.128, 0.108, 0.208, 28), texMat(shoeT));
    shoe.position.set(0, -0.052, 0.052); shoe.castShadow = true; ank.add(shoe);
    const toe = new THREE.Mesh(ellip(0.126, 0.092, 0.104, 24), M.trim);
    toe.position.set(0, -0.058, 0.150); ank.add(toe);
    const sole = new THREE.Mesh(ellip(0.130, 0.036, 0.212, 26), M.trim);
    sole.position.set(0, -0.122, 0.052); ank.add(sole);
    legs.push({ hp: hp, kn: kn, ank: ank });
  }

  /* ---- pom-poms, one per hand ---- */
  const poms = [];
  for (let i = 0; i < 2; i++) {
    const p = makePom(i === 0 ? 0 : 1);
    p.position.set(0, -0.235, 0.03);
    arms[i].hand.add(p);
    poms.push(p);
  }

  const rig = { root, body, hips, chest, neck, head, ears, tail, arms, legs, poms,
                faceMat, faces, hoodMesh, expr: 'stand' };
  root.userData = rig;
  root.userData.hands = [arms[1].hand, arms[0].hand];
  root.userData.poms = poms;
  return root;
}

export function setExpr(root, name) {
  const u = root.userData;
  if (u.expr === name) return;
  const t = u.faces[name] || u.faces.stand;
  u.expr = name; u.faceMat.map = t; u.faceMat.needsUpdate = true;
}

/* ------------------------------------------------------------------
   Pose. Angles in radians. Arms hang at 0; +armR swings the right arm
   out and up, -armL does the same on the left.
   ------------------------------------------------------------------ */
export function poseCharacter(root, P) {
  const u = root.userData;
  if (P.expr) setExpr(root, P.expr);
  const sq = P.squash || 0;

  u.body.position.set(P.bx || 0, P.by || 0, 0);
  u.body.scale.set(1 / (1 + sq * 0.55), 1 + sq, 1 / (1 + sq * 0.55));
  u.body.rotation.z = P.lean || 0;
  u.body.rotation.x = P.pitch || 0;

  u.hips.rotation.set(P.hipsX || 0, P.hipsY || 0, P.hipsZ || 0);
  u.chest.rotation.set(P.spineX || 0, P.spineY || 0, P.spine || 0);
  u.neck.rotation.set(P.headX || 0, P.headY || 0, P.head || 0);

  const t = u.tail;
  t.rotation.set(P.tailX || 0, P.tailY || 0, P.tail || 0);

  if (u.poms) {
    for (let i = 0; i < 2; i++) {
      u.poms[i].visible = P.poms !== false;
      const j = i === 0 ? (P.pomL || 0) : (P.pomR || 0);
      const k = i === 0 ? (P.pomLX || 0) : (P.pomRX || 0);
      u.poms[i].rotation.set(k, j * 1.6, j);
      const sc = 1 + Math.abs(j) * 0.10;
      u.poms[i].scale.set(sc, 1 / (1 + Math.abs(j) * 0.14), sc);
    }
  }
  for (let i = 0; i < 2; i++) {
    const sgn = i === 0 ? -1 : 1;             // 0 = left, 1 = right
    const a = u.arms[i];
    const raise = i === 0 ? -(P.armL || 0) : (P.armR || 0);
    const fwd = i === 0 ? (P.armLF || 0) : (P.armRF || 0);
    a.sh.rotation.set(fwd, 0, sgn * raise);
    a.el.rotation.set(i === 0 ? (P.elbowL || 0) : (P.elbowR || 0), 0, 0);
    a.hand.rotation.set(0, 0, 0);
    const l = u.legs[i];
    const lr = i === 0 ? (P.legL || 0) : (P.legR || 0);
    const lf = i === 0 ? (P.legLF || 0) : (P.legRF || 0);
    l.hp.rotation.set(lf, 0, lr);
    l.kn.rotation.set(i === 0 ? (P.kneeL || 0) : (P.kneeR || 0), 0, 0);
    l.ank.rotation.set(i === 0 ? (P.ankleL || 0) : (P.ankleR || 0), 0, 0);
  }
}
