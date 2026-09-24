import * as THREE from 'three';
import { HINGE } from './mouth.js';

// bod v souřadnicích dolní čelisti -> svět při daném otevření
export function lowerPoint(x, y, z, open) {
  const p = new THREE.Vector3(x, y, z);
  p.applyAxisAngle(new THREE.Vector3(1, 0, 0), open);
  return p;
}

function lp(x, y, z, open) {
  // dolní čelist je vnořená: pivot v HINGE, obsah posunut o -HINGE
  const rel = new THREE.Vector3(x, y, z).sub(HINGE);
  rel.applyAxisAngle(new THREE.Vector3(1, 0, 0), open);
  return rel.add(HINGE);
}

export const VIEWS = {
  front: {
    label: 'Zepředu',
    open: 0.3,
    get: () => ({ target: new THREE.Vector3(0, -9, 14), yaw: 0, pitch: 0.06, dist: 118 }),
  },
  right: {
    label: 'Vpravo',
    open: 0.3,
    get: () => ({ target: new THREE.Vector3(-14, -8, 2), yaw: -1.05, pitch: 0.05, dist: 100 }),
  },
  left: {
    label: 'Vlevo',
    open: 0.3,
    get: () => ({ target: new THREE.Vector3(14, -8, 2), yaw: 1.05, pitch: 0.05, dist: 100 }),
  },
  upper: {
    label: 'Horní',
    open: 0.62,
    hide: 'lower',
    get: () => ({ target: new THREE.Vector3(0, 2, 2), yaw: 0, pitch: -1.0, dist: 108 }),
  },
  lower: {
    label: 'Dolní',
    open: 0.62,
    hide: 'upper',
    get: () => ({ target: lp(0, -2, 2, 0.62), yaw: 0, pitch: 0.95, dist: 108 }),
  },
  palatal: {
    label: 'Patro',
    open: 0.62,
    hide: 'lower',
    get: () => ({ target: new THREE.Vector3(0, 5, 20), yaw: Math.PI, pitch: -0.75, dist: 48 }),
  },
  lingual: {
    label: 'Jazyk',
    open: 0.62,
    hide: 'upper',
    get: () => ({ target: lp(0, -5, 18, 0.62), yaw: Math.PI, pitch: 0.8, dist: 48 }),
  },
};

export const VIEW_ORDER = ['front', 'right', 'left', 'upper', 'lower', 'palatal', 'lingual'];
