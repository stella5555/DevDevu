import { noiseBuffer } from './voices.js';
import { STEPS, BANDS, normalized, normalizedFlux } from '../jukebox/analysis.js';

// Sonificación multipista de la estación de análisis (Web Audio API).
// Cada dataset tiene 4 fenómenos y cada uno mueve una pista según su papel:
//
//   bass    bajo / drone        cuánto hay: volumen y brillo; a qué altura: nota
//   melody  melodía / arpegio   las tres bandas donde más pesa, en arpegio
//   pad     pad envolvente      cuánto hay: volumen y brillo; a qué altura: acorde
//   perc    percusión/destellos saltos entre franjas vecinas y picos
//
// Encima va un pulso común (bombo y charles) que sigue la intensidad total de
// la franja: donde no hay nada, tampoco hay pulso.
//
// El reloj es el del AudioContext: las notas se programan con antelación y el
// visor dibuja la línea y los anillos a partir del mismo reloj. El análisis
// se rehace varias veces por segundo sobre el vídeo, así que lo que suena es
// siempre el fotograma que se está viendo.

// Color fijo de cada pista en mezclador, histograma y anillos. Rojo, verde y
// azul validados para daltonismo sobre el fondo del panel; la cuarta es neutra.
export const SLOT_COLORS = ['#c8372f', '#2fae6e', '#3b8eea', '#cfcabd'];
export const DEFAULT_MIX = [0.8, 0.8, 0.7, 0.8];

const LOOKAHEAD = 0.16; // s de notas programadas por delante
const TICK_MS = 30;
const SWEEP_LEVEL = 0.7;
const FX_LEVEL = 0.8;

const centroid = (bands) => {
  let weight = 0;
  let total = 0;
  for (let k = 0; k < BANDS; k++) {
    weight += bands[k] * k;
    total += bands[k];
  }
  return total > 1e-6 ? weight / total / (BANDS - 1) : 0;
};

class Sonifier {
  ctx = null;
  analysis = null;
  playing = false;
  turns = 0; // vueltas de barrido transcurridas (fracción) al pausar
  mix = DEFAULT_MIX.map((volume) => ({ volume, mute: false, solo: false }));
  energy = 0.5; // 0..1: densidad del pulso (la mueve la misión del viaje en el tiempo)
  events = []; // { time, kind, layer, step, pos, level }: lo que el visor convierte en anillos

  load(analysis, { rootHz, scale, layers, sweep }) {
    this.pause();
    this.analysis = analysis;
    this.scale = scale;
    this.turns = 0;
    this.energy = 0.5;
    this.events.length = 0;
    this.role = {};
    layers.forEach((layer, k) => (this.role[layer.role] = k));
    this.seconds = sweep.seconds;
    // Con `follow` seguimos la línea del vídeo de la NASA: arranca apuntando a
    // la derecha y gira en sentido antihorario. Leemos dos franjas por delante
    // de ella para no medir la propia línea dibujada.
    this.direction = sweep.follow ? -1 : 1;
    this.phase = sweep.follow ? Math.round(STEPS / 4) - 2 : 0;
    // La fundamental de la señal, llevada al registro grave.
    let root = rootHz;
    while (root > 82) root /= 2;
    while (root < 41) root *= 2;
    this.root = root;
  }

  unload() {
    this.pause();
    this.analysis = null;
    this.turns = 0;
    if (this.ctx) this.sleep = setTimeout(() => this.ctx.suspend(), 500);
  }

  // Crea o despierta el audio. Requiere que el usuario ya haya interactuado.
  wake() {
    if (!this.ctx) {
      try {
        this.build();
      } catch (err) {
        console.warn('Sonificación sin audio:', err);
        this.ctx = null;
        return false;
      }
    }
    clearTimeout(this.sleep);
    if (this.ctx.state !== 'running') this.ctx.resume();
    return true;
  }

  play() {
    if (!this.analysis || this.playing) return this.playing;
    if (!this.wake()) return false;
    const now = this.ctx.currentTime;
    this.t0 = now + 0.06 - this.turns * this.seconds;
    this.next = Math.ceil((now + 0.05 - this.t0) / this.stepSeconds);
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(SWEEP_LEVEL, now, 0.05);
    this.applyMix();
    this.playing = true;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
    return true;
  }

  pause() {
    if (!this.playing) return;
    this.turns = this.elapsed() / this.seconds;
    this.playing = false;
    clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.04);
  }

  get stepSeconds() {
    return this.seconds / STEPS;
  }

  // Segundos de barrido transcurridos (crece sin límite mientras suena).
  elapsed() {
    if (!this.playing) return this.turns * this.seconds;
    return Math.max(this.turns * this.seconds, this.ctx.currentTime - this.t0);
  }

  // Franja que corresponde al paso n del reloj.
  stepIndex(n) {
    return (((this.phase + this.direction * n) % STEPS) + STEPS) % STEPS;
  }

  // Posición del barrido sobre la imagen, 0..1.
  progress() {
    if (!this.analysis) return 0;
    const turns = this.elapsed() / this.seconds;
    return (((this.phase / STEPS + this.direction * turns) % 1) + 1) % 1;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setMix(mix) {
    this.mix = mix;
    this.applyMix();
  }

  applyMix() {
    if (!this.ctx) return;
    const solo = this.mix.some((m) => m.solo);
    this.mix.forEach((m, i) => {
      const level = m.mute || (solo && !m.solo) ? 0 : m.volume;
      this.strip[i].gain.setTargetAtTime(level, this.ctx.currentTime, 0.03);
    });
  }

  build() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx({ latencyHint: 'interactive' });
    const t0 = ctx.currentTime + 0.05;
    const gain = (value) => {
      const g = ctx.createGain();
      g.gain.value = value;
      return g;
    };
    const filter = (type, hz, q = 1) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      f.Q.value = q;
      return f;
    };
    const osc = (type, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      o.start(t0);
      return o;
    };

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.ratio.value = 5;
    limiter.connect(ctx.destination);
    this.master = gain(0); // el barrido
    this.fx = gain(FX_LEVEL); // sonidos de misión: suenan aunque el barrido esté en pausa
    this.master.connect(limiter);
    this.fx.connect(limiter);

    // Eco compartido: da espacio a la melodía, a los destellos y a las misiones.
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.56;
    const feedback = gain(0.34);
    this.echo.connect(filter('lowpass', 2600)).connect(feedback).connect(this.echo);
    this.echo.connect(limiter);
    this.fxEcho = gain(0.3);
    this.fx.connect(this.fxEcho).connect(this.echo);

    this.strip = [0, 1, 2, 3].map(() => gain(0)); // un canal de mezcla por fenómeno
    this.strip.forEach((s) => s.connect(this.master));
    this.sends = this.strip.map((s) => {
      const send = gain(0);
      s.connect(send).connect(this.echo);
      return send;
    });

    // Bajo: sierra + seno bajo un filtro que abre la intensidad del fenómeno.
    this.bass = { oscs: [osc('sawtooth'), osc('sine'), osc('triangle', 6)], tone: filter('lowpass', 120, 3), amp: gain(0) };
    this.bass.oscs.forEach((o, i) => o.connect(gain([0.45, 0.6, 0.3][i])).connect(this.bass.tone));
    this.bass.tone.connect(this.bass.amp);

    // Pad: tres notas, cada una con dos osciladores desafinados.
    this.pad = { notes: [0, 1, 2].map(() => [osc('triangle', -7), osc('sawtooth', 7)]), tone: filter('lowpass', 400, 0.8), amp: gain(0) };
    this.pad.notes.forEach((pair) => pair.forEach((o, i) => o.connect(gain(i ? 0.1 : 0.3)).connect(this.pad.tone)));
    this.pad.tone.connect(this.pad.amp);

    this.noise = noiseBuffer(ctx, 1, 91);
    this.ctx = ctx;
    this.wired = null;
  }

  // Conecta bajo y pad al canal del fenómeno que les toca en este dataset.
  wire() {
    const key = `${this.role.bass}|${this.role.pad}|${this.role.melody}|${this.role.perc}`;
    if (this.wired === key) return;
    this.wired = key;
    this.bass.amp.disconnect();
    this.pad.amp.disconnect();
    this.bass.amp.connect(this.strip[this.role.bass]);
    this.pad.amp.connect(this.strip[this.role.pad]);
    this.sends.forEach((send, k) => (send.gain.value = k === this.role.melody ? 0.3 : k === this.role.perc ? 0.22 : 0));
  }

  hz(semitones, octave = 0) {
    return this.root * 2 ** (octave + semitones / 12);
  }

  // Semitonos de la nota de la escala para una posición 0..1, en `octaves` octavas.
  note(pos, octaves) {
    const degree = Math.round(pos * this.scale.length * octaves);
    return this.scale[degree % this.scale.length] + 12 * Math.floor(degree / this.scale.length);
  }

  // Frecuencia de la escala del dataset para una posición 0..1 (para las misiones).
  scaleHz(pos, octaves = 2, octave = 2) {
    return this.hz(this.note(Math.min(1, Math.max(0, pos)), octaves), octave);
  }

  tick() {
    this.wire();
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    while (this.t0 + this.next * this.stepSeconds < horizon) {
      this.schedule(this.next, this.t0 + this.next * this.stepSeconds);
      this.next++;
    }
  }

  // Intensidad de un fenómeno en la franja, relativa a su recorrido en la
  // imagen. Si el fenómeno apenas existe en el fotograma, se queda en casi 0.
  drive(k, strip) {
    return normalized(this.analysis, k, strip.v[k]) * Math.min(1, this.analysis.range[k][1] / 0.01);
  }

  mark(time, kind, layer, step, pos, level) {
    this.events.push({ time, kind, layer, step, pos, level });
    if (this.events.length > 200) this.events.splice(0, 80);
  }

  schedule(n, t) {
    const A = this.analysis;
    const i = this.stepIndex(n);
    const s = A.strips[i];
    const { bass: kb, melody: km, pad: kp, perc: kx } = this.role;

    // Bajo: la intensidad abre el filtro y sube el volumen; la altura del
    // fenómeno en la imagen elige la nota (cada 4 franjas, con ligadura).
    const bass = this.drive(kb, s);
    this.bass.amp.gain.setTargetAtTime(0.04 + 0.5 * bass, t, 0.05);
    this.bass.tone.frequency.setTargetAtTime(110 + 900 * bass * bass, t, 0.05);
    if (n % 4 === 0) {
      const hz = this.hz(this.note(centroid(s.bands[kb]), 1));
      this.bass.oscs.forEach((o, k) => o.frequency.setTargetAtTime(k === 0 ? hz * 2 : hz, t, 0.04));
    }

    // Melodía: arpegio sobre las tres bandas donde más pesa el fenómeno.
    const bands = s.bands[km];
    const top = [...bands.keys()].sort((a, b) => bands[b] - bands[a]).slice(0, 3);
    const band = top[n % 3];
    const present = Math.min(1, A.range[km][1] / 0.01);
    const melody = (bands[band] / A.maxBand[km]) * present;
    if (melody > 0.14 - 0.08 * this.energy) {
      const pos = band / (BANDS - 1);
      const hz = this.hz(this.note(pos, 2), 3);
      this.pluck(hz, t, 0.1 + 0.5 * melody, km);
      this.mark(t, 'note', km, i, (band + 0.5) / BANDS, melody);
      // Con mucha energía, cada nota lleva un eco a la octava a contratiempo.
      if (this.energy > 0.6 && n % 2 === 1) this.pluck(hz * 2, t + this.stepSeconds / 2, 0.06 + 0.2 * melody, km);
    }

    // Pad: volumen y brillo con la intensidad; el acorde cambia cada 8 franjas.
    const pad = this.drive(kp, s);
    this.pad.amp.gain.setTargetAtTime(0.03 + 0.34 * pad, t, 0.12);
    this.pad.tone.frequency.setTargetAtTime(300 + 2600 * pad, t, 0.12);
    if (n % 8 === 0) {
      const degree = Math.round(centroid(s.bands[kp]) * (this.scale.length - 1));
      this.pad.notes.forEach((pair, k) => {
        const step = degree + k * 2;
        const hz = this.hz(this.scale[step % this.scale.length] + 12 * Math.floor(step / this.scale.length), 2);
        pair.forEach((o) => o.frequency.setTargetAtTime(hz, t, 0.2));
      });
    }

    // Percusión: golpe cuando el fenómeno cambia de golpe entre franjas
    // vecinas; destello cuando la franja contiene un pico suyo.
    const jump = normalizedFlux(A, kx, s.flux[kx]) * Math.min(1, A.range[kx][1] / 0.01);
    if (jump > 0.3) {
      this.hit(t, jump, s.peakPos[kx], kx);
      this.mark(t, 'hit', kx, i, s.peakPos[kx], jump);
    }
    const before = A.strips[(i + STEPS - 1) % STEPS].peak[kx];
    const after = A.strips[(i + 1) % STEPS].peak[kx];
    const spike = s.peak[kx] / A.maxPeak[kx];
    if (s.peak[kx] > 0.2 && spike > 0.6 && s.peak[kx] >= before && s.peak[kx] > after) {
      this.sparkle(this.hz(this.note(s.peakPos[kx], 2), 4), t, 0.16 * spike, kx);
      this.mark(t, 'spark', kx, i, s.peakPos[kx], spike);
    }

    // Pulso común: bombo en cada negra y charles a contratiempo, tan fuertes
    // como cargada esté la franja.
    const [low, high] = A.totalRange;
    const load = high - low > 1e-6 ? (s.total - low) / (high - low) : 0;
    if (n % 4 === 0 && load > 0.1) {
      this.kick(t, 0.2 + 0.55 * load, kx);
      this.mark(t, 'beat', kx, i, 0.5, load);
    }
    const perc = this.drive(kx, s);
    if ((n % 2 === 1 || this.energy > 0.66) && (perc > 0.05 || load > 0.35)) this.hat(t, 0.04 + 0.16 * Math.max(perc, load * 0.6), kx);
  }

  envelope(t, level, attack, decay) {
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0008, t + attack + decay);
    return env;
  }

  pluck(hz, t, level, layer) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz;
    o.connect(this.envelope(t, level, 0.008, 0.33)).connect(this.strip[layer]);
    o.start(t);
    o.stop(t + 0.38);
  }

  burst(t, level, hz, q, decay, target) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = hz;
    band.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(level, t);
    env.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    src.connect(band).connect(env).connect(target);
    src.start(t, Math.random() * 0.8, decay + 0.05);
  }

  hit(t, level, pos, layer) {
    this.burst(t, 0.9 * level, 900 + 5200 * pos, 1.1, 0.05 + 0.08 * level, this.strip[layer]);
  }

  hat(t, level, layer) {
    this.burst(t, level, 8500, 0.8, 0.035, this.strip[layer]);
  }

  kick(t, level, layer) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    o.connect(this.envelope(t, level, 0.004, 0.2)).connect(this.strip[layer]);
    o.start(t);
    o.stop(t + 0.24);
  }

  sparkle(hz, t, level, layer) {
    const o = this.ctx.createOscillator();
    o.frequency.value = hz;
    o.connect(this.envelope(t, level, 0.004, 0.5)).connect(this.strip[layer]);
    o.start(t);
    o.stop(t + 0.52);
  }

  // ── Sonidos de misión: van por su propio canal, con o sin barrido ──

  tone(hz, { level = 0.3, dur = 0.5, type = 'sine', attack = 0.006, delay = 0 } = {}) {
    if (!this.wake()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.connect(this.envelope(t, level, attack, dur)).connect(this.fx);
    o.start(t);
    o.stop(t + attack + dur + 0.03);
  }

  // Marimba: fundamental más un parcial agudo que se apaga enseguida.
  marimba(hz, level = 0.3, rich = 0) {
    this.tone(hz, { level, dur: 0.42, attack: 0.003 });
    this.tone(hz * 4, { level: level * 0.3, dur: 0.07, attack: 0.002 });
    if (rich > 0.3) this.tone(hz * 1.5, { level: level * 0.45 * rich, dur: 0.36, attack: 0.003 });
    if (rich > 0.6) this.tone(hz * 2, { level: level * 0.35 * rich, dur: 0.3, attack: 0.003, delay: 0.06 });
  }

  click(level = 0.3, hz = 3200) {
    if (!this.wake()) return;
    this.burst(this.ctx.currentTime, level, hz, 1.4, 0.05, this.fx);
  }

  // Fanfarria de descubrimiento: arpegio mayor ascendente y acorde final.
  fanfare() {
    if (!this.wake()) return;
    const base = this.root * 4;
    [0, 4, 7, 12, 16].forEach((semis, i) => this.tone(base * 2 ** (semis / 12), { level: 0.22, dur: 0.5, type: 'triangle', delay: i * 0.09 }));
    [0, 7, 12, 16, 19].forEach((semis) => this.tone(base * 2 ** (semis / 12), { level: 0.13, dur: 1.4, type: 'triangle', delay: 0.5 }));
    this.tone(base / 2, { level: 0.25, dur: 1.2, delay: 0.5 });
  }
}

export const sonifier = new Sonifier();
