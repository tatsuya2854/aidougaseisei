/* Halloween set dressing — everything procedural, no external art. */
import * as THREE from 'three';

export function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  t.anisotropy = 4;
  return t;
}

export function glowSprite(color, size, opacity) {
  const tex = canvasTex(128, 128, (g, w) => {
    const r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.20, 'rgba(255,255,255,0.72)');
    gr.addColorStop(0.52, 'rgba(255,255,255,0.20)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, opacity: opacity === undefined ? 1 : opacity
  }));
  s.scale.set(size, size, 1);
  return s;
}

/* ---------------- jack-o'-lantern ---------------- */
const faceTexCache = {};
function jackFaceTex() {
  if (faceTexCache.f) return faceTexCache.f;
  faceTexCache.f = canvasTex(256, 256, (g, w) => {
    g.clearRect(0, 0, w, w);
    g.fillStyle = '#FFE9A0';
    g.beginPath(); g.moveTo(56, 96); g.lineTo(108, 128); g.lineTo(52, 146); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(200, 96); g.lineTo(148, 128); g.lineTo(204, 146); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(128, 130); g.lineTo(146, 162); g.lineTo(110, 162); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(48, 178); g.lineTo(74, 196); g.lineTo(96, 180); g.lineTo(118, 200);
    g.lineTo(140, 180); g.lineTo(162, 198); g.lineTo(186, 180); g.lineTo(208, 196);
    g.lineTo(196, 218); g.lineTo(60, 218); g.closePath(); g.fill();
  });
  return faceTexCache.f;
}

export function pumpkin(scale, opts) {
  const o = Object.assign({ face: true, light: true, lightPower: 26, seed: 1 }, opts || {});
  const grp = new THREE.Group();
  const g = new THREE.SphereGeometry(1, 46, 30);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const th = Math.atan2(v.z, v.x);
    const rib = 1 + 0.170 * Math.cos(th * 8) - 0.045;
    const bulge = 1 + 0.10 * (1 - v.y * v.y);
    p.setXYZ(i, v.x * rib * bulge, v.y * 0.80, v.z * rib * bulge);
  }
  g.computeVertexNormals();
  const body = new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    color: 0xF08A22, shininess: 30, specular: 0x53360f
  }));
  body.castShadow = true; body.receiveShadow = true; grp.add(body);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.17, 0.42, 10),
    new THREE.MeshPhongMaterial({ color: 0x59431C, shininess: 12 }));
  stem.position.y = 0.88; stem.rotation.z = 0.30; stem.castShadow = true; grp.add(stem);

  if (o.face) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.62),
      new THREE.MeshBasicMaterial({
        map: jackFaceTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
      }));
    f.position.set(0, -0.02, 0.90); grp.add(f);
    const gl = glowSprite(0xFFA53C, 4.6, 0.85); gl.position.set(0, 0, 0.55); grp.add(gl);
    grp.userData.glow = gl;
  }
  if (o.light) {
    const l = new THREE.PointLight(0xFF9A34, o.lightPower, 16 * scale, 2);
    l.position.set(0, 0.15, 0.5); grp.add(l);
    grp.userData.light = l;
  }
  grp.scale.setScalar(scale);
  grp.position.y = 0.80 * scale;
  return grp;
}

/* ---------------- ground ---------------- */
export function cobbleGround(size) {
  const tex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2A1730'; g.fillRect(0, 0, w, h);
    let s = 12345;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let row = 0; row < 9; row++) {
      for (let col = -1; col < 10; col++) {
        const x = col * 56 + (row % 2 ? 28 : 0) + rnd() * 6;
        const y = row * 57 + rnd() * 5;
        const rw = 46 + rnd() * 8, rh = 40 + rnd() * 6;
        const l = 40 + rnd() * 34;
        g.fillStyle = 'rgb(' + (l + 30) + ',' + (l + 8) + ',' + (l + 26) + ')';
        g.beginPath(); g.roundRect(x, y, rw, rh, 15); g.fill();
        g.fillStyle = 'rgba(255,200,150,0.09)';
        g.beginPath(); g.roundRect(x + 4, y + 3, rw - 8, rh * 0.42, 12); g.fill();
      }
    }
  }, [22, 22]);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshPhongMaterial({ map: tex, shininess: 16, specular: 0x33202c }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  return m;
}

/* ---------------- house ---------------- */
export function house(w, h, d, seed) {
  const grp = new THREE.Group();
  let s = seed * 7919 + 13;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshPhongMaterial({ color: 0x241436, shininess: 6 }));
  wall.position.y = h / 2; wall.castShadow = true; wall.receiveShadow = true; grp.add(wall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.86, h * 0.42, 4),
    new THREE.MeshPhongMaterial({ color: 0x180D28, shininess: 4 }));
  roof.position.y = h + h * 0.21; roof.rotation.y = Math.PI / 4; roof.castShadow = true; grp.add(roof);
  const winM = new THREE.MeshBasicMaterial({ color: 0xFFC066 });
  for (let i = 0; i < 4; i++) {
    if (rnd() < 0.28) continue;
    const ww = 0.55, wh = 0.8;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), winM);
    win.position.set((rnd() - 0.5) * w * 0.6, h * (0.32 + 0.36 * (i % 2)) + rnd() * 0.4, d / 2 + 0.02);
    grp.add(win);
    const gl = glowSprite(0xFFB35A, 2.6, 0.55);
    gl.position.copy(win.position); gl.position.z += 0.1; grp.add(gl);
  }
  return grp;
}

/* ---------------- bats / candy / stars ---------------- */
export function batSprite(size) {
  const tex = canvasTex(128, 80, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#1A0E2E';
    g.beginPath();
    g.moveTo(64, 44); g.bezierCurveTo(52, 16, 34, 8, 20, 14);
    g.bezierCurveTo(26, 22, 24, 32, 18, 36);
    g.bezierCurveTo(10, 26, 2, 30, 2, 38);
    g.bezierCurveTo(12, 40, 16, 48, 18, 56);
    g.bezierCurveTo(28, 48, 42, 48, 52, 58);
    g.bezierCurveTo(58, 50, 70, 50, 76, 58);
    g.bezierCurveTo(86, 48, 100, 48, 110, 56);
    g.bezierCurveTo(112, 48, 116, 40, 126, 38);
    g.bezierCurveTo(126, 30, 118, 26, 110, 36);
    g.bezierCurveTo(104, 32, 102, 22, 108, 14);
    g.bezierCurveTo(94, 8, 76, 16, 64, 44);
    g.closePath(); g.fill();
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(size, size * 0.62, 1);
  return s;
}

const CANDY = [0xFF5F9E, 0xFFC94A, 0x6FD8E8, 0xB98BFF, 0x8CE0A8, 0xFF8A4A];
export function candy(i, r) {
  const c = CANDY[i % CANDY.length];
  const m = new THREE.MeshPhongMaterial({ color: c, shininess: 70, specular: 0x888888 });
  if (i % 3 === 0) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.44, 8, 16), m);
    g.castShadow = true; return g;
  }
  const g = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
  g.scale.set(1, 0.82, 1); g.castShadow = true; return g;
}

export function starField(n, radius) {
  const pos = [];
  let s = 4242;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.9 + 0.05);
    pos.push(Math.sin(ph) * Math.cos(th) * radius, Math.abs(Math.cos(ph)) * radius * 0.9, Math.sin(ph) * Math.sin(th) * radius);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const tex = canvasTex(64, 64, (c, w) => {
    const r = w / 2, gr = c.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,244,210,0.5)');
    gr.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, w);
  });
  return new THREE.Points(g, new THREE.PointsMaterial({
    size: 1.7, map: tex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
}

export function skyDome(radius) {
  const tex = canvasTex(64, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0.00, '#120826');
    gr.addColorStop(0.30, '#241046');
    gr.addColorStop(0.55, '#46195F');
    gr.addColorStop(0.75, '#8A2F5E');
    gr.addColorStop(0.90, '#D35C2E');
    gr.addColorStop(1.00, '#F79240');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
  return m;
}

export function moon(size) {
  const grp = new THREE.Group();
  const tex = canvasTex(256, 256, (g, w) => {
    const r = w / 2, gr = g.createRadialGradient(r * 0.72, r * 0.66, r * 0.1, r, r, r);
    gr.addColorStop(0, '#FFFDF2'); gr.addColorStop(0.55, '#FFF0BE'); gr.addColorStop(1, '#F6CF84');
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r * 0.98, 0, 7); g.fill();
    g.fillStyle = 'rgba(214,178,112,0.30)';
    [[92, 108, 26], [162, 84, 17], [126, 168, 22], [74, 160, 13]].forEach(c => {
      g.beginPath(); g.arc(c[0], c[1], c[2], 0, 7); g.fill();
    });
  });
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  disc.scale.set(size, size, 1); grp.add(disc);
  const halo = glowSprite(0xFFE6A8, size * 3.4, 0.55); halo.material.fog = false; grp.add(halo);
  return grp;
}
