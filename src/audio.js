// Syntetizované zvuky přes WebAudio – žádné externí soubory.
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('dh-muted') === '1';
    this.loops = {};
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('dh-muted', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  }

  noise() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    return s;
  }

  makeLoop(name) {
    const c = this.ctx;
    const out = c.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    const nodes = [];
    const add = (n) => {
      nodes.push(n);
      return n;
    };
    if (name === 'ultrasonic') {
      const o = add(c.createOscillator());
      o.type = 'sine';
      o.frequency.value = 3150;
      const g = c.createGain();
      g.gain.value = 0.05;
      o.connect(g).connect(out);
      const o2 = add(c.createOscillator());
      o2.type = 'triangle';
      o2.frequency.value = 6300;
      const g2 = c.createGain();
      g2.gain.value = 0.02;
      o2.connect(g2).connect(out);
      const n = add(this.noise());
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 5000;
      bp.Q.value = 0.8;
      const g3 = c.createGain();
      g3.gain.value = 0.18;
      n.connect(bp).connect(g3).connect(out);
    } else if (name === 'airflow') {
      const n = add(this.noise());
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const g = c.createGain();
      g.gain.value = 0.35;
      n.connect(hp).connect(g).connect(out);
    } else if (name === 'polish') {
      const o = add(c.createOscillator());
      o.type = 'sawtooth';
      o.frequency.value = 190;
      const lfo = add(c.createOscillator());
      lfo.frequency.value = 9;
      const lg = c.createGain();
      lg.gain.value = 6;
      lfo.connect(lg).connect(o.frequency);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = c.createGain();
      g.gain.value = 0.12;
      o.connect(lp).connect(g).connect(out);
    } else if (name === 'suction') {
      const n = add(this.noise());
      const lp = c.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 700;
      lp.Q.value = 0.7;
      const g = c.createGain();
      g.gain.value = 0.4;
      const lfo = add(c.createOscillator());
      lfo.type = 'square';
      lfo.frequency.value = 11;
      const lg = c.createGain();
      lg.gain.value = 0.15;
      lfo.connect(lg).connect(g.gain);
      n.connect(lp).connect(g).connect(out);
    } else if (name === 'curette') {
      const n = add(this.noise());
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 3;
      const g = c.createGain();
      g.gain.value = 0.5;
      n.connect(bp).connect(g).connect(out);
    } else if (name === 'fluoride') {
      const n = add(this.noise());
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1200;
      bp.Q.value = 1.5;
      const g = c.createGain();
      g.gain.value = 0.08;
      n.connect(bp).connect(g).connect(out);
    }
    for (const n of nodes) n.start();
    return { out, level: 0 };
  }

  /** Nastaví hlasitost smyčky 0..1 (plynule). */
  loop(name, level) {
    if (!this.ctx) return;
    let l = this.loops[name];
    if (!l) {
      if (level <= 0) return;
      l = this.loops[name] = this.makeLoop(name);
    }
    if (Math.abs(l.level - level) < 0.01) return;
    l.level = level;
    l.out.gain.setTargetAtTime(level, this.ctx.currentTime, 0.03);
  }

  stopLoops() {
    for (const k of Object.keys(this.loops)) this.loop(k, 0);
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    const t = c.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  burst(dur, freq, vol = 0.3, q = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const n = this.noise();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + dur + 0.05);
  }

  click() {
    this.tone(900, 0.06, 'triangle', 0.12);
  }
  select() {
    this.tone(660, 0.08, 'sine', 0.15);
    setTimeout(() => this.tone(990, 0.1, 'sine', 0.12), 60);
  }
  ouch() {
    this.tone(520, 0.25, 'square', 0.08, -300);
  }
  cough() {
    this.burst(0.18, 500, 0.5, 0.8);
    setTimeout(() => this.burst(0.22, 420, 0.5, 0.8), 240);
  }
  gargle() {
    for (let i = 0; i < 6; i++) setTimeout(() => this.burst(0.12, 300 + Math.random() * 200, 0.25, 2), i * 110);
  }
  chime() {
    [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'sine', 0.14), i * 90));
  }
  success() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.14), i * 80));
  }
  crunch() {
    this.burst(0.05, 3000 + Math.random() * 2000, 0.12, 4);
  }
  found() {
    this.tone(880, 0.12, 'sine', 0.18);
    setTimeout(() => this.tone(1320, 0.18, 'sine', 0.15), 100);
  }
  wrong() {
    this.tone(220, 0.2, 'sawtooth', 0.08, -60);
  }
}
