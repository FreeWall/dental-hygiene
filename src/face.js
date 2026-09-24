import * as THREE from 'three';
import { HINGE } from './mouth.js';
import { ss, lerp } from './util.js';

// Profil rtu: [vzdálenost od okraje ústního otvoru (mm), posun dopředu (mm)]
const PROFILE = [
  [5, -1.5],
  [2.5, 0.2],
  [0.6, 2.2],
  [0, 4.2],
  [0.8, 6.8],
  [3, 8.8],
  [6.5, 9.6],
  [10, 9.0],
  [12.5, 8.2],
  [17, 7.4],
  [25, 6.2],
  [36, 3.5],
  [50, -2],
  [66, -12],
];
const SEG = 88;

/** Rty a obličej kolem úst. Spodní polovina se hýbe s dolní čelistí. */
export class Face {
  constructor(mouth) {
    this.mouth = mouth;
    const up11 = mouth.teeth.find((t) => t.fdi === 11);
    const lo31 = mouth.teeth.find((t) => t.fdi === 31);
    const upperEdge = -(up11 ? up11.marginY : -9) + 4.5;
    const lowerEdge = -((lo31 ? lo31.marginY : -7) - 4.5);
    this.W = 29;
    const P = PROFILE.length;
    const n = SEG * P;
    this.upperPos = new Float32Array(n * 3);
    this.lowerPos = new Float32Array(n * 3);
    this.weight = new Float32Array(n);
    const colors = new Float32Array(n * 3);
    const skin = new THREE.Color().setRGB(0.86, 0.64, 0.55, THREE.SRGBColorSpace);
    const lip = new THREE.Color().setRGB(0.74, 0.34, 0.37, THREE.SRGBColorSpace);
    const mucosa = new THREE.Color().setRGB(0.8, 0.4, 0.43, THREE.SRGBColorSpace);
    const c = new THREE.Color();

    for (let i = 0; i < SEG; i++) {
      const th = (i / SEG) * Math.PI * 2;
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      const upperHalf = sn >= 0;
      const H = upperHalf ? upperEdge : lowerEdge;
      // okraj otvoru – mírně "úsměvný" tvar
      const ex = this.W * cs;
      const ey = Math.sign(sn) * H * Math.pow(Math.abs(sn), 0.75);
      // normála okraje směrem ven
      let nx = cs / this.W;
      let ny = sn / Math.max(1, H);
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      const w = ss(-0.3, 0.3, sn);
      for (let j = 0; j < P; j++) {
        const [d, fwd0] = PROFILE[j];
        // rty jsou uprostřed plnější, v koutcích tenčí
        const full = 0.55 + 0.45 * Math.pow(Math.abs(sn), 0.6);
        const fwd = d < 14 ? fwd0 * full : fwd0 - (1 - full) * 3;
        const x = ex + nx * d;
        const yy = ey + ny * d;
        const zBase = 34.5 - 0.013 * x * x;
        const z = zBase + fwd - 0.002 * yy * yy;
        const k = i * P + j;
        // horní rám: y = yy; dolní rám (souřadnice dolní čelisti): y = yy
        this.upperPos.set([x, yy, z], k * 3);
        this.lowerPos.set([x, yy, z], k * 3);
        // koutky a tváře se hýbou napůl
        this.weight[k] = lerp(w, 0.5 + 0.5 * w, ss(20, 45, d)) * (1 - 0.35 * ss(0.8, 1, Math.abs(cs)) * (1 - ss(10, 30, d)));
        let col;
        if (d < 1 && fwd < 3) col = mucosa;
        else if (d < 11) col = c.copy(lip).lerp(skin, ss(8.5, 11.5, d));
        else col = skin;
        c.copy(col);
        c.multiplyScalar(1 - 0.98 * ss(16, 46, d));
        colors.set([c.r, c.g, c.b], k * 3);
      }
    }
    const idx = [];
    for (let i = 0; i < SEG; i++) {
      const i1 = (i + 1) % SEG;
      for (let j = 0; j < P - 1; j++) {
        const a = i * P + j;
        const b = i1 * P + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(idx);
    this.geometry = geo;
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.55,
      metalness: 0,
      transparent: true,
      opacity: 1,
      envMapIntensity: 0.6,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.lastOpen = null;
    this.opacity = 1;
    this.update(0, mouth.open, null);
  }

  update(dt, open, camera) {
    if (this.lastOpen === null || Math.abs(open - this.lastOpen) > 1e-4) {
      this.lastOpen = open;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), open);
      const v = new THREE.Vector3();
      const pos = this.posAttr.array;
      for (let k = 0; k < this.weight.length; k++) {
        v.fromArray(this.lowerPos, k * 3).sub(HINGE).applyQuaternion(q).add(HINGE);
        const w = this.weight[k];
        pos[k * 3] = lerp(v.x, this.upperPos[k * 3], w);
        pos[k * 3 + 1] = lerp(v.y, this.upperPos[k * 3 + 1], w);
        pos[k * 3 + 2] = lerp(v.z, this.upperPos[k * 3 + 2], w);
      }
      this.posAttr.needsUpdate = true;
      this.geometry.computeVertexNormals();
      this.geometry.computeBoundingSphere();
    }
    if (camera) {
      // obličej je vidět jen při pohledu zepředu a z dálky, jinak by zakrýval práci
      const dir = new THREE.Vector3().copy(camera.position).normalize();
      const dist = camera.position.length();
      let goal = ss(0.8, 0.92, dir.z) * ss(88, 102, dist);
      if (this.mouth.hide) goal = 0;
      this.opacity += (goal - this.opacity) * (1 - Math.exp(-dt * 8));
      this.material.opacity = this.opacity;
      this.material.depthWrite = this.opacity > 0.98;
      this.mesh.visible = this.opacity > 0.02;
    }
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
