import { useSyncExternalStore } from 'react';
import { ANOMALIES } from '../data/anomalies.js';
import { onduloscope } from '../audio/onduloscope.js';
import { telemetry } from './telemetry.js';
import { ambient } from '../audio/ambient.js';
import * as retro from '../audio/retro.js';

// Lectura del escáner que <Scanner> escribe cada frame. Igual que telemetry:
// estado mutable que el HUD y los marcadores leen sin re-renders de React.
export const scan = {
  active: false,
  levels: new Float32Array(ANOMALIES.length), // intensidad 0..1 de cada señal
  signal: 0, // la más fuerte
  target: -1, // índice de la señal más fuerte (-1: ninguna)
  hidden: false, // la señal más fuerte está tras el horizonte
  pending: false, // señal clara y aún sin identificar: corre el temporizador
  dwell: 0, // 0..1, progreso de los 1.5 s con la mira centrada
  focus: -1, // índice de la anomalía ya identificada que está bajo la mira
  // Pista de ARIA: se pide con hintRequest y <Scanner> la resuelve y la mantiene.
  hintRequest: false,
  hint: {
    index: -1, // anomalía señalada (-1: sin pista activa)
    until: 0, // performance.now() en que caduca
    angle: 0, // hacia dónde mover la mira, en pantalla (rad; 0 derecha, π/2 arriba)
    degrees: 0, // cuánto falta
    hidden: null, // 'Q' o 'E' si está en la cara oculta: tecla que la trae
  },
};

// El progreso (señales identificadas y misiones completadas) sobrevive a
// recargar la página.
const STORAGE_KEY = 'jukebox-terrestre:identificadas';
const MISSIONS_KEY = 'jukebox-terrestre:misiones';
const AUTH_KEY = 'jukebox-terrestre:autorizado'; // protocolo de seguridad ya superado

function wasAuthorized() {
  try {
    return localStorage.getItem(AUTH_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberAuthorization(granted) {
  try {
    if (granted) localStorage.setItem(AUTH_KEY, '1');
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    // sin almacenamiento: el protocolo se repetirá en la próxima visita
  }
}

function loadProgress(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '[]');
    return ANOMALIES.map((a) => a.id).filter((id) => saved.includes(id));
  } catch {
    return []; // sin almacenamiento o dato corrupto: se empieza de cero
  }
}

function saveProgress(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // modo privado o almacenamiento lleno: el progreso vive solo en esta sesión
  }
}

// Estado discreto (cambia pocas veces): sí pasa por React.
let state = { active: false, audio: true, identified: loadProgress(STORAGE_KEY), missions: loadProgress(MISSIONS_KEY), openId: null, museum: false, hatch: false, phase: 'boot', booted: false };
// phase: 'boot' pantalla de arranque → 'intro' despertar de ARIA → 'quiz'
// protocolo de seguridad → 'live' cabina operativa (booted = true).
// hatch: la escotilla del museo se está abriendo.
const listeners = new Set();

function set(patch) {
  state = { ...state, ...patch };
  // La estación y el museo tienen su propio audio: el escáner calla mientras
  // cualquiera de los dos esté abierto.
  onduloscope.duck(state.openId !== null || state.museum);
  listeners.forEach((notify) => notify());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useScanner(selector) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export const isIdentified = (id) => state.identified.includes(id);
// Hay algo encima de la cabina: la pantalla de arranque, la estación o el museo.
export const isPanelOpen = () => !state.booted || state.openId !== null || state.museum || state.hatch;

// Fin de la pantalla de arranque. La primera vez sigue el despertar de ARIA y
// el protocolo de seguridad; si ya se superó en una visita anterior, la
// cabina queda operativa directamente.
export function boot() {
  if (state.phase !== 'boot') return;
  ambient.start();
  retro.unlock();
  set(wasAuthorized() ? { phase: 'live', booted: true } : { phase: 'intro' });
}

// Del mensaje de ARIA al protocolo de seguridad en la consola.
export function startProtocol() {
  if (state.phase === 'intro') set({ phase: 'quiz' });
}

// Protocolo superado: se enciende la cabina y se activa el módulo del escáner.
export function authorize() {
  if (state.phase === 'live') return;
  rememberAuthorization(true);
  set({ phase: 'live', booted: true });
}

// Llamar siempre desde un gesto del usuario: arranca el audio.
export function toggleScanner() {
  const active = !state.active;
  scan.active = active;
  if (active) {
    set({ active, audio: onduloscope.start() });
  } else {
    onduloscope.stop();
    set({ active });
  }
}

export function identify(id) {
  if (isIdentified(id)) return;
  onduloscope.confirm();
  const identified = [...state.identified, id];
  saveProgress(STORAGE_KEY, identified);
  set({ identified });
}

// La misión de la estación de una anomalía queda marcada como completada ★.
export function completeMission(id) {
  if (state.missions.includes(id)) return;
  const missions = [...state.missions, id];
  saveProgress(MISSIONS_KEY, missions);
  set({ missions });
}

export function openPanel(id) {
  if (isIdentified(id)) set({ openId: id });
}

export function closePanel() {
  if (state.openId) set({ openId: null });
}

// Pilar 3: el Museo de los Descubrimientos. La estación se puede abrir desde
// él y queda encima; al cerrarla se vuelve al museo.
export function openMuseum() {
  if (!state.museum) set({ museum: true });
}

export function closeMuseum() {
  if (state.museum) set({ museum: false });
}

// "Abrir museo" desde la cabina: primero la cinemática de la escotilla
// (<HatchCinematic>), que al terminar llama a openMuseum().
export function enterMuseum() {
  if (!state.booted || state.museum || state.hatch || state.openId) return;
  set({ hatch: true });
}

export function finishHatch() {
  if (state.hatch) set({ hatch: false });
}

// Esc: cierra lo que esté más arriba.
export function closeOverlay() {
  if (state.openId) closePanel();
  else closeMuseum();
}

// Modo jurado: identifica las 10 señales y da por completadas las 10 misiones,
// para evaluar el museo y la sinfonía sin jugar la partida entera.
export function unlockAll() {
  const all = ANOMALIES.map((a) => a.id);
  saveProgress(STORAGE_KEY, all);
  saveProgress(MISSIONS_KEY, all);
  set({ identified: all, missions: all });
}

// Vuelve al inicio de la exploración (para repetir la demo).
export function resetProgress() {
  closePanel();
  closeMuseum();
  scan.dwell = 0;
  saveProgress(STORAGE_KEY, []);
  saveProgress(MISSIONS_KEY, []);
  rememberAuthorization(false); // en la próxima visita, ARIA vuelve a pedir autorización
  set({ identified: [], missions: [] });
}

// Enter / botón bajo la mira: identifica la señal clara, abre su análisis o,
// mirando hacia atrás, abre la escotilla del museo.
export function primaryAction() {
  if (scan.pending) identify(ANOMALIES[scan.target].id);
  else if (scan.focus >= 0) openPanel(ANOMALIES[scan.focus].id);
  else if (telemetry.onHatch) enterMuseum();
}
