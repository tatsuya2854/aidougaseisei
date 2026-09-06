/* ------------------------------------------------------------------
   The "?" bottle as real geometry: a lofted superellipse body so the
   plastic shades and reflects like a moulded bottle instead of a decal.
   Proportions traced off assets/build/plate_hall.png (583x1193):
   body 15..567 x, 178..1177 y; collar / stem / spout above it.
   Local space: body bottom at y=0, body width 1.0, total height H.
   ------------------------------------------------------------------ */
import * as THREE from 'three';

export const BODY_W = 1.00;
export const BODY_H = 1.807;
export const H = 2.101;          // full height including the pump

/* ---------- environments ------------------------------------------- */
function pmrem(renderer, draw) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  draw(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.PMREMGenerator(renderer);
  const env = p.fromEquirectangular(tex).texture;
  p.dispose(); tex.dispose();
  return env;
}
function blobber(g) {
  return (x, y, rx, ry, col) => {
    const r = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    r.addColorStop(0, col); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
  };
}

/* dusk street: what the bottle mirrors while it is out in the scene */
export function bottleEnv(renderer, night) {
  return pmrem(renderer, g => {
    const sky = g.createLinearGradient(0, 0, 0, 256);
    if (night) {
      sky.addColorStop(0.00, '#241E48'); sky.addColorStop(0.34, '#453879');
      sky.addColorStop(0.58, '#7E5A9B'); sky.addColorStop(0.76, '#C08A90');
      sky.addColorStop(1.00, '#4E3F63');
    } else {
      sky.addColorStop(0.00, '#5E5498'); sky.addColorStop(0.34, '#9B85C4');
      sky.addColorStop(0.58, '#C99EC0'); sky.addColorStop(0.78, '#F0BE97');
      sky.addColorStop(1.00, '#6E5E7E');
    }
    g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
    g.filter = 'blur(9px)';
    const blob = blobber(g);
    blob(126, 58, 60, 46, 'rgba(255,252,240,1)');       // moon / key
    blob(392, 80, 44, 36, 'rgba(226,214,255,0.55)');
    blob(60, 176, 66, 26, 'rgba(255,182,104,0.80)');    // street candles
    blob(300, 182, 78, 28, 'rgba(255,200,128,0.70)');
    blob(468, 168, 54, 24, 'rgba(255,166,92,0.62)');
    blob(210, 150, 52, 62, 'rgba(30,20,44,0.55)');      // dark house walls
    blob(470, 60, 46, 54, 'rgba(28,20,42,0.45)');
    g.filter = 'none';
  });
}

/* white cyc with black flags either side: the only thing that makes a
   white bottle read as solid on a white cut */
export function studioEnv(renderer) {
  return pmrem(renderer, g => {
    const base = g.createLinearGradient(0, 0, 0, 256);
    base.addColorStop(0.00, '#FFFFFF'); base.addColorStop(0.34, '#FBF7FF');
    base.addColorStop(0.62, '#8F869F'); base.addColorStop(1.00, '#D8D1E2');
    g.fillStyle = base; g.fillRect(0, 0, 512, 256);
    g.filter = 'blur(10px)';
    const blob = blobber(g);
    blob(128, 146, 116, 118, 'rgba(24,17,36,1)');
    blob(384, 146, 116, 118, 'rgba(24,17,36,1)');
    blob(128, 146, 60, 66, 'rgba(6,4,14,1)');
    blob(384, 146, 60, 66, 'rgba(6,4,14,1)');
    blob(256, 48, 148, 76, 'rgba(255,255,255,1)');      // key softbox, front
    blob(256, 128, 78, 42, 'rgba(255,252,246,0.9)');
    blob(0, 66, 70, 54, 'rgba(255,246,236,0.8)');
    blob(512, 66, 70, 54, 'rgba(242,240,255,0.75)');
    g.filter = 'none';
  });
}

/* ---------- lofted superellipse body -------------------------------- */
// half-width / half-depth / corner sharpness as a function of height
function profile(v) {                 // v: 0 bottom -> 1 top of the body
  let s = 1;
  if (v < 0.032) s = Math.sqrt(1 - Math.pow(1 - v / 0.032, 2)) * 0.98 + 0.02;
  else if (v > 0.885) {
    const k = (v - 0.885) / 0.115;
    s = 1 - 0.735 * Math.pow(k, 1.55);
  } else if (v > 0.80) s = 1 - 0.035 * ((v - 0.80) / 0.085);
  const sh = Math.max(0, (v - 0.885) / 0.115);
  return { hw: 0.5 * s, hd: 0.281 * s, m: 4.4 - 2.2 * sh };
}
function surf(u, v) {                 // u: 0..1 around, angle 0 = +z (front)
  const a = u * Math.PI * 2, p = profile(v);
  const sa = Math.sin(a), ca = Math.cos(a), e = 2 / p.m;
  const x = p.hw * Math.sign(sa) * Math.pow(Math.abs(sa), e);
  const z = p.hd * Math.sign(ca) * Math.pow(Math.abs(ca), e);
  return new THREE.Vector3(x, v * BODY_H, z);
}
function bodyGeometry(NU, NV) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= NV; j++) {
    const v = j / NV;
    for (let i = 0; i <= NU; i++) {
      const p = surf(i / NU, v);
      pos.push(p.x, p.y, p.z); uv.push(i / NU, v);
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  // caps
  const capB = pos.length / 3; pos.push(0, 0, 0); uv.push(0.5, 0);
  for (let i = 0; i < NU; i++) idx.push(capB, i, i + 1);
  const top = NV * (NU + 1);
  const capT = pos.length / 3; pos.push(0, BODY_H, 0); uv.push(0.5, 1);
  for (let i = 0; i < NU; i++) idx.push(capT, top + i + 1, top + i);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* the label wraps the front arc of that same surface, lifted off it.
   Columns are spaced by arc length, so the printed art keeps its aspect. */
function labelGeometry(halfArc, v0, v1, lift) {
  const NU = 44, NV = 52, pos = [], nrm = [], uv = [], idx = [];
  const e = 0.0016, vm = (v0 + v1) / 2;

  // arc-length table around the front of the cross-section at mid height
  const S = 900, us = [], ss = [];
  let acc = 0, prev = surf(-0.25, vm);
  for (let i = 0; i <= S; i++) {
    const u = -0.25 + 0.5 * i / S, p = surf(u, vm);
    acc += p.distanceTo(prev); prev = p;
    us.push(u); ss.push(acc);
  }
  const mid = acc / 2;
  const uAt = (arc) => {                       // arc measured from the centre
    const target = mid + arc;
    let lo = 0, hi = S;
    while (hi - lo > 1) { const k = (lo + hi) >> 1; if (ss[k] < target) lo = k; else hi = k; }
    const t = (target - ss[lo]) / Math.max(1e-9, ss[hi] - ss[lo]);
    return us[lo] + (us[hi] - us[lo]) * t;
  };

  for (let j = 0; j <= NV; j++) {
    const v = v0 + (v1 - v0) * j / NV;
    for (let i = 0; i <= NU; i++) {
      const u = uAt(-halfArc + 2 * halfArc * i / NU);
      const p = surf(u, v);
      const du = surf(u + e, v).sub(surf(u - e, v));
      const dv = surf(u, Math.min(1, v + e)).sub(surf(u, Math.max(0, v - e)));
      const n = new THREE.Vector3().crossVectors(dv, du).normalize();
      if (n.x * p.x + n.z * p.z < 0) n.negate();     // keep it pointing outwards
      pos.push(p.x + n.x * lift, p.y + n.y * lift, p.z + n.z * lift);
      nrm.push(n.x, n.y, n.z);
      void 0;
      uv.push(i / NU, j / NV);
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* ------------------------------------------------------------------ */
export function makeBottle(labelTex, env, opt) {
  const o = opt || {};
  const grp = new THREE.Group();

  const plastic = (x) => new THREE.MeshPhysicalMaterial(Object.assign({
    color: 0xFFFFFF, roughness: 0.34, metalness: 0.0,
    clearcoat: 1.0, clearcoatRoughness: 0.045,
    envMap: env, envMapIntensity: o.envI || 1.9, fog: false
  }, x || {}));

  const body = new THREE.Mesh(bodyGeometry(o.seg || 72, o.segV || 84),
    plastic({ color: 0xF6F2FA, roughness: 0.21, sheen: 0.5, sheenRoughness: 0.5,
              sheenColor: new THREE.Color(0xEDE4F6) }));
  body.castShadow = true; body.receiveShadow = true; grp.add(body);

  // label: 494x860 art, wrapped on the front arc at its printed aspect
  const LABEL_H = 1.492, LABEL_ARC = LABEL_H * 494 / 860;
  const v0 = 0.044, v1 = v0 + LABEL_H / BODY_H;
  const lab = new THREE.Mesh(labelGeometry(LABEL_ARC / 2, v0, v1, 0.0035),
    new THREE.MeshPhysicalMaterial({ map: labelTex, emissiveMap: labelTex,
      emissive: 0x6E6E6E, roughness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.07,
      envMap: env, envMapIntensity: (o.envI || 1.9) * 0.16, fog: false,
      side: THREE.FrontSide }));
  lab.renderOrder = 2; grp.add(lab);

  /* shoulder -> collar -> stem -> spout */
  const white = plastic({ color: 0xFBF8FD, roughness: 0.20 });

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.133, 0.142, 0.098, 34), white);
  collar.position.y = BODY_H + 0.040; grp.add(collar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.017, 9, 34), white);
  ring.rotation.x = Math.PI / 2; ring.position.y = BODY_H + 0.090; grp.add(ring);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.117, 0.124, 0.160, 32), white);
  stem.position.y = BODY_H + 0.212; grp.add(stem);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.054, 0.462, 22), white);
  arm.rotation.z = Math.PI / 2 + 0.088;
  arm.position.set(-0.196, BODY_H + 0.291, 0); grp.add(arm);
  const armCap = new THREE.Mesh(new THREE.SphereGeometry(0.053, 20, 16), white);
  armCap.position.set(0.024, BODY_H + 0.309, 0); grp.add(armCap);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0275, 16, 12), white);
  tip.position.set(-0.418, BODY_H + 0.271, 0); grp.add(tip);
  for (const m of [collar, ring, stem, arm, armCap, tip]) m.castShadow = true;

  /* two blown specular streaks, kept on the camera side by faceStreaks */
  const streakTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0.00, 'rgba(255,255,255,0)'); gr.addColorStop(0.42, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.60, 'rgba(255,255,255,0.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    const fade = g.createLinearGradient(0, 0, 0, 256);
    fade.addColorStop(0.00, 'rgba(0,0,0,1)'); fade.addColorStop(0.16, 'rgba(0,0,0,0)');
    fade.addColorStop(0.82, 'rgba(0,0,0,0)'); fade.addColorStop(1.00, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = fade; g.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const mkStreak = (x, w, h, a) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, opacity: a,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.set(x, BODY_H * 0.50, 0.30); m.renderOrder = 6; return m;
  };
  const streaks = new THREE.Group();
  streaks.add(mkStreak(-0.398, 0.072, BODY_H * 0.78, 0.40));
  streaks.add(mkStreak(0.415, 0.044, BODY_H * 0.66, 0.24));
  grp.add(streaks);

  grp.userData = { body, lab, streaks };
  return grp;
}

/* the highlights live on the surface, so spin the whole bottle to camera */
export function faceStreaks(grp, camera) {
  const u = grp.userData; if (!u) return;
  const v = new THREE.Vector3(); grp.getWorldPosition(v);
  grp.rotation.y = Math.atan2(camera.position.x - v.x, camera.position.z - v.z);
}
