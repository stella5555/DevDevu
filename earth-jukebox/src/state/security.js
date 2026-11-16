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
    topic: 'Misión GEDI',
    text: '¿Qué región es crucial para almacenar carbono gracias a sus árboles gigantes?',
    options: ['El desierto del Sahara', 'Las selvas del Amazonas y el Congo', 'La tundra ártica'],
    answer: 1,
  },
  {
    topic: 'Telemetría ISS',
    text: '¿Dónde caen la mayoría de los rayos del planeta?',
    options: ['Sobre el océano abierto', 'En los polos', 'En tierra firme, en los trópicos'],
    answer: 2,
  },
  {
    topic: 'Aerosoles GEOS',
    text: '¿Qué viaja desde el Sahara para fertilizar la Amazonia?',
    options: ['Polvo mineral', 'Sal marina', 'Vapor de agua'],
    answer: 0,
  },
  {
    topic: 'Termodinámica',
    text: '¿Qué mueven principalmente corrientes como la del Golfo?',
    options: ['Hielo de los polos al ecuador', 'Calor del ecuador a los polos', 'Arena del fondo marino'],
    answer: 1,
  },
  {
    topic: 'CO₂',
    text: '¿Qué absorbe una cuarta parte de nuestro CO₂, además de los bosques?',
    options: ['Los desiertos', 'Las ciudades', 'El océano'],
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
