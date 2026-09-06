/* ------------------------------------------------------------------
   Character = the supplied 3D render plus poses generated from it,
   composited as untouched pixels on a camera-facing plate.
   Same buildCharacter/poseCharacter signature as the old primitive rig.
   ------------------------------------------------------------------ */
import * as THREE from 'three';

export const PAL = { skin: 0xFCD9BE };
const H0 = 3.35;   // world height; poses are narrower without the pom-poms

/* per-pose size trim, so the body reads the same when the arms move */
export const POSES = {
  stand:   { url: '/assets/poses/cut/stand.png',   k: 0.92 },
  jump:    { url: '/assets/poses/cut/jump.png',    k: 1.00 },
  reach:   { url: '/assets/poses/cut/reach.png',   k: 0.96 },
  sit:     { url: '/assets/poses/cut/sit.png',     k: 0.80 },
  present: { url: '/assets/poses/cut/present.png', k: 1.02 },
  wave:    { url: '/assets/poses/cut/wave.png',    k: 0.96 },
  hold2:   { url: '/assets/poses/cut/hold2.png',   k: 0.92 }
};

export async function loadCharacterPlate() {
  const loader = new THREE.TextureLoader();
  const out = {};
  await Promise.all(Object.keys(POSES).map(n => new Promise(res => {
    loader.load(POSES[n].url, t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      out[n] = { tex: t, w: t.image.width, h: t.image.height, k: POSES[n].k, lift: POSES[n].lift };
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
  const mat = new THREE.MeshBasicMaterial({
    map: poses.stand.tex, transparent: true, depthWrite: false, fog: false,
    alphaTest: 0.02, side: THREE.DoubleSide
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  body.add(plate);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, fog: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
  root.add(shadow);
  const hand = new THREE.Group(); body.add(hand);
  root.userData = { body, plate, mat, shadow, poses, cur: null, hands: [hand, hand],
                    poms: [], arms: [], legs: [] };
  setPose(root, 'stand');
  return root;
}

export function setPose(root, name) {
  const u = root.userData;
  const p = u.poses[name] || u.poses.stand;
  if (u.cur === name) return;
  u.cur = name;
  u.mat.map = p.tex; u.mat.needsUpdate = true;
  const h = H0 * p.k, w = h * p.w / p.h;
  u.plate.scale.set(w, h, 1);
  u.plate.position.y = h / 2 + (p.lift || 0);
  u.shadow.scale.set(w * 0.5, w * 0.19, 1);
  // the raised open hand in the "present" pose, for a prop to sit in
  u.hands[0].position.set(w * 0.30, h * 0.72, 0.03);
}

export function poseCharacter(root, p) {
  const u = root.userData;
  if (p.pose) setPose(root, p.pose);
  const bob = p.bob || 0, sq = p.squash || 0;
  u.body.position.y = bob;
  u.body.position.x = p.bx || 0;
  u.body.scale.set(1 - sq * 0.12, 1 + sq * 0.15, 1);
  u.body.rotation.z = (p.lean || 0) * 0.8;
  const lift = Math.max(0, bob);
  u.shadow.material.opacity = Math.max(0.12, 1 - lift * 0.22);
}

export function faceCamera(root, camera) {
  root.rotation.y = Math.atan2(camera.position.x - root.position.x,
                               camera.position.z - root.position.z);
}
