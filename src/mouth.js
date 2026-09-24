import * as THREE from 'three';
import { createArches, layoutTeeth } from './anatomy.js';
import { buildToothGeometry } from './toothGeometry.js';
import { createToothMaterial, createGumMaterial, createSoftTissueMaterial } from './materials.js';
import { ss, lerp, mulberry32 } from './util.js';

export const HINGE = new THREE.Vector3(0, 22, -46);

/**
 * Ústa pacienta: horní čelist (statická) a dolní čelist (otáčí se kolem kloubu).
 * Vše je v mm. Souřadnice čelisti: y = 0 je okluzní rovina.
 */
export class Mouth {
  constructor(patient) {
    this.patient = patient;
    this.root = new THREE.Group();
    this.upper = new THREE.Group();
    this.lowerPivot = new THREE.Group();
    this.lowerPivot.position.copy(HINGE);
    this.lower = new THREE.Group();
    this.lower.position.copy(HINGE).negate();
    this.lowerPivot.add(this.lower);
    this.root.add(this.upper, this.lowerPivot);

    this.open = 0.32;
    this.openTarget = 0.32;
    this.flinch = 0;
    this.hide = null; // 'upper' | 'lower' | null – odsunutí protější čelisti pro lepší výhled
    this.hideAmt = { upper: 0, lower: 0 };

    this.toothMat = createToothMaterial();
    this.gumMat = createGumMaterial();
    this.gumMat.userData.uniforms.uInflam.value = patient.inflam ?? 0.3;
    this.tongueMat = createSoftTissueMaterial({ base: [0.82, 0.45, 0.47], papillae: 1.0, rough: 0.55 });
    this.palateMat = createSoftTissueMaterial({ base: [0.9, 0.6, 0.6], papillae: 0.15, rough: 0.35 });
    this.floorMat = createSoftTissueMaterial({ base: [0.72, 0.3, 0.34], papillae: 0.0, rough: 0.25 });

    const rng = mulberry32(patient.seed ?? 1234);
    this.rng = rng;
    this.arches = createArches();
    this.teeth = [];
    this.gums = {};

    for (const jaw of ['upper', 'lower']) {
      const group = jaw === 'upper' ? this.upper : this.lower;
      const arch = this.arches[jaw];
      const layout = layoutTeeth(jaw, patient.missing ?? []);
      const up = jaw === 'lower' ? 1 : -1;
      const gumCover = 1.0 - (patient.recession ?? 0);

      for (const t of layout) {
        if (t.missing) {
          t.cejY = t.tipY - (t.h + 1.2);
          t.marginY = t.cejY + gumCover;
          continue;
        }
        const { geometry, meta } = buildToothGeometry(t, rng);
        t.cejY = t.tipY - meta.topY;
        t.marginY = t.cejY + gumCover;
        const mesh = new THREE.Mesh(geometry, this.toothMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const P = arch.at(t.sigma);
        const N0 = new THREE.Vector3(P.nx, 0, P.nz);
        const Y = new THREE.Vector3(0, up, 0).addScaledVector(N0, t.tilt).normalize();
        const X = new THREE.Vector3().crossVectors(Y, N0).normalize();
        const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
        const m = new THREE.Matrix4().makeBasis(X, Y, Z);
        m.setPosition(P.x, up * t.cejY, P.z);
        m.decompose(mesh.position, mesh.quaternion, mesh.scale);
        mesh.updateMatrix();
        group.add(mesh);

        const n = meta.count;
        const tooth = {
          ...t,
          index: this.teeth.length,
          mesh,
          geometry,
          meta,
          n,
          arch,
          up,
          dirt: new Float32Array(n * 4),
          care: new Float32Array(n * 4),
          weight: new Float32Array(n),
          treated: new Uint8Array(n),
          elev: new Float32Array(n),
          stats: null,
          dirty: true,
          cariesFound: false,
          hasCaries: false,
        };
        const hAttr = new Float32Array(n);
        for (let i = 0; i < n; i++) hAttr[i] = geometry.attributes.position.getY(i) / t.h;
        geometry.setAttribute('aH', new THREE.BufferAttribute(hAttr, 1));
        tooth.dirtAttr = new THREE.BufferAttribute(tooth.dirt, 4).setUsage(THREE.DynamicDrawUsage);
        tooth.careAttr = new THREE.BufferAttribute(tooth.care, 4).setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('aDirt', tooth.dirtAttr);
        geometry.setAttribute('aCare', tooth.careAttr);
        mesh.userData.tooth = tooth;
        this.teeth.push(tooth);
      }

      const gum = this.buildGum(jaw, arch, layout, group);
      this.gums[jaw] = gum;
      for (const tooth of this.teeth.filter((x) => x.jaw === jaw)) this.computeElevation(tooth, gum);
    }

    this.buildTongueAndPalate();
    this.buildWater();

    for (const tooth of this.teeth) {
      tooth.neighbors = this.teeth.filter(
        (o) => o !== tooth && o.jaw === tooth.jaw && Math.abs(o.sigma - tooth.sigma) < (o.w + tooth.w) / 2 + 4,
      );
      tooth.boundRadius = tooth.geometry.boundingSphere.radius;
    }
    this.update(0);
  }

  // Profil dásně podél oblouku: výška okraje (base), polovina šířky hřebene (r), vyklenutí (A)
  gumProfileAt(layout, sigma) {
    const pap = this.patient.papilla ?? 3.2;
    const k = layout.length;
    const bounds = [];
    for (let i = 0; i < k - 1; i++) bounds.push((layout[i].end + layout[i + 1].start) / 2);
    const lo0 = layout[0].start - 0.11;
    const hiN = layout[k - 1].end + 0.11;
    const rOf = (t) => 0.5 * t.d * (t.type === 'molar' ? 0.86 : t.type === 'premolar' ? 0.88 : 0.92);
    const contact = (a, b) => {
      const p = a.missing || b.missing ? -0.3 : pap * (a.pos <= 3 && b.pos <= 3 ? 1 : 0.75);
      return (a.marginY + b.marginY) / 2 + p;
    };
    if (sigma < lo0 || sigma > hiN) {
      const t = sigma < lo0 ? layout[0] : layout[k - 1];
      const e = sigma < lo0 ? lo0 - sigma : sigma - hiN;
      return {
        base: t.marginY - 2.2 * ss(0, 7, e),
        smooth: t.marginY - 2.2 * ss(0, 7, e) - 0.8,
        r: rOf(t) * (1 - 0.15 * ss(0, 7, e)),
        A: lerp(1.0, 2.2, ss(0, 5, e)),
        bump: 0,
        tooth: t,
        edge: e,
      };
    }
    let i = 0;
    while (i < k - 1 && sigma > bounds[i]) i++;
    const t = layout[i];
    const lo = i === 0 ? lo0 : bounds[i - 1];
    const hi = i === k - 1 ? hiN : bounds[i];
    const f = (sigma - lo) / (hi - lo);
    const bump = Math.pow(1 - Math.sin(Math.PI * f), 2.2);
    const left = f < 0.5;
    const nb = left ? layout[i - 1] : layout[i + 1];
    const yc = nb ? contact(t, nb) : t.marginY;
    const rN = nb ? (rOf(t) + rOf(nb)) / 2 : rOf(t);
    let base = t.missing ? t.marginY - 1.4 : t.marginY;
    const own = base;
    base = lerp(base, yc, bump);
    const A = t.missing ? lerp(2.4, 1.2, bump) : lerp(1.0, 0.55, bump);
    // hladká výška bez papil – do ní se profil dásně stáčí v hloubce
    const nbM = nb ? (nb.missing ? nb.marginY - 1.4 : nb.marginY) : own;
    const smooth = lerp(own, (own + nbM) / 2, Math.abs(f - 0.5) * 2) - 0.8;
    return { base, smooth, r: lerp(rOf(t), rN, bump), A, bump, tooth: t, edge: 0 };
  }

  buildGum(jaw, arch, layout, group) {
    const up = jaw === 'lower' ? 1 : -1;
    const sMin = layout[0].start - 8;
    const sMax = layout[layout.length - 1].end + 8;
    const S = Math.ceil((sMax - sMin) / 0.4) + 1;
    const JB = 22;
    const JI = 12;
    const JL = 20;
    const C = JB + (JI - 2) + JL;
    const lingEnd = jaw === 'upper' ? 0.9 : 1.4;
    const lingLen = jaw === 'upper' ? 7 : 15;
    const pos = new Float32Array(S * C * 3);
    const gumInfo = new Float32Array(S * C * 3);
    const toothIdx = new Int16Array(S * C).fill(-1);
    const profiles = [];
    const recession = this.patient.recession ?? 0;
    const inflam = this.patient.inflam ?? 0.3;
    const P = {};

    for (let i = 0; i < S; i++) {
      const sigma = sMin + ((sMax - sMin) * i) / (S - 1);
      const g = this.gumProfileAt(layout, sigma);
      profiles.push(g);
      arch.at(sigma, P);
      const col = [];
      const phi0 = Math.atan((2 * g.A) / g.r);
      // bukální strana (od hloubky k okraji)
      const buccal = [];
      {
        let o = g.r;
        let y = g.base;
        let u = 0;
        buccal.push([o, y, 0]);
        for (let j = 1; j < JB; j++) {
          const uj = 15 * Math.pow(j / (JB - 1), 1.6);
          const du = uj - u;
          const phi = lerp(phi0, 1.45, ss(0, 7, (u + uj) / 2));
          o += Math.cos(phi) * du;
          y -= Math.sin(phi) * du;
          u = uj;
          const jug = 0.7 * Math.sin(Math.PI * Math.min(1, u / 9)) * (1 - 0.7 * g.bump) * (1 - ss(0, 6, g.edge));
          buccal.push([o + jug, y + (g.smooth - g.base) * ss(0.3, 4.5, u), u]);
        }
      }
      for (let j = buccal.length - 1; j >= 0; j--) col.push(buccal[j]);
      for (let j = 1; j < JI - 1; j++) {
        const o = g.r - (2 * g.r * j) / (JI - 1);
        const q = o / g.r;
        col.push([o, g.base + g.A * (1 - q * q), -(g.r - Math.abs(o))]);
      }
      {
        let o = -g.r;
        let y = g.base;
        let u = 0;
        col.push([o, y, 0]);
        for (let j = 1; j < JL; j++) {
          const uj = lingLen * Math.pow(j / (JL - 1), 1.5);
          const du = uj - u;
          const phi = lerp(phi0, lingEnd, ss(0, 6, (u + uj) / 2));
          o -= Math.cos(phi) * du;
          y -= Math.sin(phi) * du;
          u = uj;
          col.push([o, y + (g.smooth - g.base) * ss(0.3, 4.5, u), jaw === 'upper' ? Math.min(u, 3.2) : u]);
        }
      }
      for (let j = 0; j < C; j++) {
        const [o, y, md] = col[j];
        const vi = i * C + j;
        pos[vi * 3] = P.x + P.nx * o;
        pos[vi * 3 + 1] = up * y;
        pos[vi * 3 + 2] = P.z + P.nz * o;
        const swell = inflam * (1 - ss(0, 2.2, Math.abs(md))) * (md >= 0 ? 1 : 0.4) * (1 - recession * 0.2);
        gumInfo[vi * 3] = md;
        gumInfo[vi * 3 + 1] = g.bump;
        gumInfo[vi * 3 + 2] = swell;
      }
      const tt = g.tooth.missing ? null : this.teeth.find((x) => x.jaw === jaw && x.fdi === g.tooth.fdi);
      let ti = tt ? tt.index : -1;
      if (!tt) {
        let best = 1e9;
        for (const x of this.teeth) {
          if (x.jaw !== jaw) continue;
          const dd = Math.abs(x.sigma - sigma);
          if (dd < best) {
            best = dd;
            ti = x.index;
          }
        }
      }
      for (let j = 0; j < C; j++) toothIdx[i * C + j] = ti;
    }

    const indices = [];
    for (let i = 0; i < S - 1; i++) {
      for (let j = 0; j < C - 1; j++) {
        const a = i * C + j;
        const b = a + 1;
        const c = a + C;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    // uzávěry na koncích
    const extra = [];
    const addCap = (row, flip) => {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (let j = 0; j < C; j++) {
        const vi = row * C + j;
        cx += pos[vi * 3];
        cy += pos[vi * 3 + 1];
        cz += pos[vi * 3 + 2];
      }
      const ci = S * C + extra.length / 3;
      extra.push(cx / C, cy / C, cz / C);
      for (let j = 0; j < C - 1; j++) {
        const a = row * C + j;
        if (flip) indices.push(a, a + 1, ci);
        else indices.push(a + 1, a, ci);
      }
    };
    addCap(0, false);
    addCap(S - 1, true);

    const nTot = S * C + extra.length / 3;
    const allPos = new Float32Array(nTot * 3);
    allPos.set(pos);
    allPos.set(extra, S * C * 3);
    const allInfo = new Float32Array(nTot * 3);
    allInfo.set(gumInfo);
    for (let k = S * C; k < nTot; k++) allInfo[k * 3] = 10;
    const allIdx = new Int16Array(nTot).fill(-1);
    allIdx.set(toothIdx);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
    geometry.setAttribute('aGum', new THREE.BufferAttribute(allInfo, 3));
    const blood = new Float32Array(nTot);
    const bloodAttr = new THREE.BufferAttribute(blood, 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aBlood', bloodAttr);
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    // kontrola orientace: vrchol hřebene musí mířit k okluzní rovině
    const probe = Math.floor(S / 2) * C + JB + Math.floor((JI - 2) / 2);
    if (geometry.attributes.normal.getY(probe) * up < 0) {
      const idx = geometry.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        const tmp = idx[i + 1];
        idx[i + 1] = idx[i + 2];
        idx[i + 2] = tmp;
      }
      geometry.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(geometry, this.gumMat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
    const gum = { jaw, mesh, geometry, blood, bloodAttr, toothIdx: allIdx, info: allInfo, S, C, layout, arch, up, profiles };
    mesh.userData.gum = gum;
    // okraj pro patro / dno ústní dutiny
    gum.lingualEdge = [];
    for (let i = 0; i < S; i++) {
      const vi = i * C + (C - 1);
      gum.lingualEdge.push(new THREE.Vector3(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]));
    }
    return gum;
  }

  gumHeightAt(gum, sigma, o) {
    const g = this.gumProfileAt(gum.layout, sigma);
    const q = Math.abs(o) / g.r;
    if (q <= 1) return g.base + g.A * (1 - q * q);
    return g.base - (Math.abs(o) - g.r) * ((2 * g.A) / g.r);
  }

  computeElevation(tooth, gum) {
    const pos = tooth.geometry.attributes.position;
    const m = tooth.mesh.matrix;
    const P = tooth.arch.at(tooth.sigma);
    const v = new THREE.Vector3();
    for (let i = 0; i < tooth.n; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const dx = v.x - P.x;
      const dz = v.z - P.z;
      const sigma = tooth.sigma + dx * P.tx + dz * P.tz;
      const o = dx * P.nx + dz * P.nz;
      const yUp = tooth.up * v.y;
      tooth.elev[i] = yUp - this.gumHeightAt(gum, sigma, o);
    }
  }

  // Plocha patra / dna ústní dutiny: spojuje levý a pravý jazykový okraj dásně "mostem" s klenbou.
  buildBridge(edge, vault, material, up, group, opts = {}) {
    const S = edge.length;
    const mid = Math.floor(S / 2);
    const Q = 22;
    const rows = [];
    for (let i = 0; i <= mid; i++) rows.push([edge[Math.min(S - 1, mid + i)], edge[Math.max(0, mid - i)], 0]);
    const lastA = rows[rows.length - 1][0];
    const lastB = rows[rows.length - 1][1];
    const ext = opts.extend ?? 0;
    for (let k = 1; k <= ext; k++) {
      const dz = -k * 2.2;
      const dy = (opts.extendDrop ?? 0) * (k / ext) ** 1.5;
      rows.push([
        new THREE.Vector3(lastA.x * (1 - 0.05 * k), lastA.y + up * dy, lastA.z + dz),
        new THREE.Vector3(lastB.x * (1 - 0.05 * k), lastB.y + up * dy, lastB.z + dz),
        k / ext,
      ]);
    }
    const pos = [];
    for (const [A, B, e] of rows) {
      const chord = Math.hypot(A.x - B.x, A.z - B.z);
      const ay = up * A.y;
      const by = up * B.y;
      const depthF = ss(0, 14, chord);
      for (let q = 0; q <= Q; q++) {
        const f = q / Q;
        const x = lerp(A.x, B.x, f);
        const z = lerp(A.z, B.z, f);
        const baseY = lerp(ay, by, f);
        let yy = baseY + (vault - baseY) * Math.sin(Math.PI * f) * depthF * (1 - e * 0.5);
        if (opts.rugae) {
          const edgeMask = ss(0.08, 0.3, f) * ss(0.08, 0.3, 1 - f);
          const front = 1 - ss(8, 18, 27 - z);
          yy += front * edgeMask * 0.55 * Math.sin(z * 1.25 + Math.abs(x) * 0.35) * ss(1.2, 3.5, Math.abs(x));
          yy += 0.45 * Math.exp(-(x * x) / 2.5) * depthF * (1 - e);
        }
        pos.push(x, up * yy, z);
      }
    }
    const R = rows.length;
    const idx = [];
    for (let r = 0; r < R - 1; r++) {
      for (let q = 0; q < Q; q++) {
        const a = r * (Q + 1) + q;
        const b = a + 1;
        const c = a + Q + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const probe = Math.floor(R / 2) * (Q + 1) + Q / 2;
    if (geo.attributes.normal.getY(probe) * up < 0) {
      const a = geo.index.array;
      for (let i = 0; i < a.length; i += 3) {
        const t = a[i + 1];
        a[i + 1] = a[i + 2];
        a[i + 2] = t;
      }
      geo.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  buildTongueAndPalate() {
    const ue = this.gums.upper.lingualEdge;
    const minY = Math.min(...ue.map((p) => -p.y));
    this.palate = this.buildBridge(ue, minY - 8, this.palateMat, -1, this.upper, { rugae: true, extend: 3, extendDrop: 5 });

    const le = this.gums.lower.lingualEdge;
    const minL = Math.min(...le.map((p) => p.y));
    this.floor = this.buildBridge(le, minL - 3, this.floorMat, 1, this.lower, { extend: 6, extendDrop: -14 });
    this.floorDepth = minL - 3;

    // jazyk
    const geo = new THREE.SphereGeometry(1, 64, 40);
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let x = v.x * 17.5;
      let y = v.y * 8.5;
      let z = v.z * 23;
      if (z > 0) x *= 1 - 0.38 * Math.pow(z / 23, 2);
      if (y > 0) {
        y *= 0.75;
        y -= 0.9 * Math.exp(-(x * x) / 8) * (v.y > 0.3 ? 1 : v.y / 0.3);
      }
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    const lowerMol = this.teeth.find((t) => t.jaw === 'lower' && t.pos >= 6);
    const topY = (lowerMol ? lowerMol.marginY : -8) - 4.2;
    this.tongue = new THREE.Mesh(geo, this.tongueMat);
    this.tongue.position.set(0, topY - 8.5 * 0.75 + 0.9, -3);
    this.tongue.rotation.x = 0.08;
    this.tongue.castShadow = true;
    this.tongue.receiveShadow = true;
    this.lower.add(this.tongue);
  }

  buildWater() {
    const src = this.floor.geometry;
    const geo = src.clone();
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, 0);
    geo.computeVertexNormals();
    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0xdfeaf0,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      envMapIntensity: 1.6,
      depthWrite: false,
    });
    this.water = new THREE.Mesh(geo, this.waterMat);
    this.water.renderOrder = 2;
    this.water.visible = false;
    this.lower.add(this.water);
  }

  setWater(level) {
    this.water.visible = level > 0.03;
    this.water.position.y = this.floorDepth + 1 + level * 9;
  }

  update(dt) {
    const k = dt === 0 ? 1 : 1 - Math.exp(-dt * 5);
    this.open += (this.openTarget - this.open) * k;
    this.flinch = Math.max(0, this.flinch - dt * 2.5);
    this.lowerPivot.rotation.x = this.open - Math.sin(this.flinch * 9) * this.flinch * 0.05;
    for (const jaw of ['upper', 'lower']) {
      const goal = this.hide === jaw ? 1 : 0;
      const kk = dt === 0 ? 1 : 1 - Math.exp(-dt * 9);
      this.hideAmt[jaw] += (goal - this.hideAmt[jaw]) * kk;
      if (Math.abs(this.hideAmt[jaw] - goal) < 0.01) this.hideAmt[jaw] = goal;
    }
    this.upper.position.set(0, this.hideAmt.upper * 45, -this.hideAmt.upper * 20);
    this.upper.visible = this.hideAmt.upper < 0.9;
    this.lowerPivot.position.set(HINGE.x, HINGE.y - this.hideAmt.lower * 45, HINGE.z - this.hideAmt.lower * 20);
    this.lowerPivot.visible = this.hideAmt.lower < 0.9;
    this.root.updateMatrixWorld(true);
  }

  pickables() {
    return [...this.teeth.map((t) => t.mesh), this.gums.upper.mesh, this.gums.lower.mesh, this.tongue, this.palate];
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of [this.toothMat, this.gumMat, this.tongueMat, this.palateMat, this.floorMat, this.waterMat]) m.dispose();
  }
}
