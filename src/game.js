import * as THREE from 'three';
import { Mouth } from './mouth.js';
import { Face } from './face.js';
import { generateDeposits, computeToothStats } from './patients.js';
import { TOOLS, createToolModels, createSuctionModel } from './tools.js';
import { Particles } from './particles.js';
import { CameraRig } from './camera.js';
import { VIEWS } from './views.js';
import { toothLabel } from './anatomy.js';
import { clamp, pick } from './util.js';

const TOUCH_OFFSET = 64; // px – nástroj pracuje nad prstem
export const THRESH = { plaque: 0.9, stain: 0.9, calc: 0.92, polish: 0.8, fluor: 0.75 };

const PAIN_LINES = {
  gum: ['Au!', 'Auvajs, to je dáseň!', 'Aaau! Ghh!', 'Au au au!'],
  sens: ['Au, to studí!', 'Ssss! Krčky!', 'Áá, to je citlivý!'],
  heat: ['Au, pálí to!', 'Hhh, to hřeje!'],
  soft: ['Ghhh! (To je jazyk!)', 'Aghh! (Patro!)'],
  cough: ['Khh! Khhh! (Odsávejte!)', 'Khhkhh! Blbl!', 'Glglgl… khh!'],
  airtongue: ['Pfff! (To lechtá!)'],
};

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();

export class Game {
  constructor(stage, audio, ui) {
    this.stage = stage;
    this.audio = audio;
    this.ui = ui;
    this.rig = new CameraRig(stage.camera);
    this.raycaster = new THREE.Raycaster();
    this.particles = new Particles();
    stage.scene.add(this.particles.points);
    this.tools = createToolModels();
    for (const m of Object.values(this.tools)) stage.scene.add(m);
    this.suctionModel = createSuctionModel();
    this.mouth = null;
    this.running = false;
    this.paused = false;
    this.tool = 'probe';
    this.pointers = new Map();
    this.mode = null;
    this.hover = null;
    this.lastTap = 0;
    this.suction = false;
    this.idleSpin = 0;
    this.bindInput(stage.renderer.domElement);
  }

  // ---------- Nastavení pacienta ----------
  load(patient) {
    if (this.mouth) {
      this.mouth.lower.remove(this.suctionModel);
      this.stage.scene.remove(this.mouth.root);
      this.mouth.dispose();
      this.face.dispose();
    }
    this.patient = patient;
    this.mouth = new Mouth(patient);
    generateDeposits(this.mouth, patient);
    this.stage.scene.add(this.mouth.root);
    this.face = new Face(this.mouth);
    this.mouth.root.add(this.face.mesh);
    this.mouth.lower.add(this.suctionModel);
    this.suctionModel.position.set(21, this.mouth.floorDepth + 7, -2);
    this.suctionModel.rotation.set(0, 0.3, 0);
    for (const t of this.mouth.teeth) t.stats = computeToothStats(t);
    this.initial = this.totals();
    this.state = {
      time: 0,
      comfort: 100,
      comfortInt: 0,
      water: 0,
      disclosed: false,
      disclose: 0,
      cleanedBeforeDisclose: 0,
      fluorEarly: 0,
      lastPain: -10,
      painLine: -10,
      mumble: 6 + Math.random() * 6,
      dwell: 0,
      sens: 0,
      enamelAbuse: 0,
      reveal: 0,
      done: {},
      hints: new Set(),
      tutorialStep: 0,
      toolTime: {},
      cariesFound: 0,
      cariesTotal: this.mouth.teeth.filter((t) => t.hasCaries).length,
      statsTimer: 0,
      failed: false,
      finished: false,
    };
    this.progress = this.computeProgress();
    this.setView('front', true);
  }

  start() {
    this.running = true;
    this.paused = false;
    this.setView('front', true);
    this.selectTool(this.patient.tutorial ? 'disclose' : 'probe');
    this.ui.onStart(this);
    const intro = this.patient.intro ?? [];
    intro.forEach((line, i) => setTimeout(() => this.running && this.say(line), 600 + i * 3200));
    if (this.patient.tutorial) this.tutorial(true);
    else this.hint('controls', 'Táhni mimo zuby = otáčení · dva prsty = zoom a posun · dvojklep = přiblížit', 5000);
  }

  stop() {
    this.running = false;
    this.mode = null;
    this.pointers.clear();
    this.audio.stopLoops();
    this.hideTools();
    this.suctionModel.visible = false;
  }

  menuView() {
    this.setView('front');
    this.mouth.openTarget = 0.26;
    this.rig.goal.dist = 140;
  }

  // ---------- Pohledy ----------
  setView(name, instant = false) {
    const v = VIEWS[name];
    this.view = name;
    this.mouth.openTarget = v.open;
    this.mouth.hide = v.hide ?? null;
    if (instant) this.mouth.update(0);
    this.rig.set(v.get(this.mouth), instant);
    this.ui?.setActiveView?.(name);
  }

  focusTooth(fdi) {
    const t = this.mouth.teeth.find((x) => x.fdi === fdi);
    if (!t) return;
    const open = 0.4;
    this.mouth.openTarget = open;
    this.mouth.hide = null;
    // spočti polohu při cílovém otevření
    const saved = this.mouth.open;
    this.mouth.open = open;
    this.mouth.update(0);
    const p = t.mesh.localToWorld(new THREE.Vector3(0, t.h * 0.55, 0));
    const dir = new THREE.Vector3(0, 0, 1).transformDirection(t.mesh.matrixWorld);
    const occl = new THREE.Vector3(0, t.jaw === 'upper' ? -1 : 1, 0);
    dir.addScaledVector(occl, 0.35).normalize();
    this.mouth.open = saved;
    this.mouth.update(0);
    this.rig.set({ target: p, yaw: Math.atan2(dir.x, dir.z), pitch: Math.asin(clamp(dir.y, -1, 1)), dist: 42 });
    this.view = null;
    this.ui.setActiveView(null);
  }

  // ---------- Vstup ----------
  bindInput(el) {
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e));
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.hover = null;
    });
    el.addEventListener(
      'wheel',
      (e) => {
        if (!this.running) return;
        e.preventDefault();
        this.rig.zoom(Math.exp(e.deltaY * 0.0012));
      },
      { passive: false },
    );
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  effPoint(p) {
    return { x: p.x, y: p.y - (p.type === 'touch' ? TOUCH_OFFSET : 0) };
  }

  onDown(e) {
    this.audio.init();
    if (!this.running || this.paused) return;
    e.target.setPointerCapture?.(e.pointerId);
    const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now(), type: e.pointerType, button: e.button };
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      const now = performance.now();
      const eff = this.effPoint(p);
      const hit = this.pick(eff.x, eff.y);
      // dvojklep = přiblížit
      if (now - this.lastTap < 300 && hit && Math.hypot(p.x - this.lastTapPos.x, p.y - this.lastTapPos.y) < 40) {
        this.rig.focus(hit.point, Math.min(this.rig.goal.dist, 45));
        this.lastTap = 0;
        this.mode = 'none';
        return;
      }
      this.lastTap = now;
      this.lastTapPos = { x: p.x, y: p.y };
      const T = TOOLS[this.tool];
      if (e.button === 2) this.mode = 'pan';
      else if (hit && !T.action && !T.tap) {
        this.mode = 'tool';
        this.prevHitPoint = null;
      } else if (hit && T.tap) this.mode = 'probe';
      else this.mode = 'orbit';
    } else if (this.pointers.size === 2) {
      this.mode = 'pinch';
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
  }

  onMove(e) {
    if (!this.running || this.paused) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') this.hover = { x: e.clientX, y: e.clientY, type: 'mouse' };
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (e.pointerType === 'mouse') this.hover = { x: e.clientX, y: e.clientY, type: 'mouse' };
    if (this.mode === 'orbit') this.rig.rotate(dx, dy);
    else if (this.mode === 'pan') this.rig.pan(dx, dy, this.stage.height);
    else if (this.mode === 'probe' && Math.hypot(p.x - p.sx, p.y - p.sy) > 12) this.mode = 'orbit';
    else if (this.mode === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (this.pinch.d > 0 && d > 0) this.rig.zoom(this.pinch.d / d);
      this.rig.pan(mx - this.pinch.mx, my - this.pinch.my, this.stage.height);
      this.pinch = { d, mx, my };
    }
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.mode === 'probe' && performance.now() - p.t0 < 500) {
      const eff = this.effPoint(p);
      this.probeTap(eff.x, eff.y);
    }
    if (this.pointers.size === 1 && this.mode === 'pinch') {
      this.mode = 'orbit';
    } else if (this.pointers.size === 0) {
      this.mode = null;
      this.prevHitPoint = null;
    }
  }

  pick(x, y) {
    const ndc = new THREE.Vector2((x / this.stage.width) * 2 - 1, -(y / this.stage.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    const m = this.mouth;
    const list = [];
    if (m.upper.visible) list.push(...m.teeth.filter((t) => t.jaw === 'upper').map((t) => t.mesh), m.gums.upper.mesh, m.palate);
    if (m.lowerPivot.visible) list.push(...m.teeth.filter((t) => t.jaw === 'lower').map((t) => t.mesh), m.gums.lower.mesh, m.tongue);
    const face = this.face;
    if (face.mesh.visible && face.opacity > 0.5) list.push(face.mesh);
    const hits = this.raycaster.intersectObjects(list, false);
    if (!hits.length) return null;
    const h = hits[0];
    if (h.object === face.mesh) return null;
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    if (n.dot(this.raycaster.ray.direction) > 0) n.negate();
    const res = { point: h.point, normal: n, object: h.object, face: h.face };
    if (h.object.userData.tooth) {
      res.kind = 'tooth';
      res.tooth = h.object.userData.tooth;
    } else if (h.object.userData.gum) {
      res.kind = 'gum';
      res.gum = h.object.userData.gum;
      const info = res.gum.info;
      res.md = (info[h.face.a * 3] + info[h.face.b * 3] + info[h.face.c * 3]) / 3;
      res.toothIndex = res.gum.toothIdx[h.face.a];
    } else res.kind = 'soft';
    return res;
  }

  // ---------- Nástroje ----------
  selectTool(id) {
    const T = TOOLS[id];
    if (!T) return;
    this.audio.click();
    if (T.action) {
      if (id === 'disclose') this.disclose();
      return;
    }
    this.tool = id;
    this.ui.setActiveTool(id);
    this.ui.toolHint(T.desc);
  }

  disclose() {
    const s = this.state;
    if (s.disclosed) {
      this.toast('Plak už je obarvený.', 'warn');
      return;
    }
    s.disclosed = true;
    s.discloseAt = s.time;
    this.audio.gargle();
    this.say(this.patient.noPain ? '(Fantom se nechá obarvit.)' : 'Glglgl… *plivne*');
    this.toast('Plak obarven: 🌸 nový růžově, 🟣 starý modrofialově.', 'good');
    this.markDone('disclose');
    this.ui.setToolDone('disclose', true);
  }

  hideTools() {
    for (const m of Object.values(this.tools)) m.visible = false;
    this.ui.crosshair(null);
  }

  placeTool(hit, dt) {
    const model = this.tools[this.tool];
    for (const [id, m] of Object.entries(this.tools)) if (id !== this.tool) m.visible = false;
    if (!model) return;
    if (!hit) {
      model.visible = false;
      return;
    }
    const cam = this.stage.camera;
    const right = tmpV.setFromMatrixColumn(cam.matrixWorld, 0);
    const up = tmpV2.setFromMatrixColumn(cam.matrixWorld, 1);
    const toCam = new THREE.Vector3().subVectors(cam.position, hit.point).normalize();
    const hd = new THREE.Vector3().addScaledVector(right, 0.6).addScaledVector(up, -0.55).addScaledVector(toCam, 0.4).normalize();
    // při přiblížení nástroj zmenšit, aby nezakrýval pracovní pole
    const camDist = cam.position.distanceTo(hit.point);
    model.scale.setScalar(0.62 * clamp(camDist / 105, 0.42, 1));
    const Y = hit.normal.clone();
    if (this.tool === 'airflow' || this.tool === 'fluoride' || this.tool === 'polish') {
      Y.lerp(toCam, 0.35).normalize();
    }
    const Z = hd.addScaledVector(Y, -hd.dot(Y)).normalize();
    const X = new THREE.Vector3().crossVectors(Y, Z);
    tmpM.makeBasis(X, Y, Z);
    tmpQ.setFromRotationMatrix(tmpM);
    if (!model.visible) model.quaternion.copy(tmpQ);
    else model.quaternion.slerp(tmpQ, 1 - Math.exp(-dt * 18));
    model.position.copy(hit.point).addScaledVector(hit.normal, 0.08);
    if (this.tool === 'ultrasonic' && this.mode === 'tool') {
      model.position.x += (Math.random() - 0.5) * 0.08;
      model.position.y += (Math.random() - 0.5) * 0.08;
    }
    if (model.userData.spin && this.mode === 'tool') model.userData.spin.rotation.y += dt * 45;
    model.visible = true;
  }

  applyTool(hit, dt) {
    const id = this.tool;
    const T = TOOLS[id];
    const s = this.state;
    const r = T.radius;
    const r2 = r * r;
    const p = hit.point;
    let move = 0;
    if (this.prevHitPoint) move = Math.min(4, this.prevHitPoint.distanceTo(p));
    this.prevHitPoint = p.clone();
    s.toolTime[id] = (s.toolTime[id] ?? 0) + dt;

    let removedCalc = 0;
    let removedSoft = 0;
    let onClean = 0;
    let sensitive = 0;
    let dirtyFl = 0;
    let dirtyPol = 0;
    const inv = new THREE.Matrix4();
    const lp = new THREE.Vector3();
    const ln = new THREE.Vector3();
    for (const tooth of this.mouth.teeth) {
      if (tooth.jaw === 'lower' ? !this.mouth.lowerPivot.visible : !this.mouth.upper.visible) continue;
      tmpV.setFromMatrixPosition(tooth.mesh.matrixWorld);
      if (tmpV.distanceTo(p) > tooth.boundRadius + r + 0.5) continue;
      inv.copy(tooth.mesh.matrixWorld).invert();
      lp.copy(p).applyMatrix4(inv);
      ln.copy(hit.normal).transformDirection(inv);
      const P = tooth.geometry.attributes.position.array;
      const N = tooth.geometry.attributes.normal.array;
      const { dirt, care, elev } = tooth;
      let touched = false;
      for (let i = 0; i < tooth.n; i++) {
        const dx = P[i * 3] - lp.x;
        const dy = P[i * 3 + 1] - lp.y;
        const dz = P[i * 3 + 2] - lp.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2) continue;
        const nd = N[i * 3] * ln.x + N[i * 3 + 1] * ln.y + N[i * 3 + 2] * ln.z;
        if (nd < -0.25) continue;
        let f = 1 - d2 / r2;
        f *= clamp((nd + 0.25) / 0.6);
        if (f <= 0) continue;
        touched = true;
        const o = i * 4;
        const k = f * dt;
        const pl0 = dirt[o];
        const st0 = dirt[o + 1];
        const cs0 = dirt[o + 2];
        const cb0 = dirt[o + 3];
        if (id === 'airflow') {
          dirt[o] = Math.max(0, pl0 - 3.4 * k);
          dirt[o + 1] = Math.max(0, st0 - 2.2 * k);
          if (cs0 + cb0 < 0.02 && pl0 < 0.05) onClean += k * 0.2;
        } else if (id === 'ultrasonic') {
          dirt[o + 2] = Math.max(0, cs0 - 2.1 * k);
          dirt[o + 3] = Math.max(0, cb0 - 0.7 * k);
          dirt[o] = Math.max(0, pl0 - 0.9 * k);
          dirt[o + 1] = Math.max(0, st0 - 0.6 * k);
          if (cs0 + cb0 < 0.03) {
            onClean += k;
            if (elev[i] < 1.6) sensitive += k;
          }
        } else if (id === 'curette') {
          const m = f * move;
          dirt[o + 3] = Math.max(0, cb0 - 0.75 * m);
          dirt[o + 2] = Math.max(0, cs0 - 0.45 * m);
          dirt[o] = Math.max(0, pl0 - 0.4 * m);
          dirt[o + 1] = Math.max(0, st0 - 0.12 * m);
        } else if (id === 'polish') {
          const clean = pl0 < 0.12 && cs0 + cb0 < 0.05;
          care[o] = Math.min(1, care[o] + (clean ? 2.4 : 0.25) * k);
          dirt[o] = Math.max(0, pl0 - 0.9 * k);
          dirt[o + 1] = Math.max(0, st0 - 0.8 * k);
          if (!clean) dirtyPol += k;
        } else if (id === 'fluoride') {
          care[o + 1] = Math.min(1, care[o + 1] + 3.2 * k);
          if (pl0 > 0.25 || cs0 + cb0 > 0.12) dirtyFl += k;
        }
        removedCalc += cs0 - dirt[o + 2] + (cb0 - dirt[o + 3]);
        removedSoft += pl0 - dirt[o] + (st0 - dirt[o + 1]);
      }
      if (touched) {
        tooth.dirty = true;
        tooth.dirtAttr.needsUpdate = true;
        tooth.careAttr.needsUpdate = true;
      }
    }

    // dáseň, jazyk, patro
    const noPain = this.patient.noPain;
    if (hit.kind === 'gum') {
      const md = hit.md;
      const harsh = id === 'ultrasonic' || id === 'curette' || id === 'polish';
      if (harsh && md > 2.6) this.pain(id === 'polish' ? 14 * dt : 30 * dt, 'gum');
      else if (id === 'ultrasonic' && md > 0.8) this.pain(10 * dt * (0.5 + this.patient.inflam), 'gum');
      if (id === 'airflow' && md > 6) this.pain(4 * dt, 'gum');
      if ((id === 'curette' || id === 'ultrasonic') && md < 3) {
        const amt = (this.patient.bleed ?? 0.5) * (this.patient.inflam ?? 0.3) * (id === 'curette' ? 1.4 : 0.9);
        this.bleed(hit, 2.2, amt * dt * 1.6);
      }
    } else if (hit.kind === 'soft') {
      if (id === 'ultrasonic' || id === 'polish' || id === 'curette') this.pain(22 * dt, 'soft');
      if (id === 'airflow') this.say(pick(Math.random, PAIN_LINES.airtongue), false, 4);
    }

    if (!s.disclosed && removedSoft + removedCalc > 0) s.cleanedBeforeDisclose += removedSoft + removedCalc;

    // citlivost, sklovina, teplo
    if (id === 'ultrasonic') {
      s.sens = s.sens * Math.exp(-dt * 2) + sensitive;
      if (s.sens > 0.25 && this.patient.sensitivity > 0) this.pain(12 * dt * this.patient.sensitivity, 'sens');
      if (onClean > 0.02) s.enamelAbuse += onClean;
      if (s.enamelAbuse > 3) this.hint('enamel', 'Tady už kámen není – ultrazvukem po čisté sklovině zbytečně nejezdi.', 3500);
    }
    if (id === 'polish') {
      const speed = move / Math.max(dt, 1e-3);
      if (speed < 2) s.dwell += dt;
      else s.dwell = Math.max(0, s.dwell - dt * 2);
      if (s.dwell > 1.4) this.pain(16 * dt, 'heat');
      if (dirtyPol > 0.2) this.hint('polishDirty', 'Leštit má smysl až na čistých plochách – nejdřív odstraň plak a kámen.', 3500);
    }
    if (id === 'fluoride' && dirtyFl > 0.05) {
      s.fluorEarly += dirtyFl;
      this.hint('fluorDirty', 'Fluorid nanášej až na vyčištěné zuby!', 3500);
    }
    if (id === 'curette' && move < 0.05) {
      s.curStill = (s.curStill ?? 0) + dt;
      if (s.curStill > 1.2) this.hint('curetteMove', 'Kyreta pracuje tahem – pohybuj prstem krátkými tahy od dásně ke koruně.', 3500);
    } else s.curStill = 0;
    if (id === 'airflow' && removedCalc === 0 && this.progress.calc < 0.5 && (s.toolTime.airflow ?? 0) > 8)
      this.hint('airflowCalc', 'Airflow odstraní biofilm a pigmenty, ale zubní kámen ne – na ten je ultrazvuk.', 4000);

    // voda
    if (T.water) {
      s.water += T.water * dt * (noPain ? 0.7 : 1);
    }

    // efekty
    this.effects(id, hit, dt, removedCalc, removedSoft);
    if (removedCalc > 0.02 && Math.random() < 0.5) {
      this.audio.crunch();
      navigator.vibrate?.(6);
    }
  }

  bleed(hit, radius, amount) {
    if (amount <= 0) return;
    const gum = hit.gum;
    const inv = new THREE.Matrix4().copy(gum.mesh.matrixWorld).invert();
    const lp = hit.point.clone().applyMatrix4(inv);
    const P = gum.geometry.attributes.position.array;
    const B = gum.blood;
    const r2 = radius * radius;
    let any = false;
    for (let i = 0; i < B.length; i++) {
      const dx = P[i * 3] - lp.x;
      if (dx > radius || dx < -radius) continue;
      const dy = P[i * 3 + 1] - lp.y;
      const dz = P[i * 3 + 2] - lp.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      if (gum.info[i * 3] > 3) continue;
      B[i] = Math.min(1, B[i] + amount * (1 - d2 / r2) * 3);
      any = true;
    }
    if (any) {
      gum.bloodAttr.needsUpdate = true;
      gum.bleeding = true;
      if (amount > 0.004) this.hint('blood', 'Dáseň krvácí – zánět gingivy. Krvácení při ošetření je u zánětu normální.', 3500);
    }
  }

  effects(id, hit, dt, removedCalc) {
    const P = this.particles;
    const n = hit.normal;
    const p = hit.point;
    const rnd = () => Math.random() - 0.5;
    const v = new THREE.Vector3();
    const pos = new THREE.Vector3();
    if (id === 'ultrasonic') {
      for (let i = 0; i < 4; i++) {
        v.copy(n).multiplyScalar(18 + Math.random() * 20).add(tmpV.set(rnd() * 30, rnd() * 30 + 8, rnd() * 30));
        P.emit(pos.copy(p).addScaledVector(n, 0.6), v, [0.82, 0.9, 0.97], 0.45 + Math.random() * 0.4, 0.5 + Math.random() * 0.4, -120, 0.7);
      }
    } else if (id === 'airflow') {
      for (let i = 0; i < 6; i++) {
        pos.copy(p).addScaledVector(n, 5);
        v.copy(n).multiplyScalar(-40).add(tmpV.set(rnd() * 12, rnd() * 12, rnd() * 12));
        P.emit(pos, v, [0.97, 0.97, 0.98], 0.5 + Math.random() * 0.5, 0.18, 0, 0.55);
        v.copy(n).multiplyScalar(22).add(tmpV.set(rnd() * 45, rnd() * 45, rnd() * 45));
        P.emit(pos.copy(p).addScaledVector(n, 0.5), v, [0.9, 0.93, 0.97], 0.7 + Math.random() * 0.8, 0.5, -40, 0.35);
      }
    } else if (id === 'polish' && Math.random() < 0.3) {
      v.copy(n).multiplyScalar(15).add(tmpV.set(rnd() * 30, rnd() * 30, rnd() * 30));
      P.emit(pos.copy(p).addScaledVector(n, 0.8), v, [0.97, 0.85, 0.9], 0.6, 0.5, -120, 0.9);
    }
    const chips = Math.min(5, Math.floor(removedCalc * 40 + Math.random()));
    for (let i = 0; i < chips; i++) {
      v.copy(n).multiplyScalar(20 + Math.random() * 25).add(tmpV.set(rnd() * 35, rnd() * 35 + 10, rnd() * 35));
      const c = Math.random() < 0.3 ? [0.35, 0.28, 0.18] : [0.86, 0.78, 0.58];
      P.emit(pos.copy(p).addScaledVector(n, 0.4), v, c, 0.5 + Math.random() * 0.5, 0.6 + Math.random() * 0.3, -200, 1);
    }
  }

  probeTap(x, y) {
    const hit = this.pick(x, y);
    if (!hit) return;
    let tooth = hit.tooth;
    if (!tooth && hit.kind === 'gum' && hit.toothIndex >= 0) tooth = this.mouth.teeth[hit.toothIndex];
    if (!tooth) return;
    this.audio.click();
    // hledej kaz v okolí
    const inv = new THREE.Matrix4().copy(tooth.mesh.matrixWorld).invert();
    const lp = hit.point.clone().applyMatrix4(inv);
    const P = tooth.geometry.attributes.position.array;
    let car = 0;
    let st = 0;
    for (let i = 0; i < tooth.n; i++) {
      const d2 = (P[i * 3] - lp.x) ** 2 + (P[i * 3 + 1] - lp.y) ** 2 + (P[i * 3 + 2] - lp.z) ** 2;
      if (d2 > 2.6 * 2.6) continue;
      car = Math.max(car, tooth.care[i * 4 + 3]);
      st = Math.max(st, tooth.dirt[i * 4 + 1]);
    }
    const stats = tooth.stats;
    const pct = (a) => Math.round(a * 100);
    const rem = this.toothRemaining(tooth);
    let msg = `<b>${toothLabel(tooth.fdi)}</b><br>`;
    msg += rem < 0.05 ? 'Čistý ✓' : `Zbývá nánosů: ${pct(rem)} %`;
    if (stats.polW > 0) msg += ` · lesk ${pct(stats.pol / stats.polW)} %`;
    this.ui.toothLabel(msg);
    if (car > 0.3 && tooth.hasCaries) {
      if (!tooth.cariesFound) {
        tooth.cariesFound = true;
        this.state.cariesFound++;
        this.audio.found();
        this.toast(`🦷 Kaz zapsán do karty: zub ${tooth.fdi}. Pacient se objedná k zubaři.`, 'good');
        if (this.state.cariesFound === this.state.cariesTotal) this.markDone('caries');
      } else this.toast(`Kaz na ${tooth.fdi} už je v kartě zapsaný.`);
    } else if (st > 0.3) {
      this.toast('Sonda neuvázne – je to jen pigment, žádný kaz. Na ten je Airflow.');
    }
  }

  toothRemaining(t) {
    const s = t.stats;
    const s0 = t.stats0 ?? s;
    const tot0 = s0.pl + s0.st + s0.calc;
    if (tot0 < 1e-3) return 0;
    return clamp((s.pl + s.st + s.calc) / tot0);
  }

  // ---------- Pacient ----------
  pain(amount, kind) {
    const s = this.state;
    if (this.patient.noPain || amount <= 0) return;
    s.comfort = Math.max(0, s.comfort - amount);
    s.lastPain = s.time;
    if (s.time - s.painLine > 2.2) {
      s.painLine = s.time;
      this.say(pick(Math.random, PAIN_LINES[kind] ?? PAIN_LINES.gum), true);
      this.audio.ouch();
      navigator.vibrate?.(35);
      this.mouth.flinch = 1;
      this.rig.shake = 0.6;
      this.ui.hurt();
      if (kind === 'gum') this.hint('gumPain', 'Pozor na dáseň! Pracuj na zubu a u okraje dásně, ne na sliznici.', 3500);
      if (kind === 'sens') this.hint('sensPain', 'Obnažené krčky jsou citlivé. Na čistém krčku ultrazvuk nedrž.', 3500);
      if (kind === 'heat') this.hint('heatPain', 'Kalíšek na jednom místě zub přehřívá – pohybuj s ním.', 3500);
    }
  }

  say(text, pain = false, cooldown = 0) {
    if (cooldown && this.state.time - (this.state.lastSay ?? -99) < cooldown) return;
    this.state.lastSay = this.state.time;
    this.ui.bubble(text, pain);
  }

  toast(text, kind = '') {
    this.ui.toast(text, kind);
  }

  hint(key, text, ms = 3500) {
    if (this.state.hints.has(key)) return;
    this.state.hints.add(key);
    this.toast('💡 ' + text, 'warn');
    if (ms) this.ui.toastDuration(ms);
  }

  markDone(key) {
    if (this.state.done[key]) return;
    this.state.done[key] = true;
    const labels = {
      plaque: 'Plak odstraněn',
      stain: 'Pigmenty odstraněny',
      calc: 'Zubní kámen odstraněn',
      polish: 'Vyleštěno',
      fluor: 'Fluoridace hotová',
      caries: 'Všechny kazy zapsány',
    };
    if (labels[key]) {
      if (!this.patient.noPain) setTimeout(() => this.running && this.say(pick(Math.random, ['Mhm! (To je lepší!)', 'Mmm! (Jazykem cítím hladký zuby!)', 'Mhm mhm! (Díky!)'])), 900);
      this.audio.chime();
      this.toast(`✓ ${labels[key]}!`, 'good');
      navigator.vibrate?.([20, 40, 20]);
    }
    const toolFor = { plaque: 'airflow', calc: 'ultrasonic', polish: 'polish', fluor: 'fluoride', caries: 'probe' };
    if (toolFor[key]) this.ui.setToolDone(toolFor[key], true);
    if (key === 'calc') this.ui.setToolDone('curette', true);
  }

  // ---------- Statistiky ----------
  totals() {
    const t = { pl: 0, st: 0, calc: 0, pol: 0, polW: 0, fl: 0, w: 0 };
    for (const tooth of this.mouth.teeth) {
      if (!tooth.stats0) tooth.stats0 = tooth.stats;
      for (const k of Object.keys(t)) t[k] += tooth.stats[k];
    }
    return t;
  }

  computeProgress() {
    const t = this.totals();
    const i = this.initial;
    const done = (a, b) => (b < 1e-3 ? 1 : clamp(1 - a / b));
    return {
      plaque: done(t.pl, i.pl),
      stain: done(t.st, i.st),
      calc: done(t.calc, i.calc),
      polish: t.polW > 0 ? clamp(t.pol / t.polW) : 1,
      fluor: t.w > 0 ? clamp(t.fl / t.w) : 0,
      dirt: (t.pl + t.st + t.calc) / Math.max(1e-3, i.pl + i.st + i.calc),
    };
  }

  // ---------- Hlavní smyčka ----------
  update(dt) {
    if (!this.mouth) return;
    const s = this.state;
    // na výšku je vidět méně do šířky – oddálit kameru
    const aspect = this.stage.width / this.stage.height;
    this.rig.aspectFactor = Math.max(0.82, Math.pow(1.78 / aspect, 0.8));
    if (!this.running) {
      // pozadí menu – pomalé otáčení
      this.idleSpin += dt;
      this.rig.goal.yaw = Math.sin(this.idleSpin * 0.25) * 0.28;
      this.mouth.update(dt);
      this.rig.update(dt);
      this.face.update(dt, this.mouth.open, this.stage.camera);
      this.stage.updateLights(this.rig.target);
      this.particles.update(dt);
      return;
    }
    if (this.paused) return;
    s.time += dt;
    this.mouth.update(dt);
    this.rig.update(dt);
    this.face.update(dt, this.mouth.open, this.stage.camera);
    this.stage.updateLights(this.rig.target);

    // nástroj
    let hit = null;
    let active = false;
    const T = TOOLS[this.tool];
    if (this.mode === 'tool' && this.pointers.size === 1) {
      const p = [...this.pointers.values()][0];
      const eff = this.effPoint(p);
      hit = this.pick(eff.x, eff.y);
      this.ui.crosshair(p.type === 'touch' ? eff : null);
      if (hit) {
        active = true;
        this.applyTool(hit, dt);
      } else this.prevHitPoint = null;
    } else {
      this.ui.crosshair(null);
      if (this.hover && !this.pointers.size && !T.action) hit = this.pick(this.hover.x, this.hover.y);
    }
    this.placeTool(hit, dt);

    // zvuky nástrojů
    const lv = (id) => (active && this.tool === id ? 1 : 0);
    this.audio.loop('ultrasonic', lv('ultrasonic') * 0.8);
    this.audio.loop('airflow', lv('airflow') * 0.7);
    this.audio.loop('polish', lv('polish'));
    this.audio.loop('curette', active && this.tool === 'curette' && this.prevHitPoint ? 0.25 : 0);
    this.audio.loop('fluoride', lv('fluoride') * 0.5);
    this.audio.loop('suction', this.suction ? 0.7 : this.ui.assist && s.water > 0.04 ? 0.25 : 0);
    if (active && this.tool === 'ultrasonic' && Math.random() < dt * 8) navigator.vibrate?.(10);

    // odsávání a voda
    const assist = this.ui.assist && !this.suction && s.water > 0.04;
    if (assist) s.water = Math.max(0, s.water - 0.1 * dt);
    this.suctionModel.visible = (this.suction || assist) && this.mouth.lowerPivot.visible;
    if (this.suction) {
      s.water = Math.max(0, s.water - 0.55 * dt);
      for (const g of Object.values(this.mouth.gums)) {
        if (!g.bleeding) continue;
        let any = false;
        for (let i = 0; i < g.blood.length; i++) {
          if (g.blood[i] > 0) {
            g.blood[i] = Math.max(0, g.blood[i] - dt * 0.8);
            any = true;
          }
        }
        g.bloodAttr.needsUpdate = true;
        if (!any) g.bleeding = false;
      }
    }
    if (s.water >= 1) {
      s.water = 0.55;
      if (!this.patient.noPain) {
        this.pain(14, 'cough');
        this.audio.cough();
        this.rig.shake = 1.2;
      } else this.toast('Fantomovi teče voda z pusy na plášť. Odsávej!', 'warn');
      this.hint('suction', 'Drž tlačítko Odsát vlevo dole, když se hromadí voda.', 4000);
    }
    if (s.water > 0.65) this.hint('water', 'Hodně vody v puse! Drž odsávačku (vlevo dole).', 3500);
    this.mouth.setWater(s.water);
    const wet = clamp(s.water * 1.3 + (active && T.water ? 0.4 : 0));
    for (const m of [this.mouth.toothMat, this.mouth.gumMat, this.mouth.tongueMat, this.mouth.palateMat, this.mouth.floorMat])
      m.userData.uniforms.uWet.value = wet;

    // indikátor a kontrola
    s.disclose += ((s.disclosed ? 1 : 0) - s.disclose) * (1 - Math.exp(-dt * 2.5));
    this.mouth.toothMat.userData.uniforms.uDisclose.value = s.disclose;
    s.reveal = Math.max(0, s.reveal - dt);
    this.mouth.toothMat.userData.uniforms.uReveal.value = s.reveal > 0 ? (0.55 + 0.45 * Math.sin(s.time * 8)) * Math.min(1, s.reveal) : 0;

    // komfort
    if (s.time - s.lastPain > 2) s.comfort = Math.min(100, s.comfort + 3 * dt);
    s.comfortInt += s.comfort * dt;
    if (s.comfort <= 0 && !s.failed) {
      s.failed = true;
      this.say('Tak dost! Já jdu domů!', true);
      this.audio.wrong();
      setTimeout(() => this.ui.finish(this), 1500);
    }

    // zamumlání
    s.mumble -= dt;
    if (s.mumble <= 0) {
      s.mumble = 9 + Math.random() * 10;
      let line = pick(Math.random, this.patient.lines ?? ['Mhm.']);
      if (s.water > 0.55 && !this.patient.noPain) line = 'Uuugh… (Mám plnou pusu vody.)';
      if (s.comfort < 40 && !this.patient.noPain) line = 'Ghhhh… (Ještě dlouho?)';
      this.say(line);
    }

    // statistiky
    s.statsTimer -= dt;
    if (s.statsTimer <= 0) {
      s.statsTimer = 0.25;
      for (const t of this.mouth.teeth) {
        if (t.dirty) {
          t.stats = computeToothStats(t);
          t.dirty = false;
          const s0 = t.stats0;
          if (!t.celebrated && s0.pl + s0.st + s0.calc > 3 && this.toothRemaining(t) < 0.04) {
            t.celebrated = true;
            this.sparkle(t);
          }
        }
      }
      this.progress = this.computeProgress();
      const pr = this.progress;
      if (pr.plaque >= THRESH.plaque) this.markDone('plaque');
      if (pr.stain >= THRESH.stain) this.markDone('stain');
      if (pr.calc >= THRESH.calc) this.markDone('calc');
      if (pr.polish >= THRESH.polish && pr.dirt < 0.25) this.markDone('polish');
      if (pr.fluor >= THRESH.fluor) this.markDone('fluor');
      if (s.cariesTotal === 0) s.done.caries = true;
      if (this.patient.tutorial) this.tutorial();
      this.ui.updateHUD(this);
    }
    this.ui.updateFast(this);
    this.particles.update(dt);
  }

  sparkle(t) {
    const c = t.mesh.localToWorld(new THREE.Vector3(0, t.h * 0.6, 0));
    const n = new THREE.Vector3(0, 0, 1).transformDirection(t.mesh.matrixWorld);
    for (let i = 0; i < 26; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30).addScaledVector(n, 18);
      const gold = Math.random() < 0.4;
      this.particles.emit(c, v, gold ? [1, 0.88, 0.45] : [1, 1, 1], 0.6 + Math.random() * 0.8, 0.7 + Math.random() * 0.4, 0, 1);
    }
    this.audio.tone(1760 + Math.random() * 400, 0.18, 'sine', 0.06);
    this.state.cleanTeeth = (this.state.cleanTeeth ?? 0) + 1;
  }

  reveal() {
    this.state.reveal = 3.2;
    this.audio.select();
    const pr = this.progress;
    const left = [];
    if (pr.plaque < THRESH.plaque) left.push('plak');
    if (pr.stain < THRESH.stain) left.push('pigmenty');
    if (pr.calc < THRESH.calc) left.push('kámen');
    this.toast(left.length ? `Zbytky svítí oranžově: ${left.join(', ')}.` : 'Nánosy jsou pryč! 👌');
  }

  // ---------- Tutoriál (fantom) ----------
  tutorial(first = false) {
    const s = this.state;
    const pr = this.progress;
    const steps = [
      { done: () => s.disclosed, text: 'Vítej u fantomu! Začni obarvením plaku – klepni na 🟣 Indikátor.', tool: 'disclose' },
      { done: () => pr.plaque > 0.8, text: 'Plak je vidět. Vyber Airflow a táhni po zubech (i z boku a zevnitř – přepínej pohledy vpravo).', tool: 'airflow' },
      { done: () => pr.calc > 0.75, text: 'Teď zubní kámen: Ultrazvuk. Hledej ho linguálně na dolních řezácích (pohled „Jazyk“) a bukálně u horních molárů.', tool: 'ultrasonic' },
      { done: () => pr.calc > 0.9, text: 'Tmavý subgingivální kámen u okraje dásně dočisti Kyretou – krátkými tahy.', tool: 'curette' },
      { done: () => pr.polish > 0.7, text: 'Vyleštit! Kalíškem s pastou přejeď vyčištěné plochy.', tool: 'polish' },
      { done: () => pr.fluor > 0.6, text: 'Nakonec Fluorid – nanes lak na všechny zuby.', tool: 'fluoride' },
      { done: () => s.cariesFound > 0, text: 'Na zubu 36 (dolní levý první molár) je tmavá skvrna ve fisuře. Vezmi Sondu a klepni na ni.', tool: 'probe' },
      { done: () => false, text: 'Skvělé! Klepni na ✓ Hotovo a podívej se na hodnocení.', tool: null },
    ];
    let i = 0;
    while (i < steps.length - 1 && steps[i].done()) i++;
    if (i !== s.tutorialStep || first) {
      s.tutorialStep = i;
      this.ui.tutorial(steps[i].text, steps[i].tool);
    }
  }

  // ---------- Hodnocení ----------
  score() {
    const s = this.state;
    const pr = this.progress;
    const clean = (pr.plaque + pr.stain + pr.calc * 1.5) / 3.5;
    const comfortAvg = s.time > 0 ? s.comfortInt / s.time : 100;
    const caries = s.cariesTotal ? s.cariesFound / s.cariesTotal : 1;
    const disclosedFirst = s.disclosed && s.cleanedBeforeDisclose < 0.5;
    const fluorLast = s.fluorEarly < 0.3 && pr.fluor > 0.3;
    const protocol = (disclosedFirst ? 0.5 : 0) + (fluorLast ? 0.5 : 0);
    let score = 45 * clean + 12 * pr.polish * (pr.dirt < 0.5 ? 1 : 0.5) + 10 * pr.fluor + 18 * (comfortAvg / 100) + 8 * caries + 7 * protocol;
    const fast = s.time < (this.patient.parTime ?? 480);
    if (fast && clean > 0.85) score += 5;
    score = Math.round(clamp(score, 0, 100));
    if (s.failed) score = Math.min(score, 25);
    const stars = s.failed ? 0 : score >= 85 ? 3 : score >= 65 ? 2 : score >= 40 ? 1 : 0;
    return {
      score,
      stars,
      rows: [
        ['Plak', pr.plaque],
        ['Pigmenty', pr.stain],
        ['Zubní kámen', pr.calc],
        ['Leštění', pr.polish],
        ['Fluoridace', pr.fluor],
        ['Komfort pacienta', comfortAvg / 100],
        [`Kazy (${s.cariesFound}/${s.cariesTotal})`, caries],
        ['Postup (indikátor na začátku, fluorid na konci)', protocol],
      ],
      fast,
      time: s.time,
      failed: s.failed,
    };
  }
}
