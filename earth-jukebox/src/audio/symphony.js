import { noiseBuffer } from './voices.js';

// Sinfonía Planetaria: el conjunto del museo. Cada nodo de la red toca una
// parte distinta de una misma progresión (Re mayor: Re – La – Si menor – Sol,
// a 84 pulsos por minuto), de modo que cualquier combinación de nodos suena
// consonante. Solo se programan las partes de los nodos disponibles (los que
// tienen su ★), y cada una se puede silenciar en vivo.
//
// Igual que la estación, el reloj es el del AudioContext: las notas se
// programan con antelación y cada una deja un aviso en `events` para que el
// museo haga brillar su nodo justo cuando suena.

const BPM = 84;
const STEP = 60 / BPM / 4; // semicorchea
const STEPS = 16; // por compás
const LOOKAHEAD = 0.18;
const TICK_MS = 30;
const LEVEL = 0.65;

// Fundamental (MIDI) y tipo de cada acorde de la progresión.
const CHORDS = [
  { root: 38, third: 4 }, // Re
  { root: 33, third: 4 }, // La
  { root: 35, third: 3 }, // Si menor
  { root: 31, third: 4 }, // Sol
];
const PENTATONIC = [62, 64, 66, 69, 71]; // Re mayor pentatónica
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
// Nota k del acorde (0 fundamental, 1 tercera, 2 quinta, 3 octava…) en la octava dada.
const tone = (chord, k, octave) => chord.root + 12 * (octave + Math.floor(k / 3)) + [0, chord.third, 7][k % 3];

// Azar repetible: la misma semilla da siempre el mismo dibujo de destellos.
const chance = (bar, step, salt) => {
  let h = Math.imul(bar * 31 + step * 17 + salt * 101, 2654435761);
  h ^= h >>> 15;
  return ((Math.imul(h, 2246822519) >>> 0) % 1000) / 1000;
};

class Symphony {
  ctx = null;
  playing = false;
  available = new Set(); // nodos con ★
  muted = new Set();
  events = []; // { time, id, level }

  start(ids) {
    this.available = new Set(ids);
    if (this.playing || !this.available.size) return this.playing;
    if (!this.ctx) {
      try {
        this.build();
      } catch (err) {
        console.warn('Sinfonía sin audio:', err);
        this.ctx = null;
        return false;
      }
    }
    clearTimeout(this.sleep);
    this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(LEVEL, now, 0.05);
    this.t0 = now + 0.1;
    this.next = 0;
    this.events.length = 0;
    this.playing = true;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
    return true;
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.08);
    this.sleep = setTimeout(() => this.ctx.suspend(), 900);
  }

  setAvailable(ids) {
    this.available = new Set(ids);
    if (this.playing && !this.available.size) this.stop();
  }

  setMuted(id, muted) {
    if (muted) this.muted.add(id);
    else this.muted.delete(id);
    if (this.ctx && this.bus[id]) this.bus[id].gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.04);
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  build() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx({ latencyHint: 'interactive' });
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.ratio.value = 6;
    limiter.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(limiter);
    // Un poco de eco común para que el conjunto suene en la misma sala.
    const echo = ctx.createDelay(1);
    echo.delayTime.value = STEP * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2400;
    echo.connect(damp).connect(feedback).connect(echo);
    echo.connect(this.master);
    this.send = ctx.createGain();
    this.send.gain.value = 0.22;
    this.send.connect(echo);

    this.bus = {}; // un canal por nodo, para silenciarlo en vivo
    for (const id of Object.keys(PARTS)) {
      const g = ctx.createGain();
      g.gain.value = this.muted.has(id) ? 0 : 1;
      g.connect(this.master);
      g.connect(this.send);
      this.bus[id] = g;
    }
    this.noise = noiseBuffer(ctx, 1, 57);
    this.ctx = ctx;
  }

  tick() {
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    while (this.t0 + this.next * STEP < horizon) {
      const bar = Math.floor(this.next / STEPS);
      const step = this.next % STEPS;
      const time = this.t0 + this.next * STEP;
      const chord = CHORDS[bar % CHORDS.length];
      for (const id of this.available) {
        if (!PARTS[id] || this.muted.has(id)) continue;
        const level = PARTS[id](this, this.bus[id], time, step, bar, chord);
        if (level) {
          this.events.push({ time, id, level });
          if (this.events.length > 300) this.events.splice(0, 100);
        }
      }
      this.next++;
    }
  }

  // ── Instrumentos ──

  env(t, level, attack, hold, release) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.setValueAtTime(level, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0008, t + attack + hold + release);
    return g;
  }

  osc(type, frequency, t, length, out, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = frequency;
    o.detune.value = detune;
    o.connect(out);
    o.start(t);
    o.stop(t + length + 0.05);
    return o;
  }

  filter(type, frequency, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  }

  noiseInto(t, length, out) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.connect(out);
    src.start(t, Math.random() * 0.8);
    src.stop(t + length + 0.05);
  }
}

// Cada parte recibe (motor, salida, tiempo, paso 0..15, compás, acorde) y
// devuelve la intensidad de lo que ha hecho sonar (0 si ese paso calla).
const PARTS = {
  // CO₂ · bajo: fundamental al dar el compás, quinta a la mitad.
  co2(s, out, t, step, bar, chord) {
    if (step !== 0 && step !== 8) return 0;
    const midi = chord.root + (step === 8 ? 7 : 0);
    const level = step === 0 ? 0.34 : 0.2;
    const length = step === 0 ? 1.25 : 0.9;
    const low = s.filter('lowpass', 320, 1.5);
    const e = s.env(t, level, 0.02, length * 0.5, length * 0.5);
    low.connect(e).connect(out);
    s.osc('sawtooth', hz(midi), t, length, low);
    s.osc('sine', hz(midi), t, length, low);
    return level * 2.4;
  },

  // Calidad del aire · cuerdas: el acorde entero, sostenido todo el compás.
  'air-quality'(s, out, t, step, bar, chord) {
    if (step !== 0) return 0;
    const length = STEP * STEPS;
    const soft = s.filter('lowpass', 1500, 0.7);
    const e = s.env(t, 0.05, 0.6, length - 1.3, 0.7);
    soft.connect(e).connect(out);
    for (const k of [0, 1, 2]) {
      s.osc('sawtooth', hz(tone(chord, k, 1)), t, length, soft, -6);
      s.osc('triangle', hz(tone(chord, k, 1)), t, length, soft, 6);
    }
    return 0.6;
  },

  // Corrientes y temperatura · oleaje: fundamental y tercera que crecen y se van.
  'sea-currents'(s, out, t, step, bar, chord) {
    if (step !== 0) return 0;
    const length = STEP * STEPS;
    const e = s.env(t, 0.11, length * 0.45, 0.05, length * 0.5);
    e.connect(out);
    s.osc('sine', hz(tone(chord, 0, 1)), t, length, e);
    s.osc('sine', hz(tone(chord, 1, 1)), t, length, e);
    s.osc('triangle', hz(tone(chord, 2, 0)), t, length, e);
    return 0.7;
  },

  // Perpetual Ocean 2 · arpegio de corcheas que sube y baja por el acorde.
  'perpetual-ocean-2'(s, out, t, step, bar, chord) {
    if (step % 2) return 0;
    const k = [0, 1, 2, 3, 4, 3, 2, 1][step / 2];
    const e = s.env(t, 0.1, 0.006, 0.02, 0.3);
    e.connect(out);
    s.osc('triangle', hz(tone(chord, k, 2)), t, 0.35, e);
    return 0.5;
  },

  // Bosques GEDI · marimba sincopada.
  'gedi-forest'(s, out, t, step, bar, chord) {
    const at = [0, 3, 6, 8, 11, 14].indexOf(step);
    if (at < 0) return 0;
    const midi = tone(chord, [0, 2, 1, 3, 2, 4][at], 2);
    const e = s.env(t, 0.15, 0.003, 0.01, 0.34);
    e.connect(out);
    s.osc('sine', hz(midi), t, 0.4, e);
    const click = s.env(t, 0.05, 0.002, 0, 0.05);
    click.connect(out);
    s.osc('sine', hz(midi) * 4, t, 0.08, click);
    return 0.6;
  },

  // Luces nocturnas · destellos agudos sueltos sobre la pentatónica.
  'night-lights'(s, out, t, step, bar) {
    if (step % 2 || chance(bar, step, 3) > 0.34) return 0;
    const midi = PENTATONIC[Math.floor(chance(bar, step, 7) * PENTATONIC.length)] + 24;
    const e = s.env(t, 0.07, 0.003, 0, 0.5);
    e.connect(out);
    s.osc('sine', hz(midi), t, 0.55, e);
    s.osc('sine', hz(midi) * 2.01, t, 0.2, e).detune.value = 3;
    return 0.5;
  },

  // Rayos · percusión eléctrica: bombo, charles a contratiempo y un chasquido.
  lightning(s, out, t, step) {
    if (step === 0 || step === 8) {
      const o = s.ctx.createOscillator();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      const e = s.env(t, 0.3, 0.004, 0, 0.2);
      o.connect(e).connect(out);
      o.start(t);
      o.stop(t + 0.26);
      return 0.8;
    }
    if (step % 4 === 2) {
      const high = s.filter('highpass', 7000);
      const e = s.env(t, 0.05, 0.002, 0, 0.04);
      high.connect(e).connect(out);
      s.noiseInto(t, 0.06, high);
      return 0.3;
    }
    if (step === 12 || step === 15) {
      const band = s.filter('bandpass', step === 12 ? 2600 : 4200, 2);
      const e = s.env(t, 0.13, 0.002, 0, 0.09);
      band.connect(e).connect(out);
      s.noiseInto(t, 0.12, band);
      return 0.7;
    }
    return 0;
  },

  // Río atmosférico · una nota larga por compás que sube de la fundamental a la quinta.
  'atmospheric-river'(s, out, t, step, bar, chord) {
    if (step !== 0) return 0;
    const length = STEP * 14;
    const e = s.env(t, 0.1, 0.35, length - 1.1, 0.7);
    e.connect(out);
    const o = s.osc('sine', hz(tone(chord, 0, 2)), t, length, e);
    o.frequency.setValueAtTime(hz(tone(chord, 0, 2)), t + 0.3);
    o.frequency.exponentialRampToValueAtTime(hz(tone(chord, 2, 2)), t + length * 0.8);
    return 0.6;
  },

  // Aerosoles · soplo: ruido en banda estrecha afinado a la quinta del acorde.
  aerosols(s, out, t, step, bar, chord) {
    if (step !== 0 && step !== 8) return 0;
    const length = STEP * 8;
    const band = s.filter('bandpass', hz(tone(chord, step === 0 ? 2 : 0, step === 0 ? 3 : 4)), 22);
    const e = s.env(t, 1.6, length * 0.45, 0.05, length * 0.5);
    band.connect(e).connect(out);
    s.noiseInto(t, length, band);
    return 0.5;
  },

  // Caldwell 73 · campana solista: un motivo de tres notas por compás.
  'caldwell-73'(s, out, t, step, bar, chord) {
    const at = [0, 6, 10].indexOf(step);
    if (at < 0) return 0;
    const motif = [[2, 1, 0], [0, 1, 2], [1, 2, 3], [2, 3, 1]][bar % 4];
    const midi = tone(chord, motif[at], 3);
    const e = s.env(t, 0.13, 0.004, 0.02, 0.85);
    e.connect(out);
    s.osc('sine', hz(midi), t, 0.95, e);
    const shine = s.env(t, 0.04, 0.003, 0, 0.3);
    shine.connect(out);
    s.osc('sine', hz(midi) * 3, t, 0.35, shine);
    return 0.8;
  },
};

export const symphony = new Symphony();
