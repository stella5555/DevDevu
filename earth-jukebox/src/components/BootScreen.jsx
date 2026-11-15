import { useEffect, useRef, useState } from 'react';
import { ANOMALIES } from '../data/anomalies.js';
import { boot } from '../state/scanner.js';
import { ambient } from '../audio/ambient.js';

// Pantalla de arranque: precarga los pósters del SVS mientras enseña los
// consejos de operación. El botón "Iniciar secuencia orbital" es el gesto
// que desbloquea el audio, arranca el ambiente y enciende la cabina.

const TIPS = [
  {
    title: 'El onduloscopio',
    text: 'Activa el escáner con Espacio y barre la Tierra con la mira. La estática se limpia y aparece música cuando te acercas a una señal: mantén la mira 1,5 s sobre ella para identificarla.',
  },
  {
    title: 'Gira la órbita',
    text: 'Las señales de la cara oculta llegan apagadas. Mantén Q o E para girar la órbita hasta que asomen por el borde del planeta.',
  },
  {
    title: 'Estaciones y misiones ★',
    text: 'Cada señal identificada abre una estación con su vídeo de la NASA y una misión distinta: una boya, una sonda, un viaje en el tiempo… Complétala para ganar su ★.',
  },
  {
    title: 'La escotilla, a tu espalda',
    text: 'Gira 180° y verás la escotilla del Museo. Se ilumina con cada ★ y guarda la red que conecta los diez fenómenos y la Sinfonía Planetaria.',
  },
  {
    title: 'ARIA te acompaña',
    text: 'La guía de a bordo vive en la parte alta de la pantalla. Si te atascas, pídele una pista: señalará la señal sin identificar más cercana.',
  },
];
const TIP_MS = 5200;
const PATIENCE_MS = 8000; // si un póster no llega, no se bloquea la entrada

function Emblem() {
  return (
    <svg className="boot-emblem" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <ellipse cx="60" cy="60" rx="56" ry="20" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" transform="rotate(-24 60 60)" />
      <circle cx="60" cy="60" r="26" fill="#0b1a33" stroke="currentColor" strokeWidth="1.5" />
      <path d="M36 60 h8 l4 -12 l6 26 l6 -34 l6 30 l5 -14 l4 4 h9" fill="none" stroke="#59ffc8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="108" cy="38" r="3.5" fill="#ffb454" />
    </svg>
  );
}

export default function BootScreen({ leaving }) {
  const [loaded, setLoaded] = useState(0);
  const [log, setLog] = useState([`Catálogo: ${ANOMALIES.length} recursos del NASA SVS`]);
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState(0);
  const [held, setHeld] = useState(false); // el carrusel se detiene bajo el puntero o el foco
  const start = useRef();
  const total = ANOMALIES.length;

  // Precarga de los pósters: quedan en caché para las estaciones y el museo.
  useEffect(() => {
    let alive = true;
    const done = (a, ok) => {
      if (!alive) return;
      setLoaded((n) => n + 1);
      setLog((lines) => [...lines, `SVS #${a.svsId} · ${a.short} · ${ok ? 'póster listo' : 'sin póster, se usará la reserva'}`].slice(-4));
    };
    ANOMALIES.forEach((a) => {
      const img = new Image();
      img.onload = () => done(a, true);
      img.onerror = () => done(a, false);
      img.src = `${import.meta.env.BASE_URL}svs/${a.svsId}.jpg`;
    });
    const patience = setTimeout(() => alive && setReady(true), PATIENCE_MS);
    return () => {
      alive = false;
      clearTimeout(patience);
    };
  }, []);

  useEffect(() => {
    if (loaded >= total) setReady(true);
  }, [loaded, total]);

  useEffect(() => {
    if (ready) start.current?.focus();
  }, [ready]);

  // Carrusel de consejos: avanza solo, salvo con movimiento reducido.
  useEffect(() => {
    if (held || leaving || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = setInterval(() => setTip((i) => (i + 1) % TIPS.length), TIP_MS);
    return () => clearInterval(id);
  }, [held, leaving]);

  const launch = () => {
    ambient.start(); // el gesto que desbloquea el audio
    boot();
  };

  const percent = Math.round((Math.min(loaded, total) / total) * 100);

  return (
    <div className={`boot${leaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-labelledby="boot-title">
      <div className="boot-card">
        <header>
          <Emblem />
          <div>
            <p className="boot-kicker">Misión</p>
            <h1 id="boot-title">Earth Information Jukebox</h1>
            <p className="boot-sub">Jukebox Terrestre · datos del NASA Scientific Visualization Studio</p>
          </div>
        </header>

        <section className="boot-status" aria-label="Estado de la carga">
          <div className="boot-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent} aria-label="Precarga de recursos">
            <i style={{ width: `${percent}%` }} />
          </div>
          <p className="boot-percent">
            {ready ? 'Sistemas listos' : 'Sincronizando con el SVS'} · {Math.min(loaded, total)}/{total} · {percent} %
          </p>
          <ul aria-hidden="true">
            {log.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section
          className="boot-tips"
          aria-label="Consejos de operación"
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
        >
          <h2>
            Consejos de operación <span>{tip + 1}/{TIPS.length}</span>
          </h2>
          <div className="boot-tip" key={tip} aria-live="polite">
            <h3>{TIPS[tip].title}</h3>
            <p>{TIPS[tip].text}</p>
          </div>
          <div className="boot-dots">
            <button type="button" className="btn btn-icon" aria-label="Consejo anterior" onClick={() => setTip((tip + TIPS.length - 1) % TIPS.length)}>
              ‹
            </button>
            {TIPS.map((item, i) => (
              <button
                key={item.title}
                type="button"
                className="boot-dot"
                aria-label={`Consejo ${i + 1}: ${item.title}`}
                aria-current={i === tip}
                onClick={() => setTip(i)}
              />
            ))}
            <button type="button" className="btn btn-icon" aria-label="Consejo siguiente" onClick={() => setTip((tip + 1) % TIPS.length)}>
              ›
            </button>
          </div>
        </section>

        <button ref={start} type="button" className="btn boot-start" disabled={!ready || leaving} onClick={launch}>
          {ready ? '▶ Iniciar secuencia orbital' : 'Preparando la cabina…'}
        </button>
        <p className="boot-note">Con sonido: al iniciar se activa el audio de a bordo.</p>
      </div>
    </div>
  );
}
