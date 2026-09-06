/* ------------------------------------------------------------------
   Character = the supplied 3D render plus poses generated from it,
   composited as untouched pixels on a camera-facing plate.

   The plate is a subdivided grid, not a quad, so the body can squash,
   arc, trail and wobble like a drawn character instead of sliding
   around as a rigid sticker. Two plates cross-fade, so a pose change
   is a quick dissolve rather than a pop.
   ------------------------------------------------------------------ */
import * as THREE from 'three';

export const PAL = { skin: 0xFCD9BE };
const H0 = 3.35;   // world height; poses are narrower without the pom-poms
const GX = 14, GY = 24;

/* per-pose size trim, so the body reads the same when the arms move */
export const POSES = {
  stand:   { url: '/assets/poses/cut/stand.png',   k: 0.920 },
  jump:    { url: '/assets/poses/cut/jump.png',    k: 0.923 },
  reach:   { url: '/assets/poses/cut/reach.png',   k: 0.929 },
  sit:     { url: '/assets/poses/cut/sit.png',     k: 0.850 },
  present: { url: '/assets/poses/cut/present.png', k: 0.984 },
  wave:    { url: '/assets/poses/cut/wave.png',    k: 0.958 },
  hold2:   { url: '/assets/poses/cut/hold2.png',   k: 0.976 },
  shy:     { url: '/assets/poses/cut/shy.png',     k: 0.986 }
};

export async function loadCharacterPlate() {
  const loader = new THREE.TextureLoader();
  const out = {};
  await Promise.all(Object.keys(POSES).map(n => new Promise(res => {
    loader.load(POSES[n].url, t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      out[n] = { tex: t, w: t.image.width, h: t.image.height, k: POSES[n].k };
      res();
    }, undefined, () => { console.error('pose failed:', n); res(); });
  })));
  return out;
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

export function buildCharacter(poses) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  const geo = new THREE.PlaneGeometry(1, 1, GX, GY);
  const base = Float32Array.from(geo.attributes.position.array);

  const mk = (tex, order) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, fog: false,
      alphaTest: 0.012, side: THREE.DoubleSide, opacity: 1
    }));
    m.renderOrder = order; return m;
  };
  const plateA = mk(poses.stand.tex, 2);
  const plateB = mk(poses.stand.tex, 1);
  plateB.visible = false;
  body.add(plateB); body.add(plateA);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, fog: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
  root.add(shadow);

  const hand = new THREE.Group(); body.add(hand);
  root.userData = { body, geo, base, plateA, plateB, shadow, poses,
                    curA: null, curB: null, hands: [hand, hand],
                    poms: [], arms: [], legs: [] };
  fitPlate(root, plateA, 'stand');
  root.userData.curA = 'stand';
  applyPose(root, 'stand', 'stand', 1);
  return root;
}

function fitPlate(root, plate, name) {
  const u = root.userData;
  const p = u.poses[name] || u.poses.stand;
  plate.material.map = p.tex; plate.material.needsUpdate = true;
  const h = H0 * p.k, w = h * p.w / p.h;
  plate.scale.set(w, h, 1);
  plate.position.y = h / 2;
  return { w: w, h: h };
}

/* keys: [[t,'pose'], ...] ascending. Returns {a, b, w} with a short
   dissolve at each switch, so a swap never pops on a single frame. */
const XF = 0.085;
export function poseAt(t, keys) {
  let i = 0;
  for (let k = 0; k < keys.length; k++) if (t >= keys[k][0]) i = k;
  const a = keys[i][1];
  if (i === 0) return { a: a, b: a, w: 1 };
  const d = t - keys[i][0];
  if (d >= XF) return { a: a, b: a, w: 1 };
  return { a: a, b: keys[i - 1][1], w: d / XF };
}

export function setPose(root, name) { applyPose(root, name, name, 1); }

export function applyPose(root, a, b, w) {
  const u = root.userData;
  if (u.curA !== a) { fitPlate(root, u.plateA, a); u.curA = a; }
  if (u.curB !== b) { fitPlate(root, u.plateB, b); u.curB = b; }
  u.plateA.material.opacity = w;
  u.plateB.visible = w < 0.999;
  const sz = u.plateA.scale;
  u.hands[0].position.set(sz.x * 0.30, sz.y * 0.72, 0.03);
}

/* ------------------------------------------------------------------
   Soft-body deform, in unit plate space: s = 0 at the feet, 1 at the
   top of the head.
     bend     steady arc of the whole body
     lag      the head trails a fast move and catches up
     wobA/wobP a damped wave running up the body after an impact
     headTip  extra rotation of the head / hood block
     skew     shear along the direction of travel
   ------------------------------------------------------------------ */
export function deform(root, d) {
  const u = root.userData;
  const pos = u.geo.attributes.position, base = u.base;
  const bend = d.bend || 0, lag = d.lag || 0, tip = d.headTip || 0;
  const wA = d.wobA || 0, wP = d.wobP || 0, br = d.breathe || 0;
  const sk = d.skew || 0;
  const cs = Math.cos(tip), sn = Math.sin(tip), PY = 0.04;   // head pivot
  for (let i = 0; i < pos.count; i++) {
    let x = base[i * 3], y = base[i * 3 + 1];
    const s = y + 0.5, s2 = s * s;
    x += bend * s2 + lag * s2 * s + wA * Math.sin(wP - s * 3.6) * s + sk * (s - 0.5);
    if (tip !== 0) {
      const hw = s <= 0.48 ? 0 : Math.min(1, (s - 0.48) / 0.30);
      const g = hw * hw * (3 - 2 * hw);
      if (g > 0) {
        const dx = x, dy = y - PY;
        x = dx + (dx * cs - dy * sn - dx) * g;
        y = PY + dy + (dx * sn + dy * cs - dy) * g;
      }
    }
    if (br !== 0) x *= 1 + br * (1 - s2) * 0.5;
    pos.array[i * 3] = x; pos.array[i * 3 + 1] = y;
  }
  pos.needsUpdate = true;
  u.geo.computeBoundingSphere();
}

export function poseCharacter(root, p) {
  const u = root.userData;
  if (p.pose) applyPose(root, p.pose, p.pose2 || p.pose, p.poseW == null ? 1 : p.poseW);
  const bob = p.bob || 0, sq = p.squash || 0;
  u.body.position.y = bob;
  u.body.position.x = p.bx || 0;
  // volume-preserving squash and stretch
  u.body.scale.set(1 / (1 + sq * 0.62), 1 + sq, 1);
  u.body.rotation.z = (p.lean || 0) * 0.8;
  deform(root, p);
  const lift = Math.max(0, bob);
  u.shadow.material.opacity = Math.max(0.10, 1 - lift * 0.22);
  const sw = Math.max(0.38, 1 - lift * 0.10);
  const sz = u.plateA.scale;
  u.shadow.scale.set(sz.x * 0.5 * sw, sz.x * 0.19 * sw, 1);
  u.shadow.position.x = (p.bx || 0) + (p.bend || 0) * sz.x * 0.40;
}

export function faceCamera(root, camera) {
  root.rotation.y = Math.atan2(camera.position.x - root.position.x,
                               camera.position.z - root.position.z);
}
