import { ANOMALIES } from '../data/anomalies.js';
import { buildVoice, noiseBuffer } from './voices.js';

// Motor de audio del onduloscopio (Web Audio API, sin dependencias).
//
//   estática ─┐
//   voz × N ──┼─► compresor ─► master ─► analizador ─► altavoces
//
// Todas las voces suenan siempre; el escáner solo mueve su ganancia y su filtro
// según la intensidad de señal (0..1) que calcula cada frame.

const MASTER_LEVEL = 0.9;
const STATIC_LEVEL = 0.34;
const STATIC_FLOOR = 0.07; // la estática nunca desaparece del todo
const EPSILON = 0.004;

class Onduloscope {
  ctx = null;
  voices = [];
  sleep = 0;
  lastHiss = -1;
  on = false;
  ducked = false; // la estación de análisis silencia el escáner mientras está abierta

  // Debe llamarse desde un gesto del usuario (clic o tecla). Devuelve false
  // si el navegador no tiene Web Audio: el osciloscopio sigue en modo visual.
  start() {
    if (!this.ctx) {
      try {
        this.build();
      } catch (err) {
        console.warn('Onduloscopio sin audio:', err);
        this.ctx = null;
        return false;
      }
    }
    this.on = true;
    this.apply();
    return true;
  }

  stop() {
    this.on = false;
    this.apply();
  }

  duck(ducked) {
    this.ducked = ducked;
    this.apply();
  }

  // Suena solo con el escáner encendido y sin la estación de análisis delante.
  apply() {
    if (!this.ctx) return;
    const audible = this.on && !this.ducked;
    const t = this.ctx.currentTime;
    clearTimeout(this.sleep);
    this.master.gain.cancelScheduledValues(t);
    if (audible) {
      this.ctx.resume();
      this.master.gain.setTargetAtTime(MASTER_LEVEL, t, 0.15);
    } else {
      this.master.gain.setTargetAtTime(0, t, 0.08);
      this.sleep = setTimeout(() => this.ctx.suspend(), 600);
    }
  }

  build() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx({ latencyHint: 'interactive' });
    const t0 = ctx.currentTime + 0.05;
    const noise = noiseBuffer(ctx);

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(this.analyser).connect(ctx.destination);

    const bus = ctx.createDynamicsCompressor();
    bus.threshold.value = -14;
    bus.ratio.value = 6;
    bus.connect(this.master);

    // Estática espacial: ruido blanco acotado en banda, con un aleteo lento.
    const hiss = ctx.createBufferSource();
    hiss.buffer = noise;
    hiss.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'highpass';
    low.frequency.value = 220;
    const high = ctx.createBiquadFilter();
    high.type = 'lowpass';
    high.frequency.value = 6000;
    const flutter = ctx.createGain();
    flutter.gain.value = 0.8;
    for (const [hz, depth] of [[0.31, 0.14], [6.3, 0.06]]) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = hz;
      const amount = ctx.createGain();
      amount.gain.value = depth;
      lfo.connect(amount).connect(flutter.gain);
      lfo.start(t0);
    }
    this.hiss = ctx.createGain();
    this.hiss.gain.value = STATIC_LEVEL;
    hiss.connect(low).connect(high).connect(flutter).connect(this.hiss).connect(bus);
    hiss.start(t0);

    this.voices = ANOMALIES.map((anomaly) => {
      const { out } = buildVoice(ctx, anomaly.signal, noise, t0);
      // Lejos de la señal la voz llega apagada; el filtro se abre al acercarse.
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 320;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      out.connect(tone).connect(gain).connect(bus);
      return { tone, gain, last: 0 };
    });

    this.ctx = ctx;
    this.lastHiss = -1;
  }

  // levels[i] ∈ [0, 1]: intensidad de la señal i bajo la mira.
  update(levels) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    let max = 0;
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      const s = levels[i];
      if (s > max) max = s;
      if (Math.abs(s - v.last) < EPSILON && (s > 0 || v.last === 0)) continue;
      v.last = s;
      v.gain.gain.setTargetAtTime(Math.pow(s, 1.5), now, 0.05);
      v.tone.frequency.setTargetAtTime(320 * Math.pow(2, 5.4 * s), now, 0.05);
    }
    // El ruido blanco cede a medida que emerge la señal más fuerte.
    const hiss = STATIC_FLOOR + (1 - STATIC_FLOOR) * Math.pow(1 - max, 1.4);
    if (Math.abs(hiss - this.lastHiss) > EPSILON) {
      this.lastHiss = hiss;
      this.hiss.gain.setTargetAtTime(hiss * STATIC_LEVEL, now, 0.05);
    }
  }

  // Tres notas ascendentes: señal identificada.
  confirm() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [660, 990, 1320].forEach((hz, i) => {
      const at = t + i * 0.11;
      const o = this.ctx.createOscillator();
      o.frequency.value = hz;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.16, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.connect(g).connect(this.master);
      o.start(at);
      o.stop(at + 0.55);
    });
  }

  // Copia en `buffer` la forma de onda que está sonando. false si no hay audio
  // en marcha (el osciloscopio dibuja entonces una señal sintética).
  waveform(buffer) {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    this.analyser.getFloatTimeDomainData(buffer);
    return true;
  }
}

export const onduloscope = new Onduloscope();
