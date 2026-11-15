import { useSyncExternalStore } from 'react';
import { ambient } from '../audio/ambient.js';

// Lo que ARIA, la guía de a bordo, está diciendo. Cualquier parte de la app
// puede hacerla hablar con say(); el componente <Assistant> lo muestra.
let state = { id: 0, text: '', kind: 'info' };
const listeners = new Set();

// kind: 'info' mensaje de contexto · 'hint' pista pedida · 'win' logro
export function say(text, kind = 'info') {
  state = { id: state.id + 1, text, kind };
  ambient.chirp();
  listeners.forEach((notify) => notify());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAssistant() {
  return useSyncExternalStore(subscribe, () => state);
}
