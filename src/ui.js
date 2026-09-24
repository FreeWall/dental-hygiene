import { TOOLS, TOOL_ORDER } from './tools.js';
import { VIEWS, VIEW_ORDER } from './views.js';
import { PATIENTS, randomPatient } from './patients.js';
import { THRESH } from './game.js';
import { pickQuestion } from './quiz.js';
import { formatTime } from './util.js';

const $ = (id) => document.getElementById(id);

const ICONS = {
  probe: '<path d="M4 20 15 9"/><path d="M15 9c2-2 4-1 4 1s-2 2-3 1"/><path d="M6 18l-1.5 1.5"/>',
  disclose: '<path d="M12 3c3 4.5 5.5 7.5 5.5 10.5a5.5 5.5 0 0 1-11 0C6.5 10.5 9 7.5 12 3z" fill="rgba(180,90,220,.35)"/><path d="M10 14.5a2.2 2.2 0 0 0 2 2"/>',
  airflow: '<path d="M4 20l7-7"/><path d="M11 13l2-5 3 3-5 2z"/><circle cx="17" cy="5" r=".9"/><circle cx="20" cy="8" r=".9"/><circle cx="19.5" cy="3.5" r=".7"/><circle cx="21.5" cy="5.5" r=".6"/>',
  ultrasonic: '<path d="M3 21l8-8"/><path d="M11 13c1-1 2-3 1.5-5"/><path d="M15.5 6.5a3 3 0 0 1 0 4"/><path d="M18 4.5a6 6 0 0 1 0 8"/>',
  curette: '<path d="M4 20l9-9"/><path d="M13 11c1.5-1.5 2-3.5 1-5.5 2 .3 4 2.4 3.3 4.8"/>',
  polish: '<path d="M4 20l7-7"/><path d="M11 13l2-2"/><path d="M12 7h8l-1.5 5h-5z"/><path d="M14 9.5h4" />',
  fluoride: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9.5 12.5l2 2 3.5-4"/>',
};

const VIEW_ICONS = {
  front: '😁 Zepředu',
  right: '◀ Vpravo',
  left: 'Vlevo ▶',
  upper: '⬆ Horní',
  lower: '⬇ Dolní',
  palatal: '👅 Patro',
  lingual: '👅 Jazyk',
};

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.game = null;
    this.bubbleTimer = 0;
    this.toastTimer = 0;
    this.quizUsed = new Set();
    this.progress = JSON.parse(localStorage.getItem('dh-progress') || '{}');
    this.name = localStorage.getItem('dh-name') || '';
    this.assist = localStorage.getItem('dh-assist') === '1';
    this.buildToolbar();
    this.buildViews();
    this.bindScreens();
  }

  attach(game) {
    this.game = game;
  }

  show(id) {
    for (const el of document.querySelectorAll('.screen:not(.overlay)')) el.classList.add('hidden');
    if (id) $(id).classList.remove('hidden');
  }

  overlay(id, on) {
    $(id).classList.toggle('hidden', !on);
  }

  // ---------- Obrazovky ----------
  bindScreens() {
    $('nameInput').value = this.name;
    $('btnPlay').onclick = () => {
      this.audio.init();
      this.audio.select();
      this.name = $('nameInput').value.trim();
      localStorage.setItem('dh-name', this.name);
      this.showLevels();
    };
    const how = () => {
      this.audio.click();
      $('scrHow').classList.remove('hidden');
    };
    $('btnHow').onclick = how;
    $('btnHow2').onclick = how;
    for (const b of document.querySelectorAll('.close-how')) b.onclick = () => $('scrHow').classList.add('hidden');
    $('btnFull').onclick = () => this.fullscreen();
    const mute = () => {
      this.audio.init();
      this.audio.setMuted(!this.audio.muted);
      this.syncMute();
    };
    $('btnMute').onclick = mute;
    $('btnMute2').onclick = mute;
    this.syncMute();
    const assist = () => {
      this.audio.click();
      this.assist = !this.assist;
      localStorage.setItem('dh-assist', this.assist ? '1' : '0');
      this.syncAssist();
    };
    $('btnAssist').onclick = assist;
    $('btnAssist2').onclick = assist;
    this.syncAssist();
    $('btnLevelsBack').onclick = () => this.show('scrStart');
    $('btnBriefBack').onclick = () => this.showLevels();
    $('btnBriefGo').onclick = () => {
      this.audio.select();
      this.show(null);
      this.game.start();
    };
    $('btnMenu').onclick = () => {
      this.game.paused = true;
      this.audio.stopLoops();
      this.overlay('scrPause', true);
    };
    $('btnResume').onclick = () => {
      this.game.paused = false;
      this.overlay('scrPause', false);
    };
    $('btnQuit').onclick = () => {
      this.overlay('scrPause', false);
      this.game.stop();
      $('hud').classList.add('hidden');
      this.showLevels();
    };
    $('btnReveal').onclick = () => this.game.reveal();
    $('btnChart').onclick = () => {
      this.audio.click();
      this.renderChart();
      this.overlay('scrChart', true);
    };
    $('btnChartClose').onclick = () => this.overlay('scrChart', false);
    $('btnFinish').onclick = () => this.confirmFinish();
    $('btnConfirmNo').onclick = () => {
      this.game.paused = false;
      this.overlay('scrConfirm', false);
    };
    $('btnConfirmYes').onclick = () => {
      this.overlay('scrConfirm', false);
      this.finish(this.game);
    };
    $('btnResNext').onclick = () => (this.game.patient.advice ? this.showAdvice() : this.showQuiz());

    const suction = $('btnSuction');
    const on = (e) => {
      e.preventDefault();
      this.audio.init();
      suction.setPointerCapture?.(e.pointerId);
      this.game.suction = true;
      suction.classList.add('active');
    };
    const off = () => {
      this.game.suction = false;
      suction.classList.remove('active');
    };
    suction.addEventListener('pointerdown', on);
    suction.addEventListener('pointerup', off);
    suction.addEventListener('pointercancel', off);
    suction.addEventListener('lostpointercapture', off);

    window.addEventListener('keydown', (e) => {
      if (!this.game?.running || e.target.tagName === 'INPUT') return;
      const n = Number(e.key);
      if (n >= 1 && n <= TOOL_ORDER.length) this.game.selectTool(TOOL_ORDER[n - 1]);
      if (e.code === 'Space') {
        e.preventDefault();
        this.game.suction = true;
        suction.classList.add('active');
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') off();
    });
    const orient = () => {
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 700;
      $('rotateHint').classList.toggle('hidden', !(portrait && this.game?.running));
      clearTimeout(this.rotateTimer);
      this.rotateTimer = setTimeout(() => $('rotateHint').classList.add('hidden'), 6000);
    };
    window.addEventListener('resize', orient);
    this.orient = orient;
  }

  syncAssist() {
    const t = `🧑‍⚕️ Asistentka odsává: ${this.assist ? 'ano' : 'ne'}`;
    $('btnAssist').textContent = t;
    $('btnAssist2').textContent = t;
  }

  syncMute() {
    const t = this.audio.muted ? '🔇 Zvuk vypnutý' : '🔊 Zvuk';
    $('btnMute').textContent = t;
    $('btnMute2').textContent = t;
  }

  fullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      Promise.resolve(req.call(el))
        .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
        .catch(() => {});
    }
  }

  showLevels() {
    if (!this.game.running) this.game.menuView();
    this.show('scrLevels');
    $('hud').classList.add('hidden');
    $('clinicTitle').textContent = this.name ? `Ordinace DH ${this.name}` : 'Čekárna';
    const list = $('levelList');
    list.innerHTML = '';
    const all = [...PATIENTS, { id: 'random', name: 'Náhodný pacient', age: 'kdo přijde, ten přijde', emoji: '🎲', random: true }];
    for (const p of all) {
      const best = this.progress[p.id];
      const btn = document.createElement('button');
      btn.className = 'level';
      const stars = best ? '⭐'.repeat(best.stars) + '☆'.repeat(3 - best.stars) : '☆☆☆';
      btn.innerHTML = `<span class="em">${p.emoji}</span><span><div class="nm">${p.name}</div><div class="ag">${p.age}</div>
        <div class="st">${stars}${best ? ` <span class="ag">${best.score} b.</span>` : ''}</div>
        ${p.tutorial ? '<span class="tag">výuka</span>' : ''}</span>`;
      btn.onclick = () => {
        this.audio.click();
        this.brief(p.random ? randomPatient() : p);
      };
      list.appendChild(btn);
    }
  }

  brief(patient) {
    this.game.load(patient);
    $('briefEmoji').textContent = patient.emoji;
    $('briefName').textContent = patient.name;
    $('briefAge').textContent = patient.age;
    $('briefBio').textContent = patient.bio;
    $('briefQuote').textContent = `„${(patient.intro ?? [''])[0]}“`;
    this.show('scrBrief');
  }

  // ---------- HUD ----------
  onStart(game) {
    this.tutorialText = null;
    $('hud').classList.remove('hidden');
    $('pEmoji').textContent = game.patient.emoji;
    $('pName').textContent = game.patient.name;
    for (const id of TOOL_ORDER) this.setToolDone(id, false);
    this.buildTasks(game);
    this.updateHUD(game);
    this.orient();
  }

  buildToolbar() {
    const bar = $('toolbar');
    bar.innerHTML = '';
    this.toolBtns = {};
    TOOL_ORDER.forEach((id, i) => {
      const T = TOOLS[id];
      const b = document.createElement('button');
      b.className = 'tool-btn';
      b.innerHTML = `<span class="num">${i + 1}</span><svg viewBox="0 0 24 24">${ICONS[id]}</svg><span>${T.short}</span>`;
      b.onclick = () => this.game.selectTool(id);
      bar.appendChild(b);
      this.toolBtns[id] = b;
    });
  }

  buildViews() {
    const box = $('views');
    box.innerHTML = '';
    this.viewBtns = {};
    for (const id of VIEW_ORDER) {
      const b = document.createElement('button');
      b.className = 'view-btn';
      b.textContent = VIEW_ICONS[id] ?? VIEWS[id].label;
      b.onclick = () => {
        this.audio.click();
        this.game.setView(id);
      };
      box.appendChild(b);
      this.viewBtns[id] = b;
    }
  }

  setActiveView(id) {
    for (const [k, b] of Object.entries(this.viewBtns)) b.classList.toggle('active', k === id);
  }

  setActiveTool(id) {
    for (const [k, b] of Object.entries(this.toolBtns)) b.classList.toggle('active', k === id);
  }

  setToolDone(id, done) {
    this.toolBtns[id]?.classList.toggle('done', done);
  }

  buildTasks(game) {
    const box = $('tasks');
    box.innerHTML = '';
    this.taskEls = {};
    const defs = [
      ['plaque', 'Plak'],
      ['stain', 'Pigment'],
      ['calc', 'Kámen'],
      ['polish', 'Lesk'],
      ['fluor', 'Fluorid'],
    ];
    if (game.state.cariesTotal > 0) defs.push(['caries', 'Kazy']);
    for (const [k, label] of defs) {
      const el = document.createElement('div');
      el.className = 'task';
      el.innerHTML = `<div class="tl">${label}</div><div class="tv">0 %</div><div class="bar"></div>`;
      el.onclick = () => $('btnChart').click();
      box.appendChild(el);
      this.taskEls[k] = el;
    }
  }

  updateHUD(game) {
    const pr = game.progress;
    const s = game.state;
    const set = (k, v, goal) => {
      const el = this.taskEls[k];
      if (!el) return;
      el.querySelector('.tv').textContent = k === 'caries' ? `${s.cariesFound}/${s.cariesTotal}` : `${Math.floor(v * 100)} %`;
      el.querySelector('.bar').style.width = `${Math.min(100, (v / goal) * 100)}%`;
      el.classList.toggle('done', !!s.done[k]);
    };
    set('plaque', pr.plaque, THRESH.plaque);
    set('stain', pr.stain, THRESH.stain);
    set('calc', pr.calc, THRESH.calc);
    set('polish', pr.polish, THRESH.polish);
    set('fluor', pr.fluor, THRESH.fluor);
    set('caries', s.cariesTotal ? s.cariesFound / s.cariesTotal : 1, 1);
    $('timer').textContent = formatTime(s.time);
  }

  updateFast(game) {
    const s = game.state;
    const c = s.comfort;
    const fill = $('comfortFill');
    fill.style.width = `${c}%`;
    fill.style.background = c > 60 ? 'var(--good)' : c > 30 ? 'var(--warn)' : 'var(--bad)';
    const mood = game.patient.noPain ? '🤖' : c > 85 ? '😊' : c > 65 ? '🙂' : c > 45 ? '😐' : c > 25 ? '😣' : '😫';
    const m = $('mood');
    if (m.textContent !== mood) m.textContent = mood;
    const ring = $('waterRing');
    ring.style.strokeDashoffset = `${106.8 * (1 - Math.min(1, s.water))}`;
    ring.style.stroke = s.water > 0.7 ? 'var(--bad)' : s.water > 0.45 ? 'var(--warn)' : 'var(--accent2)';
    $('btnSuction').classList.toggle('alarm', s.water > 0.7 && !game.suction);
    const now = performance.now();
    if (this.bubbleTimer && now > this.bubbleTimer) {
      $('bubble').classList.add('hidden');
      this.bubbleTimer = 0;
    }
    if (this.toastTimer && now > this.toastTimer) {
      $('toast').classList.add('hidden');
      this.toastTimer = 0;
      if (this.tutorialText && game.running) {
        const t = $('toast');
        t.innerHTML = '🎓 ' + this.tutorialText;
        t.className = 'good';
      }
    }
    if (this.labelTimer && now > this.labelTimer) {
      $('toothLabel').classList.add('hidden');
      this.labelTimer = 0;
    }
    if (this.hintTimer && now > this.hintTimer) {
      $('toolHint').classList.add('hidden');
      this.hintTimer = 0;
    }
  }

  hurt() {
    const m = $('mood');
    m.classList.add('hurt');
    setTimeout(() => m.classList.remove('hurt'), 250);
  }

  bubble(text, pain) {
    const b = $('bubble');
    b.textContent = text;
    b.classList.toggle('pain', !!pain);
    b.classList.remove('hidden');
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    this.bubbleTimer = performance.now() + 2600;
  }

  toast(text, kind = '') {
    const t = $('toast');
    t.innerHTML = text;
    t.className = kind;
    this.toastTimer = performance.now() + 3200;
  }

  toastDuration(ms) {
    this.toastTimer = performance.now() + ms;
  }

  toolHint(text) {
    const h = $('toolHint');
    h.textContent = text;
    h.classList.remove('hidden');
    this.hintTimer = performance.now() + 4000;
  }

  toothLabel(html) {
    const l = $('toothLabel');
    l.innerHTML = html;
    l.classList.remove('hidden');
    this.labelTimer = performance.now() + 3500;
  }

  crosshair(p) {
    const c = $('crosshair');
    if (!p) {
      if (!c.classList.contains('hidden')) c.classList.add('hidden');
      return;
    }
    c.classList.remove('hidden');
    c.style.left = `${p.x}px`;
    c.style.top = `${p.y}px`;
  }

  tutorial(text, tool) {
    this.tutorialText = text;
    this.toast('🎓 ' + text, 'good');
    this.toastTimer = performance.now() + 9000;
    for (const [k, b] of Object.entries(this.toolBtns)) b.classList.toggle('pulse', k === tool && this.game.tool !== tool);
  }

  renderChart() {
    const g = this.game;
    const box = $('chart');
    box.innerHTML = '';
    const rows = [
      [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
      [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
    ].map((r) => r.filter((n) => n % 10 !== 8));
    rows.forEach((row, ri) => {
      const el = document.createElement('div');
      el.className = 'chart-row' + (ri === 1 ? ' split' : '');
      for (const fdi of row) {
        const t = g.mouth.teeth.find((x) => x.fdi === fdi);
        const c = document.createElement('button');
        c.className = 'tc';
        if (!t) {
          c.classList.add('missing');
          c.innerHTML = `${ri === 0 ? `<span>${fdi}</span>` : ''}<span class="ico"></span>${ri === 1 ? `<span>${fdi}</span>` : ''}`;
        } else {
          const rem = g.toothRemaining(t);
          c.classList.add(rem < 0.08 ? 'clean' : rem < 0.4 ? 'some' : 'dirty');
          const pol = t.stats.polW > 0 ? t.stats.pol / t.stats.polW : 1;
          const fl = t.stats.w > 0 ? t.stats.fl / t.stats.w : 0;
          const marks = `${pol > 0.75 && rem < 0.1 ? '✨' : ''}${fl > 0.7 ? '🛡️' : ''}${t.cariesFound ? '⚫' : ''}`;
          const num = `<span>${fdi}</span>`;
          c.innerHTML = ri === 0 ? `${num}<span class="ico"></span><span class="marks">${marks}</span>` : `<span class="marks">${marks}</span><span class="ico"></span>${num}`;
          c.onclick = () => {
            this.overlay('scrChart', false);
            g.focusTooth(fdi);
          };
        }
        el.appendChild(c);
      }
      box.appendChild(el);
    });
  }

  confirmFinish() {
    const g = this.game;
    const pr = g.progress;
    const left = [];
    if (pr.plaque < THRESH.plaque) left.push('plak');
    if (pr.stain < THRESH.stain) left.push('pigmenty');
    if (pr.calc < THRESH.calc) left.push('zubní kámen');
    if (pr.polish < THRESH.polish) left.push('leštění');
    if (pr.fluor < THRESH.fluor) left.push('fluoridace');
    if (g.state.cariesFound < g.state.cariesTotal) left.push('nezapsané kazy');
    if (!left.length) {
      this.finish(g);
      return;
    }
    g.paused = true;
    this.audio.stopLoops();
    $('confirmText').textContent = `Ještě zbývá: ${left.join(', ')}. Opravdu ukončit?`;
    this.overlay('scrConfirm', true);
  }

  finish(game) {
    if (game.state.finished) return;
    game.state.finished = true;
    const res = game.score();
    game.stop();
    $('hud').classList.add('hidden');
    $('rotateHint').classList.add('hidden');
    const id = game.patient.id;
    const prev = this.progress[id];
    if (!prev || res.score > prev.score) {
      this.progress[id] = { score: res.score, stars: res.stars };
      localStorage.setItem('dh-progress', JSON.stringify(this.progress));
    }
    this.lastResult = res;
    $('resStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < res.stars ? '' : 'off'}">⭐</span>`).join('');
    const titles = ['Pacient utekl z křesla 😬', 'Ujde to', 'Dobrá práce!', 'Zářivý úsměv! ✨'];
    const texts = [
      'Příště jemněji – a nezapomeň odsávat.',
      'Pacient odchází, ale jazykem si doma nahmatá pár míst, která zůstala.',
      'Pacient je spokojený a objednal se na další recall.',
      'Pacient odchází s úsměvem jak z reklamy a doporučí tě celé rodině.',
    ];
    $('resTitle').textContent = res.failed ? 'Pacient to vzdal 😫' : titles[res.stars];
    $('resText').textContent = res.failed ? 'Komfort klesl na nulu. Méně bolesti = spokojenější pacient.' : texts[res.stars];
    $('resTable').innerHTML =
      res.rows.map(([k, v]) => `<div>${k}</div><div class="v">${Math.round(v * 100)} %</div>`).join('') +
      `<div>Čas</div><div class="v">${formatTime(res.time)}${res.fast ? ' ⚡' : ''}</div>`;
    $('resScore').textContent = `${res.score} bodů`;
    $('btnResNext').textContent = game.patient.advice ? 'Instruktáž pacienta 🪥' : 'Kvízová otázka 🎓';
    this.show('scrResult');
    if (res.stars >= 2) this.audio.chime();
  }

  showAdvice() {
    const a = this.game.patient.advice;
    const order = a.a.map((_, i) => i).sort(() => Math.random() - 0.5);
    this.showQuiz({ q: a.q, answers: order.map((i) => a.a[i]), correct: order.indexOf(0), why: a.why }, 'Instruktáž pacienta · co doporučíš domů? · +5 bodů', 'Kvízová otázka 🎓', () => this.showQuiz());
  }

  showQuiz(question, header, nextLabel, next) {
    this.audio.click();
    const q = question ?? pickQuestion(this.quizUsed);
    $('quizHead').textContent = header ?? 'Otázka ze školy · +5 bodů za správnou odpověď';
    $('btnQuizNext').textContent = nextLabel ?? 'Zpět do čekárny';
    $('btnQuizNext').onclick = next ?? (() => this.showLevels());
    $('quizQ').textContent = q.q;
    const box = $('quizA');
    box.innerHTML = '';
    $('quizWhy').classList.add('hidden');
    $('btnQuizNext').classList.add('hidden');
    q.answers.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'qa';
      b.textContent = a;
      b.onclick = () => {
        if (box.dataset.answered) return;
        box.dataset.answered = '1';
        const ok = i === q.correct;
        b.classList.add(ok ? 'ok' : 'bad');
        box.children[q.correct].classList.add('ok');
        const why = $('quizWhy');
        why.innerHTML = `${ok ? '✅ Správně!' : '❌ Tentokrát ne.'} ${q.why}`;
        why.classList.remove('hidden');
        $('btnQuizNext').classList.remove('hidden');
        if (ok) {
          this.audio.success();
          const id = this.game.patient.id;
          const cur = this.progress[id];
          if (cur && this.lastResult && cur.score >= this.lastResult.score && cur.score < 100) {
            cur.score = Math.min(100, cur.score + 5);
            localStorage.setItem('dh-progress', JSON.stringify(this.progress));
          }
        } else this.audio.wrong();
      };
      box.appendChild(b);
    });
    delete box.dataset.answered;
    this.show('scrQuiz');
  }
}
