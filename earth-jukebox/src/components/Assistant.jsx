import { useEffect, useRef, useState } from 'react';
import { ANOMALIES } from '../data/anomalies.js';
import { DATASETS } from '../data/datasets.js';
import { telemetry } from '../state/telemetry.js';
import { scan, useScanner } from '../state/scanner.js';
import { say, useAssistant } from '../state/assistant.js';
import { ambient } from '../audio/ambient.js';
import { voicePlaying } from '../audio/retro.js';

// ARIA, la guía de a bordo. Vive por encima de la cabina, la estación y el
// museo: comenta lo que acaba de pasar y, a petición, da una pista.
//
// En la cabina se queda abierta; sobre la estación o el museo —y siempre en
// pantallas estrechas— se recoge sola a los pocos segundos de hablar, para no
// tapar lo que hay debajo.
//
// Habla como en Undertale: el texto se escribe solo, deprisa, con un blip por
// sílaba. Los blips salen por el canal de avisos del ambiente, así que callan
// con «Ambiente apagado», y esperan si aún suena la voz grabada del arranque.

const TYPE_MS = 22; // por letra
const BLIP_EVERY = 3; // un blip cada tres letras de una palabra: más o menos, una sílaba
const LETTER = /[\p{L}\p{N}]/u;
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
  const [typed, setTyped] = useState({ id: 0, count: 0 }); // letras ya escritas del mensaje `id`
  const [muted, setMuted] = useState(false);
  const rushed = useRef(0); // mensaje que el jugador ha pedido ver entero
  const openRef = useRef(open);
  openRef.current = open;
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
    else say('Energía restaurada: el onduloscopio vuelve a estar en línea. Activa el escáner con Espacio y pasea la mira sobre la Tierra: cuando la estática se vuelva música, hay una señal cerca.');
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
    let behind = 0; // segundos seguidos con la señal más fuerte tras el planeta
    let near = 0; // segundos seguidos con una señal fuerte sin fijar
    const id = setInterval(() => {
      if (overlay) {
        quiet = performance.now();
        return;
      }
      if (telemetry.onHatch) once('hatch', 'Esa es la escotilla del Museo de los Descubrimientos. Ábrela con Enter o con un clic.');
      // Estos dos consejos esperan unos segundos: no deben pisar al que
      // acaba de salir ni saltar por un roce de la mira.
      behind = scan.active && scan.hidden && scan.signal > 0.1 ? behind + 0.6 : 0;
      near = scan.active && !scan.hidden && scan.signal > 0.55 && !scan.pending && scan.focus < 0 ? near + 0.6 : 0;
      if (behind > 6) once('hidden', 'Esa señal tenue llega desde detrás del planeta. Mantén Q o E para girar la órbita hasta que asome.');
      else if (near > 3) once('close', 'Señal fuerte. Afina la mira hasta que la onda quede limpia y mantenla quieta 1,5 segundos.');
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

  // ── Plegado ──
  useEffect(() => {
    if (!message.id) return undefined;
    setOpen(true);
    const narrow = window.matchMedia('(max-width: 720px)').matches;
    const fold = overlay || narrow ? setTimeout(() => setOpen(false), FOLD_MS) : 0;
    return () => clearTimeout(fold);
  }, [message.id, overlay]);

  // ── Máquina de escribir con blips ──
  useEffect(() => {
    if (!message.id) return undefined;
    const { id, text } = message;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyped({ id, count: text.length });
      return undefined;
    }
    const t0 = performance.now();
    let last = 0;
    let run = 0; // letras seguidas de la palabra en curso
    const timer = setInterval(() => {
      const count = rushed.current === id ? text.length : Math.min(text.length, Math.floor((performance.now() - t0) / TYPE_MS) + 1);
      if (count === last) return;
      let voiced = '';
      for (let i = last; i < count; i++) {
        if (!LETTER.test(text[i])) run = 0;
        else if (run++ % BLIP_EVERY === 0) voiced = text[i];
      }
      // Sin blips si el jugador saltó el texto, si ARIA está plegada o la
      // pestaña oculta, ni encima de la voz grabada de la cinemática.
      if (voiced && rushed.current !== id && openRef.current && !document.hidden && !voicePlaying()) ambient.blip(voiced);
      last = count;
      setTyped({ id, count });
      if (count >= text.length) clearInterval(timer);
    }, TYPE_MS);
    return () => clearInterval(timer);
  }, [message.id]);

  // El ambiente se retira cuando suena otra cosa.
  useEffect(() => {
    ambient.setDuck(!booted || overlay ? 0 : active ? 0.4 : 1);
  }, [booted, overlay, active]);

  // La pantalla de arranque puede dejar el sonido apagado: el botón lo refleja.
  useEffect(() => {
    if (booted) setMuted(ambient.muted);
  }, [booted]);

  if (!booted) return null;

  const count = typed.id === message.id ? typed.count : 0;
  const speaking = count < message.text.length; // el indicador de voz se mueve mientras escribe

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
          {/* El lector de pantalla recibe el mensaje entero; el tecleo es visual.
              La parte aún sin escribir ocupa su sitio para que el panel no salte. */}
          <p className="sr-only" role="status">
            {message.text}
          </p>
          <p aria-hidden="true" onClick={() => (rushed.current = message.id)}>
            {message.text.slice(0, count)}
            <span style={{ visibility: 'hidden' }}>{message.text.slice(count)}</span>
          </p>
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
