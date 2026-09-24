import * as THREE from 'three';

export const TOOLS = {
  probe: {
    id: 'probe',
    name: 'Sonda',
    short: 'Sonda',
    desc: 'Klepni na zub: číslo zubu a nález. Tmavé skvrny zkontroluj – kaz zapíšeš do karty.',
    radius: 1.2,
    tap: true,
  },
  disclose: {
    id: 'disclose',
    name: 'Indikátor plaku',
    short: 'Indikátor',
    desc: 'Pacient si vypláchne ústa roztokem: nový plak se obarví růžově, starý modrofialově.',
    action: true,
  },
  airflow: {
    id: 'airflow',
    name: 'Airflow',
    short: 'Airflow',
    desc: 'Proud vody, vzduchu a jemného prášku odstraní biofilm a pigmenty. Kámen neodstraní!',
    radius: 3.0,
    water: 0.085,
  },
  ultrasonic: {
    id: 'ultrasonic',
    name: 'Ultrazvuk',
    short: 'Ultrazvuk',
    desc: 'Kmitající hrot rozbíjí zubní kámen. Drž ho na kameni, ne na dásni a ne dlouho na čisté sklovině.',
    radius: 1.7,
    water: 0.065,
  },
  curette: {
    id: 'curette',
    name: 'Gracey kyreta',
    short: 'Kyreta',
    desc: 'Ruční nástroj na tmavý subgingivální kámen u okraje dásně. Funguje jen tahy – pohybuj prstem!',
    radius: 1.4,
  },
  polish: {
    id: 'polish',
    name: 'Leštění',
    short: 'Leštění',
    desc: 'Gumový kalíšek s pastou. Leští jen čisté plochy. Nezůstávej dlouho na jednom místě – pálí to.',
    radius: 2.4,
  },
  fluoride: {
    id: 'fluoride',
    name: 'Fluoridace',
    short: 'Fluorid',
    desc: 'Nanes fluoridový lak na všechny plochy. Až po vyčištění!',
    radius: 3.6,
  },
};

export const TOOL_ORDER = ['probe', 'disclose', 'airflow', 'ultrasonic', 'curette', 'polish', 'fluoride'];

const v = (x, y, z) => new THREE.Vector3(x, y, z);

function mats() {
  return {
    steel: new THREE.MeshStandardMaterial({ color: 0xd9dee4, metalness: 1, roughness: 0.22 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 1, roughness: 0.35 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 0, roughness: 0.35 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x3aa6d8, metalness: 0.1, roughness: 0.4 }),
    teal: new THREE.MeshStandardMaterial({ color: 0x2bb3a3, metalness: 0.1, roughness: 0.5 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x9fd3e8, metalness: 0, roughness: 0.7 }),
    paste: new THREE.MeshStandardMaterial({ color: 0xf6d8e6, metalness: 0, roughness: 0.8 }),
    purple: new THREE.MeshStandardMaterial({ color: 0x8e5ad6, metalness: 0, roughness: 0.5 }),
    varnish: new THREE.MeshStandardMaterial({ color: 0xf2d56b, metalness: 0, roughness: 0.2 }),
    black: new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.2, roughness: 0.5 }),
  };
}

function cyl(r1, r2, from, to, mat, seg = 20) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r2, r1, len, seg);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

function tube(points, r, mat, seg = 32) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 10), mat);
}

// Nástroje: hrot v počátku, lokální +Y = normála povrchu, rukojeť míří do +Z (a nahoru)
export function createToolModels() {
  const M = mats();
  const models = {};
  const handleDir = v(0, 0.5, 1).normalize();
  const along = (d) => handleDir.clone().multiplyScalar(d);

  {
    const g = new THREE.Group();
    g.add(tube([v(0, 0, 0), v(0, 1.2, 0.2), v(0, 3, 1), v(0, 5, 3)], 0.28, M.steel));
    const a = v(0, 5, 3);
    g.add(cyl(0.9, 1.6, a, a.clone().add(along(6)), M.steel));
    const b = a.clone().add(along(6));
    g.add(cyl(2.6, 2.8, b, b.clone().add(along(75)), M.darkSteel));
    for (let i = 0; i < 6; i++) {
      const p = b.clone().add(along(6 + i * 5));
      g.add(cyl(2.85, 2.85, p, p.clone().add(along(1.5)), M.steel));
    }
    // milimetrové značení
    for (const d of [1.2, 2.4, 3.6]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 12), M.black);
      ring.position.set(0, d, d > 2 ? (d - 2) * 0.35 : 0.05);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }
    models.probe = g;
  }
  {
    const g = new THREE.Group();
    g.add(tube([v(0, 0, 0), v(0, 0.8, -0.4), v(0, 2.6, -0.5), v(0, 5, 0.6), v(0, 7, 3)], 0.42, M.steel));
    const a = v(0, 7, 3);
    g.add(cyl(1.0, 2.2, a, a.clone().add(along(6)), M.steel));
    const b = a.clone().add(along(6));
    g.add(cyl(4.0, 4.3, b, b.clone().add(along(80)), M.white));
    const ring = cyl(4.35, 4.35, b.clone().add(along(3)), b.clone().add(along(6)), M.blue);
    g.add(ring);
    models.ultrasonic = g;
  }
  {
    const g = new THREE.Group();
    const blade = tube([v(0, 0, -0.9), v(0, -0.15, 0), v(0, 0.3, 0.8), v(0, 1.2, 1.2)], 0.45, M.steel, 16);
    blade.scale.set(0.45, 1, 1);
    g.add(blade);
    g.add(tube([v(0, 1.2, 1.2), v(0, 3.5, 0.8), v(0, 6, 1.6), v(0, 8, 4)], 0.35, M.steel));
    const a = v(0, 8, 4);
    g.add(cyl(0.6, 2.4, a, a.clone().add(along(9)), M.steel));
    const b = a.clone().add(along(9));
    g.add(cyl(3.0, 3.0, b, b.clone().add(along(75)), M.darkSteel));
    for (let i = 0; i < 8; i++) {
      const p = b.clone().add(along(3 + i * 4.4));
      g.add(cyl(3.1, 3.1, p, p.clone().add(along(1.6)), M.steel));
    }
    models.curette = g;
  }
  {
    const g = new THREE.Group();
    g.add(cyl(0.6, 0.9, v(0, 5, 0), v(0, 9, 1.5), M.steel));
    const a = v(0, 9, 1.5);
    g.add(cyl(1.6, 3.2, a, a.clone().add(along(8)), M.white));
    const b = a.clone().add(along(8));
    g.add(cyl(4.2, 4.5, b, b.clone().add(along(75)), M.white));
    g.add(cyl(4.55, 4.55, b.clone().add(along(2)), b.clone().add(along(5)), M.teal));
    models.airflow = g;
  }
  {
    const g = new THREE.Group();
    const cupPts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      cupPts.push(new THREE.Vector2(2.4 + 0.5 * Math.sin(t * Math.PI * 0.5), t * 3.2));
    }
    cupPts.push(new THREE.Vector2(1.4, 3.4));
    const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 24), M.rubber);
    cup.position.y = 0.2;
    g.add(cup);
    const paste = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 10), M.paste);
    paste.scale.set(1, 0.5, 1);
    paste.position.y = 0.6;
    g.add(paste);
    g.userData.spin = new THREE.Group();
    g.userData.spin.add(cup, paste);
    g.add(g.userData.spin);
    g.add(cyl(3.2, 3.2, v(0, 3.4, 0), v(0, 7, 0), M.steel));
    const a = v(0, 7, 0);
    g.add(cyl(2.6, 3.0, a, a.clone().add(along(10)), M.steel));
    const b = a.clone().add(along(10));
    g.add(cyl(3.6, 4.2, b, b.clone().add(along(75)), M.darkSteel));
    models.polish = g;
  }
  {
    const g = new THREE.Group();
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), M.varnish);
    tip.scale.set(1, 1.3, 1);
    tip.position.y = 0.8;
    g.add(tip);
    g.add(cyl(0.35, 0.45, v(0, 1.2, 0), v(0, 6, 2), M.purple));
    const a = v(0, 6, 2);
    g.add(cyl(0.55, 0.9, a, a.clone().add(along(75)), M.purple));
    models.fluoride = g;
  }
  for (const [id, m] of Object.entries(models)) {
    m.visible = false;
    m.scale.setScalar(0.62);
    m.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    m.userData.id = id;
  }
  return models;
}

/** Odsávačka – průhledná trubička v koutku, zobrazená při odsávání. */
export function createSuctionModel() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xe8f4ff,
    roughness: 0.15,
    metalness: 0,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x4aa3e0, roughness: 0.5 });
  const g = new THREE.Group();
  const pts = [v(0, 0, 0), v(2, 3, 6), v(6, 10, 14), v(14, 14, 30), v(26, 12, 60)];
  g.add(tube(pts, 2.2, mat, 40));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12), tipMat);
  tip.scale.set(1, 0.6, 1);
  g.add(tip);
  g.visible = false;
  return g;
}
