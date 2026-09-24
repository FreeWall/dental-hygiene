import * as THREE from 'three';
import { ss, lerp } from './util.js';

const SEG_U = 40;
const ROOT_T = [-0.7, -0.45, -0.26, -0.13, -0.05];
const CROWN_K = 18;
const CAP_S = [0.07, 0.16, 0.27, 0.39, 0.51, 0.63, 0.74, 0.84, 0.92];

function crownFactors(type, t) {
  let a, b, n;
  switch (type) {
    case 'incisor':
      a = lerp(0.7, 1.0, ss(0, 0.6, t));
      b = t < 0.28 ? lerp(0.9, 1.0, ss(0, 0.28, t)) : lerp(1.0, 0.2, Math.pow((t - 0.28) / 0.72, 1.1));
      n = 2.4;
      break;
    case 'canine':
      a = t < 0.5 ? lerp(0.72, 1.0, ss(0, 0.45, t)) : lerp(1.0, 0.4, Math.pow((t - 0.5) / 0.5, 1.4));
      b = t < 0.3 ? lerp(0.9, 1.0, ss(0, 0.3, t)) : lerp(1.0, 0.44, Math.pow((t - 0.3) / 0.7, 1.3));
      n = 2.2;
      break;
    case 'premolar':
      a = t < 0.55 ? lerp(0.74, 1.0, ss(0, 0.45, t)) : lerp(1.0, 0.9, ss(0.55, 1, t));
      b = t < 0.5 ? lerp(0.86, 1.0, ss(0, 0.4, t)) : lerp(1.0, 0.84, ss(0.5, 1, t));
      n = 2.3;
      break;
    default:
      a = t < 0.5 ? lerp(0.8, 1.0, ss(0, 0.4, t)) : lerp(1.0, 0.92, ss(0.5, 1, t));
      b = t < 0.45 ? lerp(0.84, 1.0, ss(0, 0.4, t)) : lerp(1.0, 0.86, ss(0.45, 1, t));
      n = 2.8;
  }
  return [a, b, n];
}

function sectionFactors(type, t) {
  if (t >= 0) return crownFactors(type, t);
  const [a, b, n] = crownFactors(type, 0);
  const k = 1 + 0.5 * t;
  return [a * k, b * k, lerp(n, 2, Math.min(1, -t * 2))];
}

function capHeight(type, u, v, rr, lowerFirstPremolar) {
  const sh = Math.sqrt(Math.max(0, 1 - rr ** 4));
  switch (type) {
    case 'incisor':
      return 0.35 * sh;
    case 'canine':
      return 0.4 * sh + 1.9 * Math.pow(Math.max(0, 1 - rr), 1.4);
    case 'premolar': {
      const lingAmp = lowerFirstPremolar ? 0.45 : 1.15;
      const c =
        1.6 * Math.exp(-((v - 0.42) ** 2 + 0.5 * u * u) / 0.07) +
        lingAmp * Math.exp(-((v + 0.42) ** 2 + 0.5 * u * u) / 0.07);
      const fis = 0.6 * Math.exp(-(v * v) / 0.012) * (1 - u * u) * (1 - ss(0.5, 0.9, rr));
      return sh * (0.45 + c - fis);
    }
    default: {
      let c = 0;
      for (const [cu, cv, amp] of [
        [0.45, 0.45, 1.3],
        [-0.45, 0.45, 1.2],
        [0.45, -0.45, 1.25],
        [-0.45, -0.45, 1.1],
      ]) {
        c += amp * Math.exp(-((u - cu) ** 2 + (v - cv) ** 2) / 0.06);
      }
      const fis = 0.35 * (Math.exp(-(u * u) / 0.01) * (1 - v * v) + Math.exp(-(v * v) / 0.01) * (1 - u * u)) * (1 - ss(0.5, 0.9, rr));
      return sh * (0.45 + c - fis);
    }
  }
}

function fissureFactor(type, u, v, rr) {
  if (type === 'incisor' || type === 'canine') return 0;
  const inner = 1 - ss(0.6, 0.85, rr);
  if (type === 'premolar') return inner * Math.exp(-(v * v) / 0.02);
  return inner * Math.max(Math.exp(-(u * u) / 0.02), Math.exp(-(v * v) / 0.02));
}

/**
 * Procedurální geometrie zubu v lokálních souřadnicích:
 * x = meziodistálně, y = osa zubu (0 = sklovinocementová hranice, + = ke korunce), z = + vestibulárně.
 */
export function buildToothGeometry(spec, rng) {
  const { type, w, d, h } = spec;
  const lowerPM1 = spec.jaw === 'lower' && spec.pos === 4;
  const var1 = 1 + (rng() - 0.5) * 0.05;
  const var2 = 1 + (rng() - 0.5) * 0.05;
  const hw = (w / 2) * var1;
  const hd = (d / 2) * var2;

  const positions = [];
  const meta = { t: [], c: [], s: [], cap: [], fis: [] };

  const push = (x, y, z, t, c, s, cap, fis) => {
    positions.push(x, y, z);
    meta.t.push(t);
    meta.c.push(c);
    meta.s.push(s);
    meta.cap.push(cap);
    meta.fis.push(fis);
  };

  // Spodní pól kořene
  push(0, -0.82 * h, 0, -0.82, 0, 0, 0, 0);

  const wallT = [...ROOT_T];
  for (let k = 0; k <= CROWN_K; k++) wallT.push(Math.pow(k / CROWN_K, 1.2));

  const rimX = new Float32Array(SEG_U);
  const rimZ = new Float32Array(SEG_U);

  for (const t of wallT) {
    const [a, b, n] = sectionFactors(type, t);
    const e = 2 / n;
    for (let i = 0; i < SEG_U; i++) {
      const th = (i / SEG_U) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      let bb = b;
      if (type === 'incisor' && s < 0 && t > 0.2) {
        // lopatovitý tvar linguální plochy řezáků
        bb *= 1 - 0.22 * Math.sin((Math.PI * Math.min(1, (t - 0.2) / 0.7))) * Math.pow(1 - Math.abs(c), 1.2);
      }
      const x = a * hw * Math.sign(c) * Math.pow(Math.abs(c), e);
      const z = bb * hd * Math.sign(s) * Math.pow(Math.abs(s), e);
      if (t === 1) {
        rimX[i] = x;
        rimZ[i] = z;
      }
      push(x, t * h, z, t, c, s, 0, 0);
    }
  }

  for (const s0 of CAP_S) {
    const rr = 1 - s0;
    for (let i = 0; i < SEG_U; i++) {
      const th = (i / SEG_U) * Math.PI * 2;
      const u = Math.cos(th) * rr;
      const v = Math.sin(th) * rr;
      const y = h + capHeight(type, u, v, rr, lowerPM1);
      push(rimX[i] * rr, y, rimZ[i] * rr, y / h, u, v, 1, fissureFactor(type, u, v, rr));
    }
  }
  // Horní pól
  {
    const y = h + capHeight(type, 0, 0, 0, lowerPM1);
    push(0, y, 0, y / h, 0, 0, 1, fissureFactor(type, 0, 0, 0));
  }

  const rings = wallT.length + CAP_S.length;
  const indices = [];
  // spodní vějíř
  for (let i = 0; i < SEG_U; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % SEG_U);
    indices.push(0, b, a);
  }
  for (let r = 0; r < rings - 1; r++) {
    const base0 = 1 + r * SEG_U;
    const base1 = 1 + (r + 1) * SEG_U;
    for (let i = 0; i < SEG_U; i++) {
      const i1 = (i + 1) % SEG_U;
      const a = base0 + i;
      const b = base0 + i1;
      const c = base1 + i;
      const dd = base1 + i1;
      indices.push(a, b, c, b, dd, c);
    }
  }
  const top = positions.length / 3 - 1;
  const lastRing = 1 + (rings - 1) * SEG_U;
  for (let i = 0; i < SEG_U; i++) {
    const a = lastRing + i;
    const b = lastRing + ((i + 1) % SEG_U);
    indices.push(a, b, top);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // ověř orientaci (normála na vestibulární ploše musí mířit +z)
  const nrm = geometry.attributes.normal;
  const probe = 1 + (ROOT_T.length + 8) * SEG_U + SEG_U / 4;
  if (nrm.getZ(probe) < 0) {
    const idx = geometry.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const tmp = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = tmp;
    }
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingSphere();
  let topY = -Infinity;
  for (let i = 1; i < positions.length; i += 3) topY = Math.max(topY, positions[i]);
  meta.topY = topY;
  meta.count = positions.length / 3;
  return { geometry, meta };
}
