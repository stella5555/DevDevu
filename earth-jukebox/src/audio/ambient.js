import { noiseBuffer } from './voices.js';

// Ambiente de la cabina: un zumbido grave casi inaudible y un fondo de aire,
// más los avisos de ARIA. Nace con el gesto de "Iniciar secuencia orbital",
// que es el que desbloquea el audio en el navegador.
//
// Se retira solo cuando suena otra cosa: baja con el escáner y calla con la
// estación de análisis o el museo abiertos.

const LEVEL = 0.05; // muy sutil a propósito

class Ambient {
  ctx = null;
  muted = false;
  duck = 1; // 1 cabina en silencio · 0.4 escáner activo · 0 estación o museo

  // Debe llamarse desde un gesto del usuario. false si no hay Web Audio.
  start() {
    if (this.ctx) {
      this.ctx.resume();
      return true;
    }
    try {
      this.build();
    } catch (err) {
      console.warn('Sin audio ambiental:', err);
      this.ctx = null;
      return false;
    }
    this.apply(2.5); // entra despacio, con el encendido del HUD
    return true;
  }

  build() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const t0 = ctx.currentTime + 0.05;
    const gain = (value) => {
      const g = ctx.createGain();
      g.gain.value = value;
      return g;
    };
    this.master = gain(0);
    this.master.connect(ctx.destination);
    this.ui = gain(1); // avisos de ARIA: no se atenúan con el ambiente
    this.ui.connect(ctx.destination);

    // Zumbido: dos graves a una quinta, con un batido muy lento.
    const hum = gain(0.5);
    hum.connect(this.master);
    for (const [hz, level] of [[55, 0.6], [55.4, 0.4], [82.4, 0.28], [110.3, 0.1]]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      o.connect(gain(level)).connect(hum);
      o.start(t0);
    }
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.07;
    breath.connect(gain(0.18)).connect(hum.gain);
    breath.start(t0);

    // Aire de cabina: ruido muy filtrado.
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 3, 23);
    noise.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 420;
    noise.connect(low).connect(gain(0.5)).connect(this.master);
    const air = ctx.createBiquadFilter();
    air.type = 'bandpass';
    air.frequency.value = 2600;
    air.Q.value = 0.6;
    noise.connect(air).connect(gain(0.035)).connect(this.master);
    noise.start(t0);

    this.ctx = ctx;
  }

  apply(seconds = 0.4) {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : LEVEL * this.duck, this.ctx.currentTime, seconds / 3);
  }

  setDuck(duck) {
    if (duck === this.duck) return;
    this.duck = duck;
    this.apply();
  }

  setMuted(muted) {
    this.muted = muted;
    this.apply(0.2);
  }

  // Dos notas breves: ARIA va a decir algo.
  chirp() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [[1175, 0], [1568, 0.07]].forEach(([hz, at]) => {
      const o = this.ctx.createOscillator();
      o.frequency.value = hz;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t + at);
      g.gain.linearRampToValueAtTime(0.035, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + at + 0.16);
      o.connect(g).connect(this.ui);
      o.start(t + at);
      o.stop(t + at + 0.2);
    });
  }
}

export const ambient = new Ambient();
