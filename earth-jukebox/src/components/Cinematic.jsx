import { useEffect, useRef, useState } from 'react';
import { startProtocol } from '../state/scanner.js';
import * as retro from '../audio/retro.js';

// El despertar de ARIA. Pantalla en negro, unos párpados que se abren y la
// "Terminal ARIA": el texto aparece letra a letra, con un blip por letra,
// mientras suena la voz grabada.
//
// Cada frase empieza cuando empieza en la grabación (los tiempos salen de las
// pausas del audio), así que texto y voz van juntos. Si el audio no puede
// sonar, el mismo guion corre con el reloj.

// [frase, segundo en que empieza en la grabación, milisegundos por letra]
const SCRIPT = [
  ['Alert.', 0.7, 70],
  ['Climate anomaly detected.', 1.95, 56],
  ['Navigation offline.', 4.1, 64],
  ['Commander: confirm your authorization on the console to unlock the onduloscope and restore the Earth system.', 5.85, 70],
];
const FULL = SCRIPT.map(([text]) => text).join(' ');
const EYES_MS = 2300; // lo que tardan en abrirse los párpados
const LINGER_MS = 1600; // pausa con el texto completo antes del protocolo
const VOICE_GRACE_MS = 1500; // lo que se espera a que arranque la voz antes de seguir con el reloj

// Cuántas letras del guion deben verse en el segundo t.
function lettersAt(t) {
  let shown = 0;
  for (const [text, start, pace] of SCRIPT) {
    const count = Math.max(0, Math.min(text.length, Math.floor(((t - start) * 1000) / pace) + 1));
    if (t < start) break;
    shown += count + (count === text.length ? 1 : 0); // + el espacio entre frases
  }
  return Math.min(FULL.length, shown);
}

export default function Cinematic() {
  const [awake, setAwake] = useState(false); // párpados abiertos: aparece la terminal
  const [shown, setShown] = useState(0);
  const rush = useRef(false); // el jugador ha pedido ver ya todo el texto
  const done = shown >= FULL.length;

  useEffect(() => {
    const id = setTimeout(() => setAwake(true), EYES_MS);
    return () => clearTimeout(id);
  }, []);

  // Tecleo, acompasado con la voz.
  useEffect(() => {
    if (!awake) return undefined;
    const voice = retro.playVoice();
    const t0 = performance.now();
    let last = 0;
    let frame;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      // Reloj: el del audio si suena. Si la voz tarda en arrancar se le da un
      // margen (sin avanzar el texto) y, si no llega, sigue el reloj del sistema.
      const waited = performance.now() - t0;
      const speaking = voice && !voice.paused && voice.currentTime > 0;
      const t = speaking ? voice.currentTime : Math.max(0, waited - VOICE_GRACE_MS) / 1000;
      // Nunca se borran letras ya escritas.
      const count = rush.current ? FULL.length : Math.max(last, lettersAt(t));
      if (count === last) return;
      if (!rush.current) retro.blip(FULL[count - 1]);
      last = count;
      setShown(count);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [awake]);

  // Con el texto completo, un respiro y al protocolo. La voz sigue sonando.
  useEffect(() => {
    if (!done) return undefined;
    const id = setTimeout(startProtocol, LINGER_MS);
    return () => clearTimeout(id);
  }, [done]);

  // Como en Undertale: una pulsación completa el texto; otra, continúa.
  const advance = () => {
    if (!awake) return;
    if (done) startProtocol();
    else rush.current = true;
  };
  useEffect(() => {
    const key = (e) => {
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      if (e.target instanceof Element && e.target.closest('button')) return;
      e.preventDefault();
      advance();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const skip = () => {
    retro.stopVoice();
    startProtocol();
  };

  return (
    <div className={`cinematic${awake ? ' is-awake' : ''}`} onClick={advance}>
      <div className="eyelid eyelid-top" aria-hidden="true" />
      <div className="eyelid eyelid-bottom" aria-hidden="true" />
      {awake && (
        <section className="terminal" aria-label="ARIA terminal">
          <header>
            <span className="terminal-face" aria-hidden="true">
              ◉
            </span>
            <b>ARIA</b>
            <span>Onboard terminal · backup power</span>
          </header>
          {/* El lector de pantalla recibe el mensaje entero; el tecleo es visual. */}
          <p className="sr-only" role="status">
            {FULL}
          </p>
          <p className="terminal-text" aria-hidden="true">
            <span>* </span>
            {FULL.slice(0, shown)}
            <i className="terminal-caret" />
          </p>
          <footer>
            <span>{done ? 'Opening the security protocol…' : 'Enter or click: show the whole message'}</span>
            <button
              type="button"
              className="btn"
              onClick={(e) => {
                e.stopPropagation();
                skip();
              }}
            >
              Skip ▸▸
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
