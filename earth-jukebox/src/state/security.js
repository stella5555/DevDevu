import { useSyncExternalStore } from 'react';
import { authorize } from './scanner.js';
import { telemetry } from './telemetry.js';
import * as retro from '../audio/retro.js';

// Protocolo de seguridad: las 5 preguntas que desbloquean el onduloscopio.
// Se responden con los tres botones de la consola 3D, con sus equivalentes
// en pantalla o con las teclas 1, 2 y 3. Un fallo no penaliza: se reintenta.

export const BUTTON_COLORS = ['#ffb454', '#59ffc8', '#ff7ad9'];
export const BUTTON_LETTERS = ['A', 'B', 'C'];

export const QUESTIONS = [
  {
    topic: 'GEDI mission',
    text: 'Which region is crucial for storing carbon thanks to its giant trees?',
    options: ['The Sahara desert', 'The Amazon and Congo rainforests', 'The Arctic tundra'],
    answer: 1,
  },
  {
    topic: 'ISS telemetry',
    text: 'Where does most of the planet\'s lightning strike?',
    options: ['Over the open ocean', 'At the poles', 'Over land, in the tropics'],
    answer: 2,
  },
  {
    topic: 'GEOS aerosols',
    text: 'What travels from the Sahara to fertilize the Amazon?',
    options: ['Mineral dust', 'Sea salt', 'Water vapor'],
    answer: 0,
  },
  {
    topic: 'Thermodynamics',
    text: 'What do currents like the Gulf Stream mainly move?',
    options: ['Ice from the poles to the equator', 'Heat from the equator to the poles', 'Sand from the seafloor'],
    answer: 1,
  },
  {
    topic: 'CO₂',
    text: 'What absorbs a quarter of our CO₂, besides forests?',
    options: ['Deserts', 'Cities', 'The ocean'],
    answer: 2,
  },
];

const NEXT_MS = 750; // pausa tras un acierto antes de la siguiente pregunta
const POWER_MS = 1900; // lo que dura el encendido antes de entregar la cabina

// index: pregunta actual · picked: última opción pulsada · verdict: 'right' |
// 'wrong' | null · granted: las 5 acertadas, cabina encendiéndose
let state = { index: 0, picked: -1, verdict: null, granted: false };
const listeners = new Set();
let busy = false;

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((notify) => notify());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSecurity = () => state;
export const useSecurity = () => useSyncExternalStore(subscribe, () => state);

function grant() {
  busy = true;
  retro.stopVoice();
  retro.powerOn();
  telemetry.look = { yaw: 0, pitch: 0 }; // la mirada vuelve de la consola al ventanal
  set({ granted: true, verdict: 'right' });
  setTimeout(authorize, POWER_MS);
}

export function answer(option) {
  if (busy || state.granted) return;
  if (option !== QUESTIONS[state.index].answer) {
    retro.wrong();
    set({ picked: option, verdict: 'wrong' });
    return;
  }
  retro.right();
  set({ picked: option, verdict: 'right' });
  if (state.index === QUESTIONS.length - 1) return grant();
  busy = true;
  setTimeout(() => {
    busy = false;
    set({ index: state.index + 1, picked: -1, verdict: null });
  }, NEXT_MS);
}

// Modo jurado: da el protocolo por superado.
export function skipProtocol() {
  if (!state.granted) grant();
}

export function resetSecurity() {
  busy = false;
  set({ index: 0, picked: -1, verdict: null, granted: false });
}
