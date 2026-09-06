/* ------------------------------------------------------------------
   Character = the supplied 3D render, composited as untouched pixels.
   Same buildCharacter/poseCharacter signature as the old primitive rig,
   so the shot list and camera work carry over unchanged; the pose
   parameters that a single still cannot express become no-ops.
   ------------------------------------------------------------------ */
import * as THREE from 'three';

export const PAL = { skin: 0xFCD9BE };

const SRC_W = 1295, SRC_H = 1203;
// The plate is wider than the old rig (raised pom-poms), and on a 9:16 frame
// width is what binds, so it is sized by width rather than height.
export const CH_W_TARGET = 3.30;
export const CH_H = CH_W_TARGET * 1203 / 1295;
const CH_W = CH_H * SRC_W / SRC_H;

export async function loadCharacterPlate(url) {
  const tex = await new Promise(res => new THREE.TextureLoader().load(url, t => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    res(t);
  }));
  return tex;
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

export function buildCharacter(tex) {
  const root = new THREE.Group();          // origin at the feet
  const body = new THREE.Group(); root.add(body);

  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false,
    alphaTest: 0.02, side: THREE.DoubleSide
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(CH_W, CH_H), mat);
  plate.position.y = CH_H / 2;
  body.add(plate);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(CH_W * 0.52, CH_W * 0.20),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, fog: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
  root.add(shadow);

  // a free anchor near the raised right hand, for props the pose can carry
  const hand = new THREE.Group(); hand.position.set(CH_W * 0.34, CH_H * 0.74, 0.02);
  body.add(hand);

  root.userData = { body, plate, mat, shadow, hands: [hand, hand], poms: [], arms: [], legs: [] };
  return root;
}

/* Accepts the old pose object; only what a single plate can honour is used. */
export function poseCharacter(root, p) {
  const u = root.userData;
  const bob = p.bob || 0, sq = p.squash || 0;
  u.body.position.y = bob;
  u.body.position.x = p.bx || 0;
  u.body.scale.set(1 - sq * 0.12, 1 + sq * 0.15, 1);
  u.body.rotation.z = (p.lean || 0) * 0.8;

  const lift = Math.max(0, bob);
  u.shadow.scale.setScalar(Math.max(0.25, 1 - lift * 0.16));
  u.shadow.material.opacity = Math.max(0.12, 1 - lift * 0.22);
  if (u.mat.userData_tint !== p.tint) {
    u.mat.color.set(p.tint === undefined ? 0xffffff : p.tint);
    u.mat.userData_tint = p.tint;
  }
}

/* keep the plate facing the camera (single front-facing pose) */
export function faceCamera(root, camera) {
  root.rotation.y = Math.atan2(camera.position.x - root.position.x,
                               camera.position.z - root.position.z);
}
