// Voces del onduloscopio. Cada voz es un subgrafo de Web Audio que suena en
// bucle sin temporizadores de JS: los ritmos y las melodías son búferes de
// control en bucle conectados a AudioParams (ganancia y desafinación).
//
// Funcionan igual sobre AudioContext y OfflineAudioContext.

const ATTACK = 0.004; // s: evita el clic al inicio de cada nota

function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function noiseBuffer(ctx, seconds = 3, seed = 7) {
  const n = Math.round(seconds * ctx.sampleRate);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) data[i] = rnd() * 2 - 1;
  return buffer;
}

// Atajos para montar un subgrafo cuyas fuentes arrancan todas en t0.
function kit(ctx, t0) {
  const sources = [];
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
  const osc = (type, hz) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.start(t0);
    sources.push(o);
    return o;
  };
  const loop = (buffer, offset = 0) => {
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.start(t0, offset);
    sources.push(s);
    return s;
  };
  const lfo = (hz, depth, ...params) => {
    const g = gain(depth);
    osc('sine', hz).connect(g);
    params.forEach((p) => g.connect(p));
  };
  const control = (seconds, fill) => {
    const n = Math.round(seconds * ctx.sampleRate);
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    fill(buffer.getChannelData(0), n, ctx.sampleRate);
    return buffer;
  };
  return { ctx, sources, gain, filter, osc, loop, lfo, control };
}

// notes: [{ t, semis, decay, vel }] dentro de un bucle de `length` segundos.
// Devuelve dos señales de control: altura (en cents) y envolvente de amplitud.
function sequence(k, length, notes) {
  const sorted = [...notes].sort((a, b) => a.t - b.t);
  const pitch = k.control(length, (d, n, sr) => {
    let cents = sorted[sorted.length - 1].semis * 100;
    let next = 0;
    for (let i = 0; i < n; i++) {
      while (next < sorted.length && sorted[next].t * sr <= i) cents = sorted[next++].semis * 100;
      d[i] = cents;
    }
  });
  const amp = k.control(length, (d, n, sr) => {
    for (const note of sorted) {
      const start = Math.round(note.t * sr);
      const len = Math.min(n, Math.round(note.decay * 7 * sr));
      for (let j = 0; j < len; j++) {
        const t = j / sr;
        d[(start + j) % n] += Math.min(1, t / ATTACK) * Math.exp(-t / note.decay) * note.vel;
      }
    }
  });
  return { pitch, amp };
}

// Osciladores que siguen la secuencia. `shape` intercala un filtro y
// `extras` añade fuentes sin altura (ruido) bajo la misma envolvente.
function sequenced(k, length, notes, partials, shape, extras = []) {
  const out = k.gain(0); // la envolvente abre la puerta
  const { pitch, amp } = sequence(k, length, notes);
  const p = k.loop(pitch);
  const into = shape ?? out;
  for (const [type, hz, level] of partials) {
    const o = k.osc(type, hz);
    p.connect(o.detune);
    o.connect(k.gain(level)).connect(into);
  }
  extras.forEach((node) => node.connect(into));
  if (shape) shape.connect(out);
  k.loop(amp).connect(out.gain);
  return out;
}

const KINDS = {
  // Referencia: tono puro con un batido muy lento.
  tone(k, s) {
    const out = k.gain(1);
    for (const [ratio, level] of [[1, 0.6], [1.0035, 0.35], [1.5, 0.16], [2, 0.2]]) {
      k.osc('sine', s.hz * ratio).connect(k.gain(level)).connect(out);
    }
    return out;
  },

  // Océano: ondas fluidas. El volumen y el brillo suben y bajan como oleaje.
  swell(k, s) {
    const out = k.gain(0.55);
    const tone = k.filter('lowpass', s.hz * 5, 1.2);
    const oscs = [['sine', 1, 0.55], ['triangle', 1.004, 0.3], ['sine', 1.5, 0.14], ['triangle', 2.002, 0.12]].map(
      ([type, ratio, level]) => {
        const o = k.osc(type, s.hz * ratio);
        o.connect(k.gain(level)).connect(tone);
        return o;
      }
    );
    tone.connect(out);
    k.lfo(s.rate, 0.4, out.gain);
    k.lfo(s.rate * 0.61, s.hz * 2.5, tone.frequency);
    if (s.drift) k.lfo(s.rate * 0.37, s.drift, ...oscs.map((o) => o.detune));
    return out;
  },

  // Aerosoles: ruido en bandas estrechas, un silbido de viento afinado.
  breath(k, s, noise) {
    const out = k.gain(0.65);
    const wind = k.loop(noise, 0.7);
    for (const [ratio, q, level] of [[1, 22, 1], [1.5, 30, 0.45]]) {
      const band = k.filter('bandpass', s.hz * ratio, q);
      wind.connect(band).connect(k.gain(level)).connect(out);
      k.lfo(s.rate, s.hz * ratio * 0.1, band.frequency);
    }
    k.lfo(s.rate * 1.7, 0.3, out.gain);
    return out;
  },

  // Calidad del aire: sierras desafinadas con una novena menor, aire cargado.
  drone(k, s) {
    const out = k.gain(1);
    const haze = k.filter('lowpass', s.hz * 6, 5);
    for (const [ratio, level] of [[1, 0.4], [1.007, 0.3], [1.498, 0.2], [2.119, 0.14]]) {
      k.osc('sawtooth', s.hz * ratio).connect(k.gain(level)).connect(haze);
    }
    haze.connect(out);
    k.lfo(s.rate, s.hz * 3.5, haze.frequency);
    k.lfo(5.1, 0.1, out.gain);
    return out;
  },

  // CO₂: acorde de novena apilado sobre la fundamental. Cada nota sube y
  // baja a su propio ritmo, así que el acorde nunca suena dos veces igual.
  chord(k, s) {
    const out = k.gain(1);
    const air = k.filter('lowpass', s.hz * 8, 0.8);
    const stack = [[1, 'sawtooth'], [1.5, 'triangle'], [2, 'sawtooth'], [2.52, 'triangle'], [3, 'triangle'], [3.564, 'sine'], [4.49, 'sine']];
    stack.forEach(([ratio, type], i) => {
      const level = 0.5 / (1 + i * 0.35);
      const note = k.gain(level);
      k.osc(type, s.hz * ratio * (i % 2 ? 1.002 : 0.998)).connect(note).connect(air);
      k.lfo(s.rate * (0.6 + i * 0.23), level * 0.9, note.gain);
    });
    air.connect(out);
    k.lfo(s.rate * 0.5, s.hz * 3, air.frequency);
    return out;
  },

  // Pulsos rítmicos: 'X' golpe fuerte, 'x' golpe suave, '.' silencio.
  // Con `spark`, cada golpe lleva además un chasquido de ruido agudo.
  pulses(k, s, noise) {
    const steps = [...s.pattern];
    const notes = steps.flatMap((c, i) =>
      c === '.' ? [] : [{ t: i * s.step, semis: 0, decay: s.decay, vel: c === 'X' ? 1 : 0.6 }]
    );
    const partials = [['square', s.hz, 0.5], ['sine', s.hz * 2, 0.4]];
    const extras = [];
    if (s.spark) {
      const crackle = k.gain(s.spark);
      k.loop(noise, 1.3).connect(k.filter('highpass', 2500)).connect(crackle);
      extras.push(crackle);
    }
    return sequenced(k, steps.length * s.step, notes, partials, k.filter('lowpass', s.hz * 9, 2), extras);
  },

  // Luces: destellos sueltos sobre una escala pentatónica.
  chime(k, s) {
    const length = 4.8;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19];
    const rnd = mulberry32(s.seed ?? 1);
    const notes = [];
    for (let t = 0; t < length - 0.2; t += 0.14 + rnd() * 0.34) {
      notes.push({ t, semis: scale[Math.floor(rnd() * scale.length)], decay: 0.09 + rnd() * 0.1, vel: 0.5 + rnd() * 0.5 });
    }
    return sequenced(k, length, notes, [['sine', s.hz, 0.6], ['sine', s.hz * 2.01, 0.22]]);
  },

  // Bosque: notas pulsadas que recorren el perfil del dosel.
  steps(k, s) {
    const notes = s.scale.map((semis, i) => ({ t: i * s.step, semis, decay: s.decay, vel: 1 }));
    return sequenced(k, notes.length * s.step, notes, [['triangle', s.hz, 0.7], ['sine', s.hz * 2, 0.2]]);
  },

  // Río atmosférico: glissando ascendente sin fin (tono de Shepard). Tres
  // parciales suben dos octavas desfasados; cada uno entra y sale en silencio.
  flow(k, s) {
    const out = k.gain(1);
    const voices = 3;
    const ramp = k.control(s.period, (d, n) => {
      for (let i = 0; i < n; i++) d[i] = i / n;
    });
    const window = k.control(s.period, (d, n) => {
      for (let i = 0; i < n; i++) d[i] = Math.sin((Math.PI * i) / n) ** 2;
    });
    for (let v = 0; v < voices; v++) {
      const offset = (v * s.period) / voices;
      const o = k.osc('sine', s.hz / 2);
      const level = k.gain(0);
      k.loop(ramp, offset).connect(k.gain(2400)).connect(o.detune);
      k.loop(window, offset).connect(level.gain);
      o.connect(level).connect(out);
    }
    return out;
  },
};

// Nivelación por textura, medida con OfflineAudioContext para que todas las
// voces lleguen al bus con una sonoridad parecida (RMS ≈ 0.15 las sostenidas,
// picos ≈ 0.3 las percusivas).
const TRIM = { tone: 0.27, swell: 0.6, breath: 7, drone: 0.5, chord: 0.27, pulses: 0.9, chime: 0.7, steps: 0.6, flow: 0.2 };

export function buildVoice(ctx, signal, noise, t0) {
  const k = kit(ctx, t0);
  const out = KINDS[signal.kind](k, signal, noise);
  const trim = k.gain(TRIM[signal.kind]);
  out.connect(trim);
  return { out: trim, sources: k.sources };
}
