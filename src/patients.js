import { ss, clamp, mulberry32, makeNoise, pick } from './util.js';

const STAIN = {
  coffee: [0.45, 0.3, 0.16],
  tobacco: [0.32, 0.23, 0.1],
  tea: [0.42, 0.3, 0.14],
  mild: [0.6, 0.48, 0.3],
};

const anterior = (t) => t.pos <= 3;

export const PATIENTS = [
  {
    id: 'fantom',
    name: 'Fantom Franta',
    age: 'cvičná hlava',
    emoji: '🤖',
    bio: 'Fantom ze školní učebny. Nestěžuje si, nekouše a nikdy nezruší termín. Ideální na zahřátí – provede tě celým postupem.',
    tutorial: true,
    noPain: true,
    plaque: 0.75,
    stain: 0.45,
    stainColor: STAIN.mild,
    calc: 0.8,
    subCalc: 0.5,
    inflam: 0.1,
    bleed: 0,
    caries: 1,
    cariesTeeth: [36],
    sensitivity: 0,
    focus: (t) => (anterior(t) || t.fdi === 16 || t.fdi === 26 || t.fdi === 36 ? 1 : 0.06),
    parTime: 300,
    seed: 11,
    advice: {
      q: 'Fantom si doma nečistí nic. Co ale doporučíš běžnému dospělému pacientovi?',
      a: ['2× denně 2 minuty, pasta s 1450 ppm fluoridů, mezizubní pomůcky', '1× týdně důkladně tvrdým kartáčkem', 'Hlavně ústní voda, kartáček stačí občas'],
      why: 'Základ: 2× denně, fluoridová pasta 1450 ppm a každodenní čištění mezizubních prostor.',
    },
    intro: ['(Fantom mlčí. Je to fantom.)'],
    lines: ['…', '(fantomové ticho)', '*vrzne kloub*'],
  },
  {
    id: 'tereza',
    name: 'Tereza',
    age: '23 let, studentka',
    emoji: '👩‍🎓',
    bio: 'Káva na probuzení, čaj na učení, víno na zkouškové. Pigmenty všude, ale jinak se snaží.',
    plaque: 0.55,
    stain: 0.95,
    stainColor: STAIN.coffee,
    calc: 0.3,
    subCalc: 0.12,
    inflam: 0.25,
    bleed: 0.6,
    caries: 1,
    sensitivity: 0.3,
    focus: (t) => (t.pos <= 5 ? 1 : 0.5),
    parTime: 420,
    seed: 23,
    advice: {
      q: 'Co doporučíš Tereze kvůli pigmentům z kávy a čaje?',
      a: ['Po kávě vypláchnout vodou, čistit 2× denně a mezizubí kartáčky', 'Každý den bělicí pastu s vysokou abrazivitou', 'Čistit tvrdým kartáčkem hned po každé kávě silou'],
      why: 'Abrazivní pasty a tvrdé kartáčky poškozují sklovinu a dásně. Pomůže výplach, pravidelná hygiena a pravidelné odstranění pigmentů v ordinaci.',
    },
    intro: ['Piju jen tři kafe denně. Ráno, v poledne… a pak ještě pět odpoledne.', 'Bude to bolet?'],
    lines: ['Mhm.', 'Ghh ghhh? (Jak dlouho to ještě bude?)', 'Aaah…', 'Mhm mhm. (Jo, dobrý.)'],
  },
  {
    id: 'karel',
    name: 'Pan Karel',
    age: '47 let, kuřák',
    emoji: '🚬',
    bio: 'Kouří „jen ve stresu“. Ve stresu je pořád. Tmavé tabákové pigmenty a zubní kámen. Kuřáci méně krvácejí – nikotin maskuje zánět!',
    plaque: 0.65,
    stain: 1.35,
    stainColor: STAIN.tobacco,
    calc: 0.7,
    subCalc: 0.4,
    inflam: 0.3,
    bleed: 0.2,
    caries: 1,
    sensitivity: 0.2,
    focus: () => 1,
    parTime: 540,
    seed: 47,
    advice: {
      q: 'Co je pro pana Karla nejdůležitější doporučení?',
      a: ['Mezizubní kartáčky, pravidelné recally a podpora v odvykání kouření', 'Ústní voda místo čištění zubů', 'Tvrdý kartáček, ať jde tabákový pigment dolů'],
      why: 'Kouření je hlavní rizikový faktor parodontitidy. Hygienistka má pacienta motivovat k odvykání a naučit čistit mezizubí.',
    },
    intro: ['Kouřím jen když jsem ve stresu. A ve stresu jsem pořád.', 'Hlavně ať to nesmrdí jako minule.'],
    lines: ['Mhm.', 'Hhhrm.', 'Ghh gh ghh? (Můžu pak jít na cígo?)', 'Mhm, mhm.'],
  },
  {
    id: 'adam',
    name: 'Adam',
    age: '16 let',
    emoji: '🎮',
    bio: 'Tvrdí, že si čistí zuby každý den. Hodně plaku, zanícené krvácející dásně a pár kazů na odhalení sondou.',
    plaque: 1.0,
    stain: 0.25,
    stainColor: STAIN.mild,
    calc: 0.3,
    subCalc: 0.15,
    inflam: 0.85,
    bleed: 1.0,
    caries: 3,
    sensitivity: 0.2,
    focus: () => 1,
    parTime: 480,
    seed: 16,
    advice: {
      q: 'Adamovi krvácejí dásně. Co mu poradíš?',
      a: ['Čistit 2× denně 2 minuty Bassovou technikou a mezizubí – krvácení časem ustoupí', 'Když dásně krvácí, na pár dní čištění vynechat', 'Stačí žvýkačka po jídle'],
      why: 'Krvácení je známka zánětu z plaku. Léčbou je právě důkladné čištění – vynechání by zánět zhoršilo.',
    },
    intro: ['Čistím si zuby každý den! …Teda skoro každý týden.', 'Mamka říkala, že mi to tu vysvětlíte.'],
    lines: ['Mhm.', 'Ghhh? (Už?)', 'Uff.', 'Mhm mhm. (Dobrý no.)'],
  },
  {
    id: 'josef',
    name: 'Pan Josef',
    age: '71 let',
    emoji: '👴',
    bio: 'U zubaře byl naposledy, když jsme vyhráli hokej v Naganu. Masivní kámen, ustoupené dásně, citlivé krčky a chybějící zuby.',
    plaque: 0.8,
    stain: 0.6,
    stainColor: STAIN.tea,
    calc: 1.0,
    subCalc: 0.85,
    inflam: 0.5,
    bleed: 0.7,
    recession: 2.0,
    papilla: 1.4,
    missing: [36, 46, 17],
    caries: 2,
    rootCaries: true,
    sensitivity: 0.85,
    focus: () => 1,
    parTime: 660,
    seed: 71,
    advice: {
      q: 'Pan Josef má ustoupené dásně a citlivé krčky. Co doporučíš?',
      a: ['Měkký kartáček, pastu na citlivé zuby, mezizubní kartáčky a recall po 3 měsících', 'Tvrdý kartáček a horizontální drhnutí', 'Přijít zase, až něco bude bolet'],
      why: 'Obnažené krčky jsou citlivé a náchylné ke kazu kořene. Šetrná technika, fluoridy a častější recall jsou základ.',
    },
    intro: ['Naposledy jsem u zubaře byl, když jsme vyhráli v Naganu. Hašek chytal jak drak!', 'Tak s chutí do toho, paní doktorko.'],
    lines: ['Mhm.', 'Ghh ghh ghhh. (Za nás se to dělalo bez vody.)', 'Hmmm.', 'Ghhhh? (Už tam něco zbylo?)'],
  },
];

const RANDOM_NAMES = [
  ['Paní Jana', '👩'],
  ['Pan Petr', '👨'],
  ['Slečna Klára', '👱‍♀️'],
  ['Pan Tomáš', '🧔'],
  ['Paní Marie', '👵'],
  ['Pan Ondřej', '👨‍💼'],
  ['Slečna Nikola', '👩‍🦰'],
  ['Pan Vojta', '🧑‍🔧'],
];

export function randomPatient() {
  const seed = Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);
  const [name, emoji] = pick(rng, RANDOM_NAMES);
  const smoker = rng() < 0.25;
  const older = rng() < 0.35;
  const allTeeth = [17, 16, 15, 27, 26, 25, 37, 36, 35, 47, 46, 45];
  const missing = older ? allTeeth.filter(() => rng() < 0.12).slice(0, 3) : [];
  return {
    id: 'random',
    name,
    age: `${older ? 55 + Math.floor(rng() * 25) : 18 + Math.floor(rng() * 30)} let`,
    emoji,
    bio: 'Náhodný pacient z čekárny. Co skrývá v puse, uvidíš až po obarvení plaku.',
    plaque: 0.4 + rng() * 0.6,
    stain: smoker ? 0.9 : rng() * 0.8,
    stainColor: smoker ? STAIN.tobacco : pick(rng, [STAIN.coffee, STAIN.tea, STAIN.mild]),
    calc: 0.2 + rng() * (older ? 0.8 : 0.5),
    subCalc: rng() * (older ? 0.8 : 0.35),
    inflam: 0.15 + rng() * 0.7,
    bleed: smoker ? 0.2 : 0.4 + rng() * 0.6,
    recession: older ? 0.5 + rng() * 1.5 : 0,
    papilla: older ? 2.0 : 3.2,
    missing,
    caries: Math.floor(rng() * 3),
    rootCaries: older,
    sensitivity: older ? 0.5 + rng() * 0.4 : rng() * 0.4,
    focus: () => 1,
    parTime: 540,
    seed,
    intro: [
      pick(rng, [
        'Dobrý den. Hlavně mi prosím neříkejte, že mám používat mezizubní kartáčky.',
        'Já mám zuby zdravé, jen mě sem poslal zubař.',
        'Minule mi hygienistka říkala, že čistím moc zhurta. Tak teď nečistím vůbec.',
        'Můžete mi pak doporučit nějaký bělení?',
      ]),
    ],
    lines: ['Mhm.', 'Ghh ghhh? (Jak dlouho to ještě bude?)', 'Aaah…', 'Mhm mhm.'],
    advice: smoker
      ? PATIENTS[2].advice
      : older
        ? PATIENTS[4].advice
        : PATIENTS[1].advice,
  };
}

/** Rozmístí plak, pigmenty, kámen a kazy podle realistických predilekčních míst. */
export function generateDeposits(mouth, patient) {
  const rng = mulberry32((patient.seed ?? 1) * 7 + 3);
  const noise = makeNoise(rng);
  const off = [rng() * 100, rng() * 100, rng() * 100];

  const teeth = mouth.teeth;
  // výběr zubů s kazem
  const cariesSet = new Map();
  const candidates = patient.cariesTeeth
    ? teeth.filter((t) => patient.cariesTeeth.includes(t.fdi))
    : teeth.filter((t) => t.type === 'molar' || t.type === 'premolar' || patient.rootCaries);
  const nCaries = Math.min(patient.caries ?? 0, candidates.length);
  const pool = candidates.slice();
  for (let k = 0; k < nCaries; k++) {
    const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const occlusal = !(patient.rootCaries && rng() < 0.6) && (t.type === 'molar' || t.type === 'premolar');
    cariesSet.set(t, { occlusal, u: (rng() - 0.5) * 0.5, v: (rng() - 0.5) * 0.3, side: rng() < 0.5 ? 1 : -1, ang: rng() * Math.PI * 2 });
  }

  const pos = [];
  for (const tooth of teeth) {
    const { meta, n, dirt, care, weight, treated, elev } = tooth;
    const P = tooth.geometry.attributes.position;
    const focus = patient.focus ? patient.focus(tooth) : 1;
    const lowerAnt = tooth.jaw === 'lower' && tooth.pos <= 3;
    const upperMol = tooth.jaw === 'upper' && tooth.pos >= 6;
    const car = cariesSet.get(tooth);
    tooth.hasCaries = !!car;
    tooth.cariesFound = false;
    // střed kazu v lokálních souřadnicích
    let cc = null;
    if (car) {
      if (car.occlusal) {
        // nejbližší vrchol k fisuře
        let best = -1;
        let bd = 1e9;
        for (let i = 0; i < n; i++) {
          if (!meta.cap[i]) continue;
          const d = (meta.c[i] - car.u) ** 2 + (meta.s[i] - car.v) ** 2 - meta.fis[i] * 0.3;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        cc = [P.getX(best), P.getY(best), P.getZ(best)];
      } else {
        let best = -1;
        let bd = 1e9;
        for (let i = 0; i < n; i++) {
          const e = elev[i];
          if (meta.cap[i] || e < 0.2) continue;
          const d = Math.abs(e - 0.8) + Math.abs(meta.s[i] - 1) * 2 + Math.abs(meta.c[i] - 0.3 * car.side) * 0.5;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        cc = [P.getX(best), P.getY(best), P.getZ(best)];
      }
      tooth.cariesCenter = cc;
    }

    for (let i = 0; i < n; i++) {
      const x = P.getX(i);
      const y = P.getY(i);
      const z = P.getZ(i);
      const wx = x + tooth.sigma * 3 + off[0];
      const wy = y + off[1] + (tooth.jaw === 'upper' ? 50 : 0);
      const wz = z + off[2];
      const e = elev[i];
      const t = meta.t[i];
      const c = meta.c[i];
      const s = meta.s[i];
      const cap = meta.cap[i];
      const fis = meta.fis[i];
      const ip = cap ? 0 : Math.abs(c) ** 2;
      // přístupnost: kontaktní body mezi zuby jsou nedosažitelné
      const contact = cap ? 0 : ss(0.86, 0.98, Math.abs(c)) * ss(0.15, 0.35, t) * (1 - ss(0.85, 1.0, t));
      const acc = 1 - contact;
      const vis = ss(-0.25, 0.35, e);
      weight[i] = acc * vis;

      const cerv = Math.exp(-Math.max(e, 0) / 1.8);
      const cerv2 = Math.exp(-Math.max(e, 0) / 2.6);
      const bandSub = Math.exp(-((e - 0.35) ** 2) / 0.3);
      const tipClean = cap ? 1 - 0.8 * (1 - fis) * ss(0.3, 0.9, 1 - Math.hypot(c, s)) : 1 - 0.6 * ss(0.8, 1.0, t);
      const lingual = s < -0.2 ? 1 : 0;
      const buccal = s > 0.2 ? 1 : 0;

      const n1 = noise(wx * 0.35, wy * 0.35, wz * 0.35);
      const n2 = noise(wx * 0.8 + 11, wy * 0.8, wz * 0.8);
      const n3 = noise(wx * 1.6, wy * 1.6 + 5, wz * 1.6);

      const alive = e > -0.5 ? 1 : 0;
      // plak
      let pl = (0.2 + 0.8 * cerv + 0.55 * ip + 0.7 * fis) * tipClean;
      pl *= 0.35 + 1.1 * ss(0.25, 0.75, n1);
      pl = clamp(pl * (patient.plaque ?? 0.5) * 1.3 * focus) * alive * acc;
      pl = ss(0.12, 0.45, pl);
      // pigment: krčková třetina, aproximálně, linguálně u frontálních zubů, fisury
      const cervSt = Math.exp(-Math.max(e, 0) / 3.0);
      const ipSt = ss(0.55, 0.95, Math.abs(c)) * (cap ? 0 : 1);
      let st = 0.8 * cervSt + 1.1 * ipSt * (0.45 + 0.55 * cervSt) + (tooth.pos <= 3 ? 0.9 : 0.35) * lingual * (0.5 + 0.5 * cervSt) + 0.85 * fis;
      st *= 0.6 + 0.8 * n2;
      st = clamp(st * (patient.stain ?? 0.3) * focus) * alive * acc;
      st = ss(0.18, 0.6, st);
      // supragingivální kámen
      let reg = 0.22 * ip + 0.1;
      if (lowerAnt && lingual) reg = tooth.pos <= 2 ? 1.25 : 0.8;
      if (upperMol && buccal) reg = 0.85;
      let cs = reg * cerv2 * (0.3 + 1.2 * ss(0.3, 0.8, n3 * 0.6 + n1 * 0.4));
      cs = clamp(cs * (patient.calc ?? 0.3) * 1.4 * focus) * alive * acc * (e > -0.1 ? 1 : 0);
      cs = ss(0.3, 0.6, cs);
      // subgingivální kámen (tmavý pruh u okraje dásně)
      let cb = bandSub * (0.4 + 0.9 * ss(0.35, 0.75, n2 * 0.5 + n3 * 0.5)) * (0.55 + 0.6 * ip);
      cb = clamp(cb * (patient.subCalc ?? 0.1) * 1.5 * focus) * acc * (cap ? 0 : 1);
      cb = ss(0.3, 0.6, cb);

      let cr = 0;
      if (cc) {
        const d = Math.hypot(x - cc[0], y - cc[1], z - cc[2]);
        const rr = car.occlusal ? 1.3 : 1.6;
        cr = ss(rr, rr * 0.35, d) * (0.85 + 0.3 * n3);
      }

      const o = i * 4;
      dirt[o] = pl;
      dirt[o + 1] = st;
      dirt[o + 2] = cs;
      dirt[o + 3] = cb;
      care[o] = 0;
      care[o + 1] = 0;
      care[o + 2] = clamp(0.9 * cerv + 0.6 * ip + 0.5 * fis + (n2 - 0.5) * 0.6 - 0.35);
      care[o + 3] = clamp(cr);
      treated[i] = pl + st + cs + cb > 0.08 ? 1 : 0;
    }
    tooth.dirtAttr.needsUpdate = true;
    tooth.careAttr.needsUpdate = true;
    tooth.dirty = true;
    pos.push(tooth);
  }
  mouth.toothMat.userData.uniforms.uStain.value.set(...(patient.stainColor ?? STAIN.mild));
}

export function computeToothStats(tooth) {
  const { n, dirt, care, weight, treated } = tooth;
  let pl = 0;
  let st = 0;
  let calc = 0;
  let pol = 0;
  let polW = 0;
  let fl = 0;
  let w = 0;
  for (let i = 0; i < n; i++) {
    const wi = weight[i];
    if (wi <= 0.01) continue;
    const o = i * 4;
    pl += dirt[o] * wi;
    st += dirt[o + 1] * wi;
    calc += (dirt[o + 2] + dirt[o + 3]) * wi;
    if (treated[i]) {
      pol += care[o] * wi;
      polW += wi;
    }
    fl += care[o + 1] * wi;
    w += wi;
  }
  return { pl, st, calc, pol, polW, fl, w };
}
