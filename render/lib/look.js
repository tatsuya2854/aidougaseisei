/* Shared soft/pastel look: dusk sky, bokeh candy, light rig. */
import * as THREE from 'three';

export function cv(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function duskSky(night) {
  return cv(540, 960, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    if (night) {
      gr.addColorStop(0.00, '#4B3E86'); gr.addColorStop(0.26, '#65529B');
      gr.addColorStop(0.50, '#8A63A6'); gr.addColorStop(0.70, '#B87C9C');
      gr.addColorStop(0.86, '#DFA284'); gr.addColorStop(1.00, '#F0C08C');
    } else {
      gr.addColorStop(0.00, '#9385C6'); gr.addColorStop(0.26, '#AE97D2');
      gr.addColorStop(0.48, '#C9A4CD'); gr.addColorStop(0.66, '#E5B4B6');
      gr.addColorStop(0.82, '#F5C69F'); gr.addColorStop(1.00, '#FAD9A8');
    }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.filter = 'blur(26px)';
    [[120, 300, 190, 64, 'rgba(255,226,222,0.50)'], [400, 240, 210, 58, 'rgba(232,214,244,0.45)'],
     [260, 470, 250, 70, 'rgba(255,214,196,0.42)'], [80, 620, 220, 64, 'rgba(255,228,205,0.45)'],
     [430, 660, 200, 58, 'rgba(250,214,206,0.42)'], [300, 120, 180, 50, 'rgba(226,212,246,0.38)']]
      .forEach(k => { g.fillStyle = k[4]; g.beginPath(); g.ellipse(k[0], k[1], k[2], k[3], 0, 0, 7); g.fill(); });
    g.filter = 'none';
  });
}

const CANDY_COLS = [['#F7A23C', '#FFD07A'], ['#C79BE8', '#F2C2E8'], ['#F58BB0', '#FFD1DE'],
                    ['#7FD8D0', '#CFF0EC'], ['#FFCE5C', '#FFEAA8']];
export function candyTex(i, blur) {
  return cv(192, 192, (g) => {
    const c = CANDY_COLS[i % CANDY_COLS.length];
    if (blur) g.filter = 'blur(' + blur + 'px)';
    g.fillStyle = c[0];
    g.beginPath(); g.ellipse(96, 96, 42, 38, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(58, 96); g.lineTo(16, 66); g.lineTo(22, 126); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(134, 96); g.lineTo(176, 66); g.lineTo(170, 126); g.closePath(); g.fill();
    g.fillStyle = c[1];
    g.beginPath(); g.ellipse(84, 84, 17, 13, -0.4, 0, 7); g.fill();
  });
}

/* floating candy: soft out-of-focus in front and behind, crisp in the mid ground */
export function candyField(scene, opts) {
  const o = Object.assign({ n: 24, cx: 0, cy: 3.5, cz: 0, spread: 13, rise: 9, seed: 99 }, opts || {});
  let s = o.seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const out = [];
  for (let i = 0; i < o.n; i++) {
    const band = i % 3;                       // 0 near, 1 mid, 2 far
    const blur = band === 0 ? 13 + rnd() * 7 : (band === 2 ? 9 + rnd() * 7 : 0);
    const sc = band === 0 ? 1.0 + rnd() * 0.5 : (band === 2 ? 1.9 + rnd() * 1.4 : 0.45 + rnd() * 0.28);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: candyTex(i, blur), transparent: true, depthWrite: false,
      opacity: band === 1 ? 1 : 0.85, fog: false
    }));
    sp.scale.set(sc, sc, 1);
    const z = o.cz + (band === 0 ? 5 + rnd() * 3 : (band === 2 ? -4 - rnd() * 9 : -1 + rnd() * 3));
    sp.position.set(o.cx + (rnd() - 0.5) * o.spread, o.cy + rnd() * o.rise, z);
    scene.add(sp);
    out.push({ s: sp, ph: rnd() * 6.28, amp: 0.10 + rnd() * 0.22, sp0: 0.5 + rnd() * 0.7, y0: sp.position.y });
  }
  return out;
}
export function driftCandy(list, t) {
  for (const c of list) {
    c.s.position.y = c.y0 + Math.sin(t * c.sp0 + c.ph) * c.amp;
    c.s.material.rotation = Math.sin(t * 0.5 + c.ph) * 0.25;
  }
}

/* pinwheel lollipop from the reference boards */
export function lollipop(i, h) {
  const g = new THREE.Group();
  const cols = i % 2 ? ['#F2913C', '#6FD3D8', '#F5D250'] : ['#C88BE8', '#F58BB0', '#F5D250'];
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, h, 10),
    new THREE.MeshPhongMaterial({ color: 0xF7F1E6, shininess: 40, emissive: 0x201c18 }));
  stick.position.y = h / 2; stick.castShadow = true; g.add(stick);
  const head = new THREE.Group(); head.position.y = h + 0.30; g.add(head);
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 10),
      new THREE.MeshPhongMaterial({ color: cols[k % 3], shininess: 46, specular: 0x666060,
        emissive: new THREE.Color(cols[k % 3]).multiplyScalar(0.10) }));
    petal.scale.set(1, 1.5, 0.5);
    petal.position.set(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0);
    petal.rotation.z = a - Math.PI / 2; petal.castShadow = true; head.add(petal);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10),
    new THREE.MeshPhongMaterial({ color: 0xFFF0C0, shininess: 60, emissive: 0x2a2618 }));
  hub.position.z = 0.06; head.add(hub);
  g.userData.head = head;
  return g;
}

export function softRig(scene, night) {
  const amb = new THREE.AmbientLight(0xE9DCFF, night ? 0.42 : 0.55);
  const hemi = new THREE.HemisphereLight(0xCDBBF0, 0xF7D4B4, night ? 0.72 : 0.95);
  const key = new THREE.DirectionalLight(0xFFE8CE, night ? 1.05 : 1.30);
  key.position.set(-5, 9, 8);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8; key.shadow.camera.right = 8;
  key.shadow.camera.top = 9; key.shadow.camera.bottom = -7;
  key.shadow.camera.near = 1; key.shadow.camera.far = 44; key.shadow.bias = -0.0014;
  key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(0xFFB37A, 1.00); rim.position.set(6, 4, -9);
  const fill = new THREE.DirectionalLight(0xC9B4FF, 0.55); fill.position.set(7, 3, 7);
  scene.add(amb, hemi, key, key.target, rim, fill);
  return { amb, hemi, key, rim, fill };
}

/* soften any prop tree into the toy-plastic palette */
export function softenMaterials(obj, shine) {
  obj.traverse(o => {
    if (o.isMesh && o.material && o.material.isMeshPhongMaterial && !o.material.map) {
      o.material.shininess = shine === undefined ? 24 : shine;
      o.material.specular = new THREE.Color(0x3a3038);
      o.material.emissive = o.material.color.clone().multiplyScalar(0.085);
    }
  });
}
