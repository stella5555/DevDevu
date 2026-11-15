import { useEffect, useRef, useState } from 'react';
import { ANOMALIES } from '../data/anomalies.js';
import { DATASETS } from '../data/datasets.js';
import { telemetry } from '../state/telemetry.js';
import { scan, useScanner } from '../state/scanner.js';
import { say, useAssistant } from '../state/assistant.js';
import { ambient } from '../audio/ambient.js';

// ARIA, la guía de a bordo. Vive por encima de la cabina, la estación y el
// museo: comenta lo que acaba de pasar y, a petición, da una pista.
//
// En la cabina se queda abierta; sobre la estación o el museo se recoge sola
// a los pocos segundos de hablar, para no tapar lo que hay debajo.

const SPEAK_MS = 2600; // cuánto se mueve el indicador de voz tras cada mensaje
const FOLD_MS = 9000;
const NUDGE_MS = 45000; // sin avances con el escáner encendido: ofrecer pista
const total = ANOMALIES.length;
const byId = Object.fromEntries(ANOMALIES.map((a) => [a.id, a]));

export default function Assistant() {
  const booted = useScanner((s) => s.booted);
  const active = useScanner((s) => s.active);
  const identified = useScanner((s) => s.identified);
  const missions = useScanner((s) => s.missions);
  const openId = useScanner((s) => s.openId);
  const museum = useScanner((s) => s.museum);
  const message = useAssistant();

  const [open, setOpen] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const seen = useRef({ identified: identified.length, missions: missions.length, firsts: new Set() });
  const overlay = openId !== null || museum;

  // Una sola vez por sesión para cada consejo de "primera vez".
  const once = (key, text, kind) => {
    if (seen.current.firsts.has(key)) return;
    seen.current.firsts.add(key);
    say(text, kind);
  };

  // ── Mensajes de contexto ──
  useEffect(() => {
    if (!booted) return;
    if (identified.length === total) say('Cabina encendida. Ya tienes las 10 señales: abre sus estaciones para completar las misiones ★ o visita el museo.');
    else if (identified.length) say(`Cabina encendida. Llevas ${identified.length} de ${total} señales. Activa el escáner con Espacio para seguir buscando, o pídeme una pista.`);
    else say('Te doy la bienvenida a bordo. Activa el escáner con Espacio y pasea la mira sobre la Tierra: cuando la estática se vuelva música, hay una señal cerca.');
  }, [booted]);

  useEffect(() => {
    if (active) once('scanner', 'Escáner activo. Guíate por el medidor de señal del onduloscopio: cuanto más limpia suena la onda, más cerca estás.');
  }, [active]);

  useEffect(() => {
    const before = seen.current;
    const gotSignals = identified.length - before.identified;
    const gotStars = missions.length - before.missions;
    before.identified = identified.length;
    before.missions = missions.length;
    if (!booted) return;
    if (gotSignals > 1 && gotStars > 1) {
      say('Modo jurado: las 10 señales identificadas y las 10 misiones con ★. El museo y la Sinfonía Planetaria están completos.', 'win');
    } else if (gotStars > 0) {
      const left = total - missions.length;
      say(left ? `★ Misión completada. Te quedan ${left}. La escotilla del museo brilla un poco más y la sinfonía gana un instrumento.` : '★ Las 10 misiones completadas. Ve al museo y escucha la Sinfonía Planetaria al completo.', 'win');
    } else if (gotSignals > 0) {
      const found = byId[identified[identified.length - 1]];
      const left = total - identified.length;
      say(`Señal identificada: ${found.short}. Pulsa Enter sobre su baliza para abrir su estación.${left ? ` Quedan ${left} por encontrar.` : ' ¡Ya tienes las 10!'}`, 'win');
    } else if (gotSignals < 0) {
      say('Exploración reiniciada. Volvemos a empezar: activa el escáner y busca la primera señal.');
    }
  }, [identified, missions]);

  useEffect(() => {
    if (!openId) return;
    const anomaly = byId[openId];
    const mission = DATASETS[openId].mission;
    say(`Estación de ${anomaly.short}. Pulsa «Sintonizar» para oír el vídeo. ${missions.includes(openId) ? 'Su misión ya tiene ★, pero puedes repetirla.' : `Misión: ${mission.title}.`}`);
  }, [openId]);

  useEffect(() => {
    if (museum) say(missions.length ? 'Museo de los Descubrimientos. Pulsa un nodo o un hilo para leerlo, y prueba la Sinfonía Planetaria: suenan los nodos que ya tienen ★.' : 'Museo de los Descubrimientos. Aún no hay ★: cada misión que completes encenderá un nodo y sumará un instrumento a la sinfonía.');
  }, [museum]);

  // Lo que pasa en la cabina frame a frame se mira de vez en cuando.
  useEffect(() => {
    if (!booted) return undefined;
    let quiet = performance.now();
    let found = identified.length;
    const id = setInterval(() => {
      if (overlay) {
        quiet = performance.now();
        return;
      }
      if (telemetry.onHatch) once('hatch', 'Esa es la escotilla del Museo de los Descubrimientos. Ábrela con Enter o con un clic.');
      if (scan.active && scan.hidden && scan.signal > 0.08) once('hidden', 'Esa señal llega desde detrás del planeta. Mantén Q o E para girar la órbita hasta que asome.');
      else if (scan.active && scan.signal > 0.55 && scan.pending === false && scan.focus < 0) once('close', 'Señal fuerte. Afina la mira hasta que la onda quede limpia y mantenla quieta 1,5 segundos.');
      if (identified.length !== found || !scan.active) {
        found = identified.length;
        quiet = performance.now();
      } else if (performance.now() - quiet > NUDGE_MS && identified.length < total) {
        quiet = performance.now();
        say('¿Cuesta dar con la siguiente? Pulsa «Pedir pista» y te marco la señal sin identificar más cercana.');
      }
    }, 600);
    return () => clearInterval(id);
  }, [booted, overlay, identified]);

  // ── Indicador de voz y plegado ──
  useEffect(() => {
    if (!message.id) return undefined;
    setSpeaking(true);
    setOpen(true);
    const quiet = setTimeout(() => setSpeaking(false), SPEAK_MS);
    const fold = overlay ? setTimeout(() => setOpen(false), FOLD_MS) : 0;
    return () => {
      clearTimeout(quiet);
      clearTimeout(fold);
    };
  }, [message.id, overlay]);

  // El ambiente se retira cuando suena otra cosa.
  useEffect(() => {
    ambient.setDuck(overlay ? 0 : active ? 0.4 : 1);
  }, [overlay, active]);

  if (!booted) return null;

  // El botón de pista hace lo que toca en cada vista.
  const hint = () => {
    if (openId) {
      const mission = DATASETS[openId].mission;
      say(`Misión «${mission.title}»: ${mission.brief} Si el objetivo se mueve, congela el vídeo.`, 'hint');
    } else if (museum) {
      say('En el museo: gira la red arrastrando, pulsa un nodo para ver quién lo mide y qué se descubrió, y un hilo para leer cómo se conectan dos fenómenos. Abajo a la derecha tienes las listas completas.', 'hint');
    } else {
      scan.hintRequest = true; // <Scanner> la resuelve en el siguiente frame y me dicta la pista
    }
  };
  const toggleSound = () => {
    ambient.setMuted(!muted);
    setMuted(!muted);
  };

  return (
    <aside className={`aria${open ? ' is-open' : ''}${speaking ? ' is-speaking' : ''} is-${message.kind}`} aria-label="ARIA, guía de a bordo">
      <button type="button" className="aria-tab" aria-expanded={open} onClick={() => setOpen(!open)} title={open ? 'Plegar a ARIA' : 'Desplegar a ARIA'}>
        <span className="aria-wave" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <b>ARIA</b>
        <span>Guía EIC</span>
      </button>
      {open && (
        <div className="aria-body">
          <p role="status">{message.text}</p>
          <div className="aria-actions">
            <button type="button" className="btn aria-hint" onClick={hint}>
              {openId ? 'Recordar la misión' : museum ? '¿Qué hago aquí?' : 'Pedir pista · triangular señal'}
            </button>
            <button type="button" className="btn" aria-pressed={!muted} onClick={toggleSound} title="Zumbido de cabina y avisos de ARIA">
              Ambiente {muted ? 'apagado' : 'encendido'}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
