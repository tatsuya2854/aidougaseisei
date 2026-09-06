/* ------------------------------------------------------------------
   ChenMe halloween promo — 3D character rig (halloween costume).
   The head is real geometry; the FACE is the original artwork, split
   into a raised relief (brows / eyes / mouth) and a flat blush, so the
   closed side-glancing eyes of the source design are the source pixels
   in every frame and can never be redrawn.
   Proportions measured off the source drawing (head = 597 px = 2.0 u).
   ------------------------------------------------------------------ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PAL = {
  skin:   0xFCD9BE, cream: 0xFCF3DF,
  orange: 0xF0921F, orangeDk: 0xD97812,
  ink:    0x24222C, inkDeep: 0x151419,
  white:  0xF9F6F1, teal: 0x57CAC2, pink: 0xFC5A8D,
  earIn:  0xF7C0B4, corn: [0xFFFFFF, 0xF79A2B, 0xFFD24A]
};

const RX = 1.00, RY = 0.855, RZ = 0.88;
const HEAD_Y = 2.52;
const cheek = yn => 1 + 0.075 * (0.35 - yn);

/* soft toy-plastic material: matte, with the shadows gently lifted */
function soft(color, shine, spec, emiK) {
  const c = new THREE.Color(color);
  return new THREE.MeshPhongMaterial({
    color: c, shininess: shine === undefined ? 20 : shine,
    specular: spec === undefined ? 0x26222a : spec,
    emissive: c.clone().multiplyScalar(emiK === undefined ? 0.085 : emiK)
  });
}
function ellip(rx, ry, rz, mat, seg) {
  const g = new THREE.SphereGeometry(1, seg || 40, ((seg || 40) * 0.6) | 0);
  g.scale(rx, ry, rz);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 18), mat);
  m.castShadow = true; return m;
}
function skullGeo() {
  const g = new THREE.SphereGeometry(1, 52, 36);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = cheek(p.getY(i));
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  g.scale(RX, RY, RZ); g.computeVertexNormals();
  return g;
}

/* ---------- face assets: relief + blush, split out of the decal ---------- */
export async function loadFaceAssets(url) {
  const img = await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
  });
  const w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const src = g.getImageData(0, 0, w, h).data;

  const rc = document.createElement('canvas'); rc.width = w; rc.height = h;
  const bc = document.createElement('canvas'); bc.width = w; bc.height = h;
  const rg = rc.getContext('2d'), bg = bc.getContext('2d');
  const rd = rg.createImageData(w, h), bd = bg.createImageData(w, h);
  const height = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4, a = src[o + 3];
    const lum = (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) / 255;
    if (a > 150) {                       // ink strokes + the mouth (tongue included)
      rd.data[o] = src[o]; rd.data[o + 1] = src[o + 1]; rd.data[o + 2] = src[o + 2];
      rd.data[o + 3] = 255;
      height[i] = 0.55 + 0.45 * (1 - lum);
    } else {                             // soft blush stays flat
      bd.data[o] = src[o]; bd.data[o + 1] = src[o + 1]; bd.data[o + 2] = src[o + 2];
      bd.data[o + 3] = a;
    }
  }
  rg.putImageData(rd, 0, 0); bg.putImageData(bd, 0, 0);
  const mk = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { relief: mk(rc), blush: mk(bc), height, w, h };
}

/* planar projection of the decal onto the skull, pushed out by its own ink */
function facePlate(fa, opt) {
  const o = Object.assign({ x0: -0.795, x1: 0.795, y0: -0.705, y1: 0.705,
    eps: 0.014, seg: 176, relief: 0.042, useHeight: true }, opt || {});
  const seg = o.seg, pos = [], uv = [], nrm = [], idx = [];
  const sampleH = (fu, fv) => {
    if (!o.useHeight) return 0;
    const x = Math.min(fa.w - 1, Math.max(0, Math.round(fu * (fa.w - 1))));
    const y = Math.min(fa.h - 1, Math.max(0, Math.round(fv * (fa.h - 1))));
    return fa.height[y * fa.w + x];
  };
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const fu = i / seg, fv = j / seg;
      const u = o.x0 + (o.x1 - o.x0) * fu;
      const w = o.y1 + (o.y0 - o.y1) * fv;
      const z = Math.sqrt(Math.max(0.05, 1 - u * u - w * w));
      const k = cheek(w);
      let px = u * k * RX, py = w * RY, pz = z * k * RZ;
      const nx = u / RX, ny = w / RY, nz = z / RZ;
      const nl = Math.hypot(nx, ny, nz) || 1;
      const push = o.eps + o.relief * sampleH(fu, fv);
      pos.push(px + nx / nl * push, py + ny / nl * push, pz + nz / nl * push);
      nrm.push(nx / nl, ny / nl, nz / nl);
      uv.push(fu, 1 - fv);
      if (i < seg && j < seg) {
        const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* sphere shell with an elliptical opening facing +Z (the hood) */
function shellWithHole(rx, ry, rz, ox, oy, mat, segU, segV, zMin) {
  segU = segU || 112; segV = segV || 76;
  const idx = [], pos = [], onRim = [];
  const zm = zMin === undefined ? 0.02 : zMin;
  for (let j = 0; j <= segV; j++) {
    const th = j / segV * Math.PI;
    for (let i = 0; i <= segU; i++) {
      const ph = i / segU * Math.PI * 2;
      let x = Math.sin(th) * Math.sin(ph), y = Math.cos(th), z = Math.sin(th) * Math.cos(ph);
      const e = (x / ox) ** 2 + (y / oy) ** 2;
      let rim = false;
      if (z > -0.02 && e < 1) {                 // slide interior points onto the rim
        const k = 1 / Math.sqrt(Math.max(1e-6, e));
        x *= k; y *= k;
        z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
        rim = true;
      }
      onRim.push(rim);
      pos.push(x * rx, y * ry, z * rz);
    }
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
    if (onRim[a] && onRim[b] && onRim[c] && onRim[d]) continue;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.material.side = THREE.DoubleSide;
  m.castShadow = true; return m;
}

/* a flat graphic laid onto a sphere surface (chest pumpkin, bats, web) */
function decalPatch(tex, rx, ry, rz, halfX, halfY, cx, cy, eps, seg) {
  seg = seg || 22;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
    const fu = i / seg, fv = j / seg;
    const u = cx + (fu - 0.5) * 2 * halfX;
    const w = cy - (fv - 0.5) * 2 * halfY;
    const z = Math.sqrt(Math.max(0.04, 1 - u * u - w * w));
    pos.push(u * rx * (1 + eps), w * ry * (1 + eps), z * rz * (1 + eps));
    uv.push(fu, 1 - fv);
    if (i < seg && j < seg) {
      const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    map: tex, transparent: true, shininess: 6, specular: 0x121016, depthWrite: false
  }));
}

function cvTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function jackChestTex() {
  return cvTex(256, 256, (g, w) => {
    g.clearRect(0, 0, w, w); g.fillStyle = '#211F27';
    g.beginPath(); g.moveTo(62, 96); g.lineTo(112, 132); g.lineTo(58, 150); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(194, 96); g.lineTo(144, 132); g.lineTo(198, 150); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(52, 176); g.lineTo(78, 198); g.lineTo(100, 178); g.lineTo(126, 202);
    g.lineTo(152, 178); g.lineTo(176, 198); g.lineTo(204, 176);
    g.lineTo(192, 214); g.lineTo(64, 214); g.closePath(); g.fill();
  });
}
function batsTex() {
  return cvTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#1D1B22';
    const bat = (cx, cy, s) => {
      g.save(); g.translate(cx, cy); g.scale(s, s);
      g.beginPath();
      g.moveTo(0, 6); g.bezierCurveTo(-8, -8, -22, -12, -30, -6);
      g.bezierCurveTo(-24, -2, -24, 6, -28, 10);
      g.bezierCurveTo(-18, 6, -8, 8, -3, 14);
      g.bezierCurveTo(0, 10, 0, 10, 3, 14);
      g.bezierCurveTo(8, 8, 18, 6, 28, 10);
      g.bezierCurveTo(24, 6, 24, -2, 30, -6);
      g.bezierCurveTo(22, -12, 8, -8, 0, 6);
      g.closePath(); g.fill(); g.restore();
    };
    bat(58, 66, 1.0); bat(128, 52, 1.25); bat(198, 68, 0.95);
  });
}
function webTex() {
  return cvTex(256, 256, (g, w) => {
    g.clearRect(0, 0, w, w);
    g.strokeStyle = 'rgba(255,255,255,0.82)'; g.lineWidth = 3.4; g.lineCap = 'round';
    const cx = 18, cy = 18;
    for (let k = 0; k < 5; k++) {
      const a = k / 4 * Math.PI / 2;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 230, cy + Math.sin(a) * 230); g.stroke();
    }
    for (let r = 46; r <= 210; r += 42) {
      g.beginPath();
      for (let k = 0; k <= 4; k++) {
        const a = k / 4 * Math.PI / 2;
        const rr = r * (k % 2 ? 0.90 : 1.0);
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (k === 0) g.moveTo(x, y);
        else g.quadraticCurveTo(cx + Math.cos(a - Math.PI / 8) * rr * 0.86,
          cy + Math.sin(a - Math.PI / 8) * rr * 0.86, x, y);
      }
      g.stroke();
    }
  });
}

/* pom-pom: a cluster of little tufts */
export function pomPom(color, r, seed) {
  let sd = (seed === undefined ? 1 : seed) * 9781 + 17;
  const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  const parts = [new THREE.SphereGeometry(r * 0.60, 14, 10)];
  const N = 52;
  for (let i = 0; i < N; i++) {
    const y = 1 - 2 * (i + 0.5) / N, rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.39996, tr = r * 0.62 * (0.86 + rnd() * 0.30);
    const tuft = new THREE.SphereGeometry(r * (0.29 + rnd() * 0.11), 10, 8);
    tuft.scale(1, 1.18, 1);
    tuft.translate(Math.cos(th) * rad * tr, y * tr * 1.02, Math.sin(th) * rad * tr);
    parts.push(tuft);
  }
  const g = mergeGeometries(parts, false); g.computeVertexNormals();
  const m = new THREE.Mesh(g, soft(color, 9, 0x1c1616, 0.10));
  m.castShadow = true; return m;
}

function candyCorn(s) {
  const g = new THREE.Group();
  const bands = [[0.00, 0.34, PAL.corn[2]], [0.30, 0.70, PAL.corn[1]], [0.66, 1.00, PAL.corn[0]]];
  bands.forEach(b => {
    const r0 = 0.52 * (1 - b[0]) + 0.06, r1 = 0.52 * (1 - b[1]) + 0.06;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, (b[1] - b[0]) * 1.4, 18), soft(b[2], 34, 0x555050, 0.12));
    m.position.y = (b[0] + b[1]) / 2 * 1.4 - 0.7; g.add(m);
  });
  g.scale.setScalar(s); return g;
}

export function buildCharacter(fa) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  const mSkin  = soft(PAL.skin, 16, 0x2a2422, 0.10);
  const mOrng  = soft(PAL.orange, 22, 0x40301c, 0.09);
  const mInk   = soft(PAL.ink, 26, 0x33313a, 0.10);
  const mWhite = soft(PAL.white, 26, 0x3a3a3a, 0.09);

  /* ---- legs, striped socks, sneakers ---- */
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.225 * s, 0.74, 0);
    const thigh = capsule(0.122, 0.34, mSkin); thigh.position.y = -0.22; hip.add(thigh);
    const sneak = new THREE.Group(); sneak.position.set(0, -0.58, 0.05); hip.add(sneak);
    const up = ellip(0.215, 0.165, 0.30, mWhite, 24); up.position.y = 0.02; sneak.add(up);
    const sole = ellip(0.225, 0.055, 0.315, mInk, 24); sole.position.y = -0.10; sneak.add(sole);
    const strap = ellip(0.222, 0.05, 0.13, mInk, 16); strap.position.set(0, 0.03, 0.10); sneak.add(strap);
    body.add(hip); legs.push(hip);
  }
  /* ---- shorts: black with a web print ---- */
  const shorts = ellip(0.63, 0.285, 0.50, mInk, 34);
  shorts.position.y = 0.88; body.add(shorts);
  const wt = webTex();
  [-1, 1].forEach(s => {
    const p = decalPatch(wt, 0.63, 0.30, 0.50, 0.42, 0.52, 0.36 * s, -0.10, 0.012, 18);
    p.material.opacity = 0.85; p.scale.x = s; shorts.add(p);
  });

  /* ---- torso: orange front, dark sides, jack-o'-lantern chest ---- */
  const tg = new THREE.SphereGeometry(1, 44, 28);
  (function () {
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = 1 + 0.30 * (-y) + 0.06 * (1 - y * y);
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
      if (y < -0.72) p.setY(i, -0.72 - (y + 0.72) * 0.45);
    }
    tg.scale(0.74, 0.50, 0.55); tg.computeVertexNormals();
  })();
  const torso = new THREE.Mesh(tg, mOrng);
  torso.castShadow = true; torso.position.y = 1.30; body.add(torso);
  const chest = decalPatch(jackChestTex(), 0.80, 0.54, 0.62, 0.46, 0.44, 0.0, 0.02, 0.016, 20);
  chest.position.y = 1.30; body.add(chest);
  for (const s of [-1, 1]) {                       // dark side panels
    const sp = ellip(0.30, 0.42, 0.44, mInk, 24);
    sp.position.set(0.62 * s, 1.32, -0.04); sp.scale.x = 0.55; body.add(sp);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 8, 28), mInk);
  collar.rotation.x = Math.PI / 2; collar.position.y = 1.66; body.add(collar);

  /* ---- striped sleeves + pom-poms ---- */
  const arms = [], poms = [], hands = [];
  [[-1, PAL.teal, 3], [1, PAL.pink, 8]].forEach(function (a) {
    const s = a[0];
    const sh = new THREE.Group(); sh.position.set(0.63 * s, 1.50, 0.10);
    const cap = ellip(0.165, 0.165, 0.165, mOrng, 18); cap.position.y = -0.03; sh.add(cap);
    for (let k = 0; k < 7; k++) {                  // black / white rings
      const r = 0.128 - k * 0.006;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 0.004, 0.085, 18),
        k % 2 ? mWhite : mInk);
      ring.position.y = -0.16 - k * 0.083; ring.castShadow = true; sh.add(ring);
    }
    const hand = new THREE.Group(); hand.position.y = -0.79; sh.add(hand);
    const palm = ellip(0.115, 0.10, 0.10, mSkin, 16); hand.add(palm);
    const pom = pomPom(a[1], 0.36, a[2]); pom.position.y = -0.16; hand.add(pom);
    body.add(sh); arms.push(sh); poms.push(pom); hands.push(hand);
  });

  /* ---- head ---- */
  const head = new THREE.Group(); head.position.y = HEAD_Y; body.add(head);
  const skull = new THREE.Mesh(skullGeo(), mSkin); skull.castShadow = true; head.add(skull);

  const reliefMat = new THREE.MeshPhongMaterial({
    map: fa.relief, transparent: true, alphaTest: 0.42, shininess: 16, specular: 0x2a2630,
    emissive: new THREE.Color(0x0b0a0e)
  });
  const relief = new THREE.Mesh(facePlate(fa, { relief: 0.042, eps: 0.012 }), reliefMat);
  relief.castShadow = true; head.add(relief);
  const blush = new THREE.Mesh(facePlate(fa, { relief: 0, eps: 0.006, seg: 40, useHeight: false }),
    new THREE.MeshPhongMaterial({ map: fa.blush, transparent: true, shininess: 4,
      specular: 0x141014, depthWrite: false }));
  head.add(blush);

  /* ---- hood: dark cowl + orange cat hood with an open face ---- */
  const hood = new THREE.Group(); head.add(hood);
  const cowl = shellWithHole(RX * 1.045, RY * 1.062, RZ * 1.045, 0.776, 0.752, mInk, 112, 76, 0.02);
  hood.add(cowl);
  const shellMat = mOrng.clone();
  const shell = shellWithHole(RX * 1.105, RY * 1.12, RZ * 1.10, 0.812, 0.788, shellMat, 128, 88, 0.02);
  hood.add(shell);

  /* cat ears with stitch marks */
  const ears = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(0.58 * s, RY * 1.00, -0.06);
    e.rotation.z = -0.26 * s; e.rotation.x = -0.10;
    const outer = ellip(0.30, 0.40, 0.20, mOrng, 26);
    outer.geometry = outer.geometry.clone();
    (function taper(g) {                       // pinch the tip into a cat ear
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) / 0.40;
        const k = Math.max(0.18, 1 - Math.max(0, y) * 0.88);
        p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
      }
      g.computeVertexNormals();
    })(outer.geometry);
    e.add(outer);
    for (let k = 0; k < 3; k++) {              // stitches
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.026, 0.026), mInk);
      st.position.set(-0.02 * s, 0.05 + k * 0.105, 0.155 - k * 0.030);
      st.rotation.z = 0.55 * (k % 2 ? 1 : -1); e.add(st);
    }
    hood.add(e); ears.push(e);
  }
  /* bats across the brow of the hood */
  const bats = decalPatch(batsTex(), RX * 1.105, RY * 1.12, RZ * 1.10, 0.42, 0.16, 0.0, 0.83, 0.012, 20);
  hood.add(bats);
  /* black floppy tip with a candy corn */
  const tip = new THREE.Group();
  tip.position.set(0.80, RY * 0.86, -0.20);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.20, 0.36, -0.05),
    new THREE.Vector3(0.46, 0.56, -0.12), new THREE.Vector3(0.72, 0.50, -0.20),
    new THREE.Vector3(0.86, 0.30, -0.26)
  ]);
  const tubeG = new THREE.TubeGeometry(curve, 26, 0.20, 14, false);
  (function (g) {
    const p = g.attributes.position, n = 26 + 1, rad = 14 + 1;
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / rad) / (n - 1);
      const k = 1.05 - 0.95 * seg;
      const c = curve.getPointAt(Math.min(1, seg));
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
    }
    g.computeVertexNormals();
  })(tubeG);
  const tipM = new THREE.Mesh(tubeG, mInk); tipM.castShadow = true; tip.add(tipM);
  const corn = candyCorn(0.20); corn.position.set(0.30, 0.28, 0.14); corn.rotation.z = -0.5; tip.add(corn);
  hood.add(tip);

  root.userData = { body, head, hood, relief, blush, arms, poms, hands, legs, torso, shorts, skull, ears, shell: shellMat };
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return root;
}

const DEF_SPREAD = 0.90;

export function poseCharacter(root, p) {
  const u = root.userData, t = p.t || 0;
  const bob = p.bob || 0, sq = p.squash || 0;

  u.body.position.y = bob;
  u.body.position.x = p.bx || 0;
  u.body.scale.set(1 - sq * 0.15, 1 + sq * 0.19, 1 - sq * 0.15);
  u.body.rotation.z = p.lean || 0;
  u.body.rotation.y = p.turn || 0;
  u.body.rotation.x = p.pitch || 0;

  u.head.rotation.z = p.headTilt === undefined ? -0.08 : p.headTilt;
  u.head.rotation.x = p.headPitch || 0;
  u.head.rotation.y = p.headYaw || 0;

  const sw = p.armSwing || 0;
  const spread = p.armSpread === undefined ? DEF_SPREAD : p.armSpread;
  u.arms[0].rotation.z = (p.armLA !== undefined) ? p.armLA : -spread - sw;
  u.arms[1].rotation.z = (p.armRA !== undefined) ? p.armRA : spread - sw;
  u.arms[0].rotation.x = p.armLX !== undefined ? p.armLX : (p.armFwd || 0);
  u.arms[1].rotation.x = p.armRX !== undefined ? p.armRX : (p.armFwd || 0);

  const ls = p.legSwing || 0;
  u.legs[0].rotation.x = p.legTuck ? -p.legTuck * 0.95 : ls;
  u.legs[1].rotation.x = p.legTuck ? -p.legTuck * 0.45 : -ls;

  u.poms[0].visible = !p.hidePomL;
  u.poms[1].visible = !p.hidePomR;
  u.poms[0].rotation.set(t * 2.1, t * 1.7, t * 1.3);
  u.poms[1].rotation.set(-t * 1.9, t * 2.3, -t * 1.1);
}
