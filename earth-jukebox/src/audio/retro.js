// Sonidos retro de la cinemática de ARIA y del protocolo de seguridad,
// hechos con Tone.js: el "blip" de cada letra (al estilo de los diálogos de
// Undertale), el acierto, el error y el encendido de la cabina. También
// reproduce la voz grabada de ARIA (public/aria-intro.mp3).
//
// Tone.js se carga aparte, mientras se ve la pantalla de arranque, para no
// engordar la carga inicial.

const VOICE_URL = `${import.meta.env.BASE_URL}aria-intro.mp3`;
const VOICE_GAIN = 7; // la grabación llega muy baja (pico de −23 dB)

let Tone = null;
let kit = null; // sintetizadores, una vez desbloqueado el audio
let voice = null; // HTMLAudioElement con la voz de ARIA

export const loading = import('tone')
  .then((module) => {
    Tone = module;
  })
  .catch((err) => console.warn('Tone.js no disponible: la cinemática irá sin blips.', err));

// Debe llamarse desde un gesto del usuario (el botón de arranque).
export async function unlock() {
  await loading;
  if (!Tone || kit) return;
  try {
    await Tone.start();
    const out = new Tone.Limiter(-3).toDestination();
    kit = {
      out,
      // Voz de las letras: onda cuadrada muy corta.
      blip: new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.01 }, volume: -20 }).connect(out),
      tones: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.5 }, volume: -12 }).connect(out),
      buzz: new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.05 }, volume: -14 }).connect(out),
      sweep: new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.4, decay: 0.2, sustain: 0.6, release: 0.8 }, volume: -18 }).connect(out),
    };
  } catch (err) {
    console.warn('Audio retro no disponible:', err);
  }
}

// Un blip por letra. El tono cambia un poco con cada carácter, como una voz.
export function blip(char) {
  if (!kit || char === ' ') return;
  const hz = 480 + ((char.charCodeAt(0) * 37) % 6) * 24;
  kit.blip.triggerAttackRelease(hz, 0.03);
}

export function right() {
  if (!kit) return;
  const now = Tone.now();
  kit.tones.triggerAttackRelease('E5', 0.12, now);
  kit.tones.triggerAttackRelease('B5', 0.22, now + 0.1);
}

export function wrong() {
  if (!kit) return;
  const now = Tone.now();
  kit.buzz.triggerAttackRelease('A2', 0.14, now);
  kit.buzz.triggerAttackRelease('G#2', 0.2, now + 0.16);
}

// Encendido de la cabina: un barrido que sube y un acorde que se abre.
export function powerOn() {
  if (!kit) return;
  const now = Tone.now();
  kit.sweep.triggerAttack('C2', now);
  kit.sweep.frequency.exponentialRampTo(523.25, 1.1, now);
  kit.sweep.triggerRelease(now + 1.2);
  ['C4', 'G4', 'C5', 'E5', 'G5'].forEach((note, i) => kit.tones.triggerAttackRelease(note, 1.4, now + 1.0 + i * 0.07));
}

// La voz grabada de ARIA. Devuelve el elemento de audio (para leer por dónde
// va), o null si no se pudo reproducir.
export function playVoice() {
  stopVoice();
  try {
    voice = new Audio(VOICE_URL);
    if (kit) {
      // Pasa por el contexto de Tone para poder subirle el volumen.
      const source = Tone.getContext().createMediaElementSource(voice);
      const boost = new Tone.Gain(VOICE_GAIN).connect(kit.out);
      Tone.connect(source, boost);
    }
    voice.play().catch((err) => console.warn('No se pudo reproducir la voz de ARIA:', err));
    return voice;
  } catch (err) {
    console.warn('Voz de ARIA no disponible:', err);
    voice = null;
    return null;
  }
}

// ¿Sigue sonando la voz grabada? Mientras dure, ARIA escribe sin blips.
export const voicePlaying = () => Boolean(voice && !voice.paused && !voice.ended);

export function stopVoice() {
  if (!voice) return;
  voice.pause();
  voice = null;
}
