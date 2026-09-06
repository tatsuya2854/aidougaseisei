/* ------------------------------------------------------------------
   ChenMe halloween promo — 3D character rig.
   The head is real 3D geometry; the FACE is the original artwork,
   extracted with alpha and projected onto the head, so the closed
   side-glancing eyes of the source design can never be redrawn.
   Proportions are measured off the source drawing (1194x1209 px,
   1 px = 2.0 / 597 units, the head being 597 px wide).
   ------------------------------------------------------------------ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PAL = {
  skin:  0xFDD6BA, cream: 0xFCF3DF, brown: 0x6D3E03, yellow: 0xFDC423,
  gray:  0xA9A8A7, white: 0xFAF9F9, teal:  0x57CAC2, pink:  0xFC5A8D,
  ink:   0x140A18, earIn: 0xF7C9C2
};

const RX = 1.00, RY = 0.855, RZ = 0.88;   // skull radii
const HEAD_Y = 2.52;                       // chin lands at 1.665
// fuller cheeks / tighter crown, matching the egg-shaped head in the art
const cheek = yn => 1 + 0.075 * (0.35 - yn);

function toy(color, shine, spec) {
  return new THREE.MeshPhongMaterial({
    color, shininess: shine === undefined ? 26 : shine,
    specular: spec === undefined ? 0x3a3230 : spec
  });
}
function ellip(rx, ry, rz, mat, seg) {
  const g = new THREE.SphereGeometry(1, seg || 40, ((seg || 40) * 0.6) | 0);
  g.scale(rx, ry, rz);
  const m = new THREE.Mesh(g, mat); m.castShadow = true;
  return m;
}
function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 18), mat);
  m.castShadow = true; return m;
}
function skullGeo() {
  const g = new THREE.SphereGeometry(1, 48, 34);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = cheek(p.getY(i));
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  g.scale(RX, RY, RZ); g.computeVertexNormals();
  return g;
}

/* pom-pom: a cluster of little tufts, like the real thing */
export function pomPom(color, r, seed) {
  let sd = (seed === undefined ? 1 : seed) * 9781 + 17;
  const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  const parts = [], core = new THREE.SphereGeometry(r * 0.60, 14, 10);
  parts.push(core);
  const N = 52;
  for (let i = 0; i < N; i++) {
    const y = 1 - 2 * (i + 0.5) / N;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.39996;                       // golden-angle spread
    const jit = 0.86 + rnd() * 0.30;
    const tr = r * 0.62 * jit;
    const tuft = new THREE.SphereGeometry(r * (0.29 + rnd() * 0.11), 10, 8);
    tuft.scale(1, 1.18, 1);
    tuft.translate(Math.cos(th) * rad * tr, y * tr * 1.02, Math.sin(th) * rad * tr);
    parts.push(tuft);
  }
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, toy(color, 9, 0x1c1616));
  m.castShadow = true; return m;
}

/* face plate: the original drawing projected straight onto the skull,
   following the same cheek swell so it can never sink into the mesh   */
function facePlate(tex) {
  const x0 = -0.795, x1 = 0.795, y0 = -0.705, y1 = 0.705, eps = 0.020, seg = 28;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const fu = i / seg, fv = j / seg;
      const u = x0 + (x1 - x0) * fu;
      const w = y1 + (y0 - y1) * fv;
      const z = Math.sqrt(Math.max(0.05, 1 - u * u - w * w));
      const k = cheek(w);
      pos.push(u * k * RX + u * eps, w * RY, z * k * RZ + z * eps);
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
  return new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    map: tex, transparent: true, shininess: 6, specular: 0x141010, depthWrite: false
  }));
}

export function buildCharacter(faceTex) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  const mSkin = toy(PAL.skin, 20, 0x2e2622);
  const mCream = toy(PAL.cream, 22, 0x332e28);
  const mYellow = toy(PAL.yellow, 34, 0x453a20);
  const mGray = toy(PAL.gray, 24, 0x2e2e2e);
  const mWhite = toy(PAL.white, 34, 0x3a3a3a);
  const mBrown = toy(PAL.brown, 24, 0x2a1c08);

  /* legs + shoes */
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.225 * s, 0.55, 0);
    const thigh = capsule(0.115, 0.19, mSkin); thigh.position.y = -0.12; hip.add(thigh);
    const shoe = ellip(0.20, 0.15, 0.28, mWhite, 22);
    shoe.position.set(0, -0.34, 0.06); hip.add(shoe);
    body.add(hip); legs.push(hip);
  }
  /* shorts */
  const shorts = ellip(0.63, 0.30, 0.50, mGray, 34);
  shorts.position.y = 0.68; body.add(shorts);
  /* torso: one tapered piece, wider at the hem like the drawing */
  const tg = new THREE.SphereGeometry(1, 40, 26);
  (function () {
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = 1 + 0.30 * (-y) + 0.06 * (1 - y * y);
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
      if (y < -0.72) p.setY(i, -0.72 - (y + 0.72) * 0.45);   // flatten the hem
    }
    tg.scale(0.74, 0.50, 0.55); tg.computeVertexNormals();
  })();
  const torso = new THREE.Mesh(tg, mYellow);
  torso.castShadow = true; torso.position.y = 1.22; body.add(torso);

  /* arms + pom-poms — held up and out, as in the drawing */
  const arms = [], poms = [];
  [[-1, PAL.teal], [1, PAL.pink]].forEach(function (a) {
    const s = a[0];
    const sh = new THREE.Group();
    sh.position.set(0.63 * s, 1.42, 0.10);
    const up = capsule(0.108, 0.22, mYellow); up.position.y = -0.14; sh.add(up);
    const fore = capsule(0.096, 0.20, mSkin); fore.position.y = -0.38; sh.add(fore);
    const hand = new THREE.Group(); hand.position.y = -0.54; sh.add(hand);
    hand.add(pomPom(a[1], 0.40, s < 0 ? 3 : 8));
    body.add(sh); arms.push(sh); poms.push(hand.children[0]);
  });

  /* head */
  const head = new THREE.Group();
  head.position.y = HEAD_Y; body.add(head);
  const skull = new THREE.Mesh(skullGeo(), mSkin); skull.castShadow = true; head.add(skull);
  const face = facePlate(faceTex); head.add(face);

  /* hood: open cap + rolled brim, tipped back to clear the brow line */
  const hood = new THREE.Group(); hood.rotation.x = -0.255;
  const TH = 1.05;
  const capG = new THREE.SphereGeometry(1, 46, 28, 0, Math.PI * 2, 0, TH);
  capG.scale(RX * 1.06, RY * 1.10, RZ * 1.06);
  const cap = new THREE.Mesh(capG, mCream);
  cap.castShadow = true; cap.material.side = THREE.DoubleSide; hood.add(cap);
  const rimR = Math.sin(TH), rimY = Math.cos(TH);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.062, 10, 54), mCream);
  brim.rotation.x = Math.PI / 2;
  brim.scale.set(RX * 1.06 * rimR, RZ * 1.06 * rimR, RY * 1.10);
  brim.position.y = RY * 1.10 * rimY;
  brim.castShadow = true; hood.add(brim);
  head.add(hood);

  /* ears */
  const ears = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(0.60 * s, RY * 0.92, -0.10);
    e.rotation.z = -0.30 * s; e.rotation.x = -0.14;
    e.add(ellip(0.255, 0.42, 0.19, mCream, 26));
    const inner = ellip(0.145, 0.245, 0.075, toy(PAL.earIn, 14), 20);
    inner.position.set(0, 0.02, 0.125); e.add(inner);
    hood.add(e); ears.push(e);
  }
  /* brown leaf-shaped flap, upper right */
  const flap = new THREE.Group();
  flap.position.set(0.82, RY * 0.86, -0.10);
  flap.rotation.set(-0.05, 0.50, -0.62);
  flap.add(ellip(0.275, 0.53, 0.13, mBrown, 26));
  const fi = ellip(0.15, 0.27, 0.06, mCream, 20); fi.position.set(0.02, -0.04, 0.105); flap.add(fi);
  hood.add(flap);
  /* stitch dots on the hood front */
  const dotM = toy(PAL.ink, 8, 0x111111);
  [[-0.12, 0.60], [0.03, 0.66], [0.19, 0.58], [-0.03, 0.47]].forEach(function (d, i) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), dotM);
    const z = Math.sqrt(Math.max(0.05, 1 - d[0] * d[0] - d[1] * d[1]));
    dot.position.set(d[0] * RX * 1.03, d[1] * RY * 1.10, z * RZ * 1.03);
    dot.scale.set(1 + i * 0.2, 0.5, 1);
    hood.add(dot);
  });

  root.userData = { body, head, hood, face, arms, poms, legs, torso, shorts, skull, ears, flap };
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return root;
}

const DEF_SPREAD = 0.98;   // arms out, pom-poms up beside the shoulders

export function poseCharacter(root, p) {
  const u = root.userData, t = p.t || 0;
  const bob = p.bob || 0, sq = p.squash || 0;

  u.body.position.y = bob;
  u.body.position.x = p.bx || 0;
  u.body.scale.set(1 - sq * 0.15, 1 + sq * 0.19, 1 - sq * 0.15);
  u.body.rotation.z = p.lean || 0;
  u.body.rotation.y = p.turn || 0;
  u.body.rotation.x = p.pitch || 0;

  u.head.rotation.z = p.headTilt === undefined ? -0.10 : p.headTilt;
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

  u.poms[0].rotation.set(t * 2.1, t * 1.7, t * 1.3);
  u.poms[1].rotation.set(-t * 1.9, t * 2.3, -t * 1.1);
}
