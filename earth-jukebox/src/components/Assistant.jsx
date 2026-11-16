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
    if (identified.length === total) say('Cabin powered up. You already have all 10 signals: open their stations to complete the ★ missions or visit the museum.');
    else if (identified.length) say(`Cabin powered up. You have ${identified.length} of ${total} signals. Turn on the scanner with Space to keep searching, or ask me for a hint.`);
    else say('Power restored: the onduloscope is back online. Turn on the scanner with Space and sweep the reticle over the Earth: when the static turns into music, a signal is near.');
  }, [booted]);

  useEffect(() => {
    if (active) once('scanner', 'Scanner active. Follow the signal meter on the onduloscope: the cleaner the wave sounds, the closer you are.');
  }, [active]);

  useEffect(() => {
    const before = seen.current;
    const gotSignals = identified.length - before.identified;
    const gotStars = missions.length - before.missions;
    before.identified = identified.length;
    before.missions = missions.length;
    if (!booted) return;
    if (gotSignals > 1 && gotStars > 1) {
      say('Jury mode: all 10 signals identified and all 10 missions with ★. The museum and the Planetary Symphony are complete.', 'win');
    } else if (gotStars > 0) {
      const left = total - missions.length;
      say(left ? `★ Mission complete. ${left} to go. The museum hatch glows a little brighter and the symphony gains an instrument.` : '★ All 10 missions complete. Go to the museum and listen to the full Planetary Symphony.', 'win');
    } else if (gotSignals > 0) {
      const found = byId[identified[identified.length - 1]];
      const left = total - identified.length;
      say(`Signal identified: ${found.short}. Press Enter on its beacon to open its station.${left ? ` ${left} left to find.` : ' You have all 10!'}`, 'win');
    } else if (gotSignals < 0) {
      say('Exploration restarted. Starting over: turn on the scanner and look for the first signal.');
    }
  }, [identified, missions]);

  useEffect(() => {
    if (!openId) return;
    const anomaly = byId[openId];
    const mission = DATASETS[openId].mission;
    say(`${anomaly.short} station. Press “Tune in” to hear the video. ${missions.includes(openId) ? 'Its mission already has a ★, but you can replay it.' : `Mission: ${mission.title}.`}`);
  }, [openId]);

  useEffect(() => {
    if (museum) say(missions.length ? 'Museum of Discoveries. Select a node or a thread to read it, and try the Planetary Symphony: the nodes that already have a ★ play.' : 'Museum of Discoveries. No ★ yet: each mission you complete will light a node and add an instrument to the symphony.');
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
      if (telemetry.onHatch) once('hatch', 'That is the hatch of the Museum of Discoveries. Open it with Enter or a click.');
      // Estos dos consejos esperan unos segundos: no deben pisar al que
      // acaba de salir ni saltar por un roce de la mira.
      behind = scan.active && scan.hidden && scan.signal > 0.1 ? behind + 0.6 : 0;
      near = scan.active && !scan.hidden && scan.signal > 0.55 && !scan.pending && scan.focus < 0 ? near + 0.6 : 0;
      if (behind > 6) once('hidden', 'That faint signal comes from behind the planet. Hold Q or E to rotate the orbit until it comes into view.');
      else if (near > 3) once('close', 'Strong signal. Fine-tune the reticle until the wave is clean and hold it still for 1.5 seconds.');
      if (identified.length !== found || !scan.active) {
        found = identified.length;
        quiet = performance.now();
      } else if (performance.now() - quiet > NUDGE_MS && identified.length < total) {
        quiet = performance.now();
        say('Having trouble finding the next one? Press “Ask for a hint” and I will mark the nearest unidentified signal.');
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
      say(`Mission “${mission.title}”: ${mission.brief} If the target moves, freeze the video.`, 'hint');
    } else if (museum) {
      say('In the museum: drag to rotate the network, select a node to see who measures it and what was discovered, and a thread to read how two phenomena connect. The full lists are at the bottom right.', 'hint');
    } else {
      scan.hintRequest = true; // <Scanner> la resuelve en el siguiente frame y me dicta la pista
    }
  };
  const toggleSound = () => {
    ambient.setMuted(!muted);
    setMuted(!muted);
  };

  return (
    <aside className={`aria${open ? ' is-open' : ''}${speaking ? ' is-speaking' : ''} is-${message.kind}`} aria-label="ARIA, onboard guide">
      <button type="button" className="aria-tab" aria-expanded={open} onClick={() => setOpen(!open)} title={open ? 'Collapse ARIA' : 'Expand ARIA'}>
        <span className="aria-wave" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <b>ARIA</b>
        <span>EIC Guide</span>
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
              {openId ? 'Recall the mission' : museum ? 'What do I do here?' : 'Ask for a hint · triangulate signal'}
            </button>
            <button type="button" className="btn" aria-pressed={!muted} onClick={toggleSound} title="Cabin hum and ARIA sounds">
              Ambient {muted ? 'off' : 'on'}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
