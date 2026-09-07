/* ------------------------------------------------------------------
   The character as an articulated puppet.

   Every piece is the supplied render's own pixels, cut on colour by
   handoff/cut_parts.py and hung off a joint hierarchy, so the arms, legs,
   head and twin-tail actually move instead of the whole drawing sliding
   about. The head plate swaps per expression; the eyes stay closed in
   every one of them because every plate comes from the closed-eye set.

       root -> body -> hips -> torso -> head -> tail
                                     -> armL / armR
                            -> legL / legR
   ------------------------------------------------------------------ */
import * as THREE from 'three';

export const PAL = { skin: 0xFCD9BE };

const HW = 3.20;                // world height of the character, feet to hood
const FOOT_Y = 776;             // source pixel row the feet stand on
const CX = 248;                 // source pixel column of the body centreline
let S = HW / 775;               // world units per source pixel

const EXPR = ['stand', 'jump', 'reach', 'sit', 'present', 'wave', 'hold2', 'shy'];
const PART = ['tail', 'armL', 'armR', 'legL', 'legR', 'torso'];

/* draw order, back to front */
const ORDER = { tail: 0, armL: 1, armR: 2, legL: 3, legR: 4, torso: 5, head: 6 };
const ZOFF  = { tail: -0.075, armL: -0.045, armR: -0.040, legL: -0.020,
                legR: -0.016, torso: 0.0, head: 0.055 };

function tex(loader, url) {
  return new Promise(res => loader.load(url, t => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    res(t);
  }, undefined, () => { console.error('part failed', url); res(null); }));
}

export async function loadPuppet() {
  const meta = await fetch('/assets/parts/parts.json').then(r => r.json());
  const loader = new THREE.TextureLoader();
  const parts = {}, heads = {};
  await Promise.all([
    ...PART.map(async n => { parts[n] = await tex(loader, '/assets/parts/' + n + '.png'); }),
    ...EXPR.map(async n => { heads[n] = await tex(loader, '/assets/parts/head_' + n + '.png'); })
  ]);
  return { meta, parts, heads };
}

function shadowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(70,44,96,0.55)');
  gr.addColorStop(0.55, 'rgba(70,44,96,0.22)');
  gr.addColorStop(1, 'rgba(70,44,96,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function plate(texture, order, z) {
  const geo = new THREE.PlaneGeometry(1, 1, 6, 10);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, fog: false,
    alphaTest: 0.006, side: THREE.DoubleSide
  }));
  m.renderOrder = order; m.position.z = z;
  m.userData.base = Float32Array.from(geo.attributes.position.array);
  return m;
}

export function buildPuppet(A) {
  const meta = A.meta, P = meta.parts, R = meta.rig;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const N = {};

  const node = (name, parentName) => {
    const g = new THREE.Group();
    const p = R[name].pivot, q = parentName ? R[parentName].pivot : null;
    if (q) g.position.set((p[0] - q[0]) * S, (q[1] - p[1]) * S, 0);
    else   g.position.set((p[0] - CX) * S, (FOOT_Y - p[1]) * S, 0);
    N[name] = g; return g;
  };

  const hips = node('root', null);           body.add(hips);
  const torso = node('torso', 'root');       hips.add(torso);
  const head = node('head', 'torso');        torso.add(head);
  const tail = node('tail', 'head');         head.add(tail);
  const armL = node('armL', 'torso');        torso.add(armL);
  const armR = node('armR', 'torso');        torso.add(armR);
  const legL = node('legL', 'root');         hips.add(legL);
  const legR = node('legR', 'root');         hips.add(legR);

  const mesh = {};
  for (const n of PART) {
    const b = P[n], piv = R[n] ? R[n].pivot : R.root.pivot;
    const m = plate(A.parts[n], ORDER[n], ZOFF[n]);
    m.scale.set(b.w * S, b.h * S, 1);
    m.position.x = (b.x + b.w / 2 - piv[0]) * S;
    m.position.y = -(b.y + b.h / 2 - piv[1]) * S;
    m.userData.baseScaleY = m.scale.y; m.userData.basePosY = m.position.y;
    N[n].add(m); mesh[n] = m;
  }

  // head: one plate per expression, all registered on the neck
  const hm = plate(A.heads.stand, ORDER.head, ZOFF.head);
  head.add(hm); mesh.head = hm;

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true,
      depthWrite: false, fog: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
  shadow.scale.set(1.55, 0.58, 1);
  root.add(shadow);

  // a handle the props can be parented to: the right hand, at rest
  const hand = new THREE.Group();
  hand.position.set(0, -(P.armR.y + P.armR.h - R.armR.pivot[1]) * S + 0.06, 0.05);
  armR.add(hand);

  root.userData = { body, N, mesh, meta, heads: A.heads, expr: null,
                    shadow, hands: [hand, hand], hand,
                    poms: [], arms: [], legs: [] };
  setExpr(root, 'stand');
  return root;
}

const HOOD_REF = 467;   // hood width of the plate the body was cut from
export function setExpr(root, name) {
  const u = root.userData;
  if (u.expr === name) return;
  const h = u.meta.heads[name] || u.meta.heads.stand;
  const t = u.heads[name] || u.heads.stand;
  u.expr = name;
  const m = u.mesh.head;
  m.material.map = t; m.material.needsUpdate = true;
  const k = S * (HOOD_REF / h.hood[0]);
  const w = h.w * k, ht = h.h * k;
  m.scale.set(w, ht, 1);
  m.position.x = (0.5 - h.px) * w;
  m.position.y = (h.py - 0.5) * ht;
}

/* soft bend inside one plate: s = 0 at the joint end, 1 at the free end */
function bendMesh(m, bend, stretch) {
  const pos = m.geometry.attributes.position, base = m.userData.base;
  if (!bend && !stretch) {
    if (m.userData.dirty) {
      pos.array.set(base); pos.needsUpdate = true; m.userData.dirty = false;
    }
    return;
  }
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1];
    const s = 0.5 - y;                      // 0 at the top edge, 1 at the bottom
    pos.array[i * 3] = x + bend * s * s;
    pos.array[i * 3 + 1] = y - stretch * s;
  }
  pos.needsUpdate = true; m.userData.dirty = true;
}

/* ------------------------------------------------------------------
   P: the full body pose. Angles are radians, positive = clockwise on
   screen. Arms hang at 0 and raise towards +/- PI.
   ------------------------------------------------------------------ */
export function posePuppet(root, P) {
  const u = root.userData, N = u.N, M = u.mesh;
  if (P.expr) setExpr(root, P.expr);

  const sq = P.squash || 0;
  u.body.position.set(P.bx || 0, P.by || 0, 0);
  u.body.scale.set(1 / (1 + sq * 0.60), 1 + sq, 1);
  u.body.rotation.z = P.lean || 0;

  N.root.position.y = (FOOT_Y - u.meta.rig.root.pivot[1]) * S + (P.hipY || 0);
  N.root.position.x = (P.hipX || 0);
  N.root.rotation.z = P.pelvis || 0;

  N.torso.rotation.z = P.spine || 0;
  N.head.rotation.z = P.head || 0;
  N.tail.rotation.z = P.tail || 0;
  const aL = P.armL || 0, aR = P.armR || 0;
  N.armL.rotation.z = aL;
  N.armR.rotation.z = aR;
  // a raised arm comes round in front of the vest, but stays behind the hood
  // an arm swung out comes in front of the vest; raised high it has to clear
  // the hood as well, and it reaches a little further as the shoulder opens
  const cl01 = (v) => v < 0 ? 0 : (v > 1 ? 1 : v);
  const front = (a) => cl01((Math.abs(a) - 0.62) / 0.30);
  const over = (a) => cl01((Math.abs(a) - 1.80) / 0.22);
  const reach = (a) => 1 + 0.22 * cl01((Math.abs(a) - 1.05) / 1.25);
  const lift1 = P.armLFront != null ? P.armLFront : front(aL);
  const lift2 = P.armRFront != null ? P.armRFront : front(aR);
  const ov1 = over(aL), ov2 = over(aR);
  M.armL.renderOrder = ov1 > 0.5 ? 6.6 : (lift1 > 0.5 ? 5.4 : ORDER.armL);
  M.armR.renderOrder = ov2 > 0.5 ? 6.7 : (lift2 > 0.5 ? 5.5 : ORDER.armR);
  M.armL.position.z = ZOFF.armL + lift1 * 0.085 + ov1 * 0.09;
  M.armR.position.z = ZOFF.armR + lift2 * 0.085 + ov2 * 0.09;
  for (const [m, a] of [[M.armL, aL], [M.armR, aR]]) {
    const k = reach(a);
    m.scale.y = m.userData.baseScaleY * k;
    m.position.y = m.userData.basePosY * k;
  }
  M.armL.visible = M.armR.visible = !P.hideArms;
  N.legL.rotation.z = P.legL || 0;
  N.legR.rotation.z = P.legR || 0;

  bendMesh(M.torso, P.torsoBend || 0, 0);
  // limbs curve as the joint opens, so they never read as straight sticks
  bendMesh(M.armL, (P.armLBend || 0) + aL * 0.055, 0);
  bendMesh(M.armR, (P.armRBend || 0) + aR * 0.055, 0);
  bendMesh(M.legL, (P.legLBend || 0) + (P.legL || 0) * 0.075, 0);
  bendMesh(M.legR, (P.legRBend || 0) + (P.legR || 0) * 0.075, 0);
  bendMesh(M.tail, P.tailBend || 0, 0);

  const lift = Math.max(0, P.by || 0);
  const k = Math.max(0.40, 1 - lift * 0.11);
  u.shadow.scale.set(1.55 * k, 0.58 * k, 1);
  u.shadow.position.x = (P.bx || 0) + (P.hipX || 0);
  u.shadow.material.opacity = Math.max(0.10, 1 - lift * 0.20);
}

export function faceCamera(root, camera) {
  root.rotation.y = Math.atan2(camera.position.x - root.position.x,
                               camera.position.z - root.position.z);
}

/* keys: [[t,'expr'], ...] ascending */
export function exprAt(t, keys) {
  let i = 0;
  for (let k = 0; k < keys.length; k++) if (t >= keys[k][0]) i = k;
  return keys[i][1];
}
