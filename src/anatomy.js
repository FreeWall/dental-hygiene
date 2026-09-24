import * as THREE from 'three';

// Rozměry zubů v mm (přibližně dle Wheelera): w = meziodistálně, d = bukolinguálně,
// h = výška korunky (bez hrbolků), tilt = sklon korunky vestibulárně (rad).
export const TOOTH_SPECS = {
  upper: [
    { pos: 1, type: 'incisor', w: 8.5, d: 7.0, h: 10.2, tilt: 0.3 },
    { pos: 2, type: 'incisor', w: 6.6, d: 6.2, h: 8.8, tilt: 0.28 },
    { pos: 3, type: 'canine', w: 7.6, d: 8.0, h: 9.6, tilt: 0.16 },
    { pos: 4, type: 'premolar', w: 7.0, d: 9.0, h: 7.6, tilt: 0.06 },
    { pos: 5, type: 'premolar', w: 6.6, d: 9.0, h: 7.0, tilt: 0.04 },
    { pos: 6, type: 'molar', w: 10.2, d: 11.2, h: 6.2, tilt: 0.06 },
    { pos: 7, type: 'molar', w: 9.2, d: 11.0, h: 5.8, tilt: 0.08 },
  ],
  lower: [
    { pos: 1, type: 'incisor', w: 5.2, d: 6.0, h: 8.6, tilt: 0.2 },
    { pos: 2, type: 'incisor', w: 5.8, d: 6.4, h: 9.0, tilt: 0.18 },
    { pos: 3, type: 'canine', w: 7.0, d: 7.6, h: 10.0, tilt: 0.1 },
    { pos: 4, type: 'premolar', w: 7.0, d: 7.8, h: 7.6, tilt: -0.02 },
    { pos: 5, type: 'premolar', w: 7.1, d: 8.2, h: 7.2, tilt: -0.06 },
    { pos: 6, type: 'molar', w: 11.2, d: 10.4, h: 6.2, tilt: -0.1 },
    { pos: 7, type: 'molar', w: 10.5, d: 10.0, h: 5.8, tilt: -0.12 },
  ],
};

export const TOOTH_NAMES = {
  1: 'střední řezák',
  2: 'postranní řezák',
  3: 'špičák',
  4: 'první premolár',
  5: 'druhý premolár',
  6: 'první molár',
  7: 'druhý molár',
};

export const QUADRANT_NAMES = {
  1: 'horní pravý',
  2: 'horní levý',
  3: 'dolní levý',
  4: 'dolní pravý',
};

// Polovina zubního oblouku (x, z) od středu dozadu, pravá strana pacienta je -x.
const UPPER_ARCH = [[0, 27], [9, 25.3], [16, 21], [21, 14.5], [23.8, 7], [25.5, -1], [27, -10], [28, -20], [28.5, -32]];

/** Zubní oblouk parametrizovaný délkou oblouku sigma (0 = střední čára, + = levá strana pacienta). */
export class ArchPath {
  constructor(halfPts) {
    const full = [];
    for (let i = halfPts.length - 1; i >= 1; i--) full.push(new THREE.Vector3(-halfPts[i][0], 0, halfPts[i][1]));
    for (const [x, z] of halfPts) full.push(new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(full, false, 'centripetal');
    curve.arcLengthDivisions = 3000;
    this.N = 1600;
    this.pts = curve.getSpacedPoints(this.N);
    this.length = curve.getLength();
    this.half = this.length / 2;
  }

  at(sigma, out = {}) {
    const u = ((sigma + this.half) / this.length) * this.N;
    const i = Math.max(0, Math.min(this.N - 1, Math.floor(u)));
    const f = u - i;
    const a = this.pts[i];
    const b = this.pts[i + 1];
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    out.x = a.x + tx * f;
    out.z = a.z + tz * f;
    out.tx = tx / tl;
    out.tz = tz / tl;
    out.nx = -out.tz;
    out.nz = out.tx;
    return out;
  }
}

export function createArches() {
  return {
    upper: new ArchPath(UPPER_ARCH),
    lower: new ArchPath(UPPER_ARCH.map(([x, z]) => [x * 0.94, z * 0.92 - 0.2])),
  };
}

/** Rozmístí zuby podél oblouku. Vrací seznam seřazený podle sigma. */
export function layoutTeeth(jaw, missing = []) {
  const specs = TOOTH_SPECS[jaw];
  const out = [];
  for (const side of [-1, 1]) {
    let cum = 0.12;
    for (const s of specs) {
      const quadrant = jaw === 'upper' ? (side < 0 ? 1 : 2) : side > 0 ? 3 : 4;
      const fdi = quadrant * 10 + s.pos;
      const center = side * (cum + s.w / 2);
      cum += s.w + 0.22;
      out.push({
        ...s,
        jaw,
        side,
        quadrant,
        fdi,
        sigma: center,
        start: center - s.w / 2,
        end: center + s.w / 2,
        missing: missing.includes(fdi),
        tipY: s.pos <= 2 ? 1.2 : s.pos === 3 ? 0.7 : 0,
      });
    }
  }
  return out.sort((a, b) => a.sigma - b.sigma);
}

export function toothLabel(fdi) {
  const q = Math.floor(fdi / 10);
  const p = fdi % 10;
  return `${fdi} – ${QUADRANT_NAMES[q]} ${TOOTH_NAMES[p]}`;
}
