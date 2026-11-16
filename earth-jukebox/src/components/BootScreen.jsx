import { useEffect, useRef, useState } from 'react';
import { ANOMALIES } from '../data/anomalies.js';
import { boot } from '../state/scanner.js';
import { ambient } from '../audio/ambient.js';

const TIPS = [
  {
    title: 'El onduloscopio',
    video: 'tip-escaner.mp4',
    text: 'Activa el escáner con Espacio y barre la Tierra con la mira. La estática se limpia y aparece música cuando te acercas a una señal.',
  },
  {
    title: 'Gira la órbita (Q / E)',
    video: 'tip-orbita.mp4',
    text: 'Las señales de la cara oculta llegan apagadas. Mantén Q o E para girar la órbita hasta que asomen por el borde del planeta.',
  },
  {
    title: 'Estaciones y misiones ★',
    video: 'tip-misiones.mp4',
    text: 'Cada señal abre una estación con su vídeo de la NASA y un reto distinto. Complétalo para ganar su estrella ★.',
  },
  {
    title: 'El Museo, a tu espalda',
    video: 'tip-museo.mp4',
    text: 'Gira 180° hacia atrás para ver la escotilla del Museo. Guarda la red que conecta los diez fenómenos.',
  },
  {
    title: 'ARIA te acompaña',
    video: 'tip-aria.mp4',
    text: 'Si te atascas buscando una señal, pídele una pista a ARIA arriba para que te indique hacia dónde mover la mira.',
  },
];

const SELF_CSS = `
.cinema-boot {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 9999 !important;
  box-sizing: border-box !important; /* sin esto el padding desplazaba todo 24 px a la derecha y abajo */
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 24px !important;
  margin: 0 !important;
  background: radial-gradient(circle at 50% 42%, rgba(16, 30, 58, 0.94) 0%, rgba(4, 7, 15, 0.98) 72%) !important;
  overflow: hidden !important;
  user-select: none;
}

.cinema-boot.is-leaving {
  opacity: 0 !important;
  pointer-events: none !important;
  transition: opacity 0.55s ease !important;
}

/* Barras de cine sutiles arriba y abajo */
.cinema-letterbox-top,
.cinema-letterbox-bottom {
  position: fixed;
  left: 0;
  right: 0;
  height: 36px;
  background: rgba(2, 4, 9, 0.9);
  border-color: rgba(89, 255, 200, 0.15);
  pointer-events: none;
  z-index: 2;
}
.cinema-letterbox-top { top: 0; border-bottom: 1px solid rgba(89, 255, 200, 0.15); }
.cinema-letterbox-bottom { bottom: 0; border-top: 1px solid rgba(89, 255, 200, 0.15); }

/* Botón de sonido exclusivo de la pantalla de carga (arriba a la derecha) */
.cinema-sound-btn {
  position: fixed !important;
  top: 52px !important;
  right: 32px !important;
  z-index: 20 !important;
  padding: 7px 16px !important;
  border-radius: 999px !important;
  border: 1px solid rgba(215, 227, 244, 0.25) !important;
  background: rgba(8, 13, 24, 0.85) !important;
  color: #93a8c6 !important;
  font-family: var(--font-data, monospace) !important;
  font-size: 0.75rem !important;
  letter-spacing: 0.08em !important;
  cursor: pointer !important;
}
.cinema-sound-btn.is-on {
  border-color: #59ffc8 !important;
  color: #59ffc8 !important;
  box-shadow: 0 0 14px rgba(89, 255, 200, 0.25) !important;
}

/* Escenas de introducción tipo película */
.cinema-scene {
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 820px;
  padding: 20px;
  animation: cinema-fade 2.8s ease-in-out forwards;
  cursor: pointer;
}

@keyframes cinema-fade {
  0% { opacity: 0; transform: scale(0.95) translateY(8px); filter: blur(4px); }
  20%, 80% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
  100% { opacity: 0; transform: scale(1.03) translateY(-6px); filter: blur(3px); }
}

.cinema-kicker {
  margin: 0 0 10px 0 !important;
  font-family: var(--font-data, monospace);
  font-size: 0.8rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: #59ffc8;
}

.cinema-studio-title {
  margin: 0 !important;
  font-size: clamp(2.2rem, 4.8vw, 3.8rem);
  font-weight: 800;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: #ffb454;
  text-shadow: 0 0 35px rgba(255, 180, 84, 0.35);
}

.cinema-main-title {
  margin: 8px 0 6px !important;
  font-size: clamp(2.4rem, 5vw, 4rem);
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #eef5ff;
  text-shadow: 0 0 40px rgba(89, 255, 200, 0.25);
}

.cinema-sub {
  margin: 8px 0 0 !important;
  font-size: 1rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #ffb454;
}

.cinema-quote {
  margin: 10px 0 22px !important;
  max-width: 560px;
  font-size: 0.98rem;
  font-style: italic;
  color: #9fb2ce;
}

.cinema-homage-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 8px 0 6px !important;
  font-size: clamp(2rem, 4.2vw, 3.3rem);
  font-weight: 800;
}
.cinema-homage-row .h-amber { color: #ffb454; text-shadow: 0 0 28px rgba(255, 180, 84, 0.3); }
.cinema-homage-row .h-amp { color: #7e93b3; font-weight: 300; }
.cinema-homage-row .h-cyan { color: #59ffc8; text-shadow: 0 0 28px rgba(89, 255, 200, 0.3); }

/* El zorrito grande tipo póster de película en la escena 3 (como en tu captura 2) */
.cinema-hero-fox {
  width: 210px !important;
  height: 210px !important;
  object-fit: contain !important;
  image-rendering: pixelated !important;
  filter: drop-shadow(0 12px 30px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 24px rgba(255, 180, 84, 0.35));
  animation: fox-breathe 2.2s ease-in-out infinite;
}

@keyframes fox-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-6px) scale(1.03); }
}

/* ── TUTORIAL: Centrado, limpio y sin hacer scroll ── */
.cinema-tips-wrap {
  position: relative;
  z-index: 5;
  width: min(740px, 88vw);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  animation: tips-appear 0.45s ease-out;
}

@keyframes tips-appear {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.cinema-tip-badge {
  padding: 3px 12px;
  border-radius: 999px;
  background: rgba(255, 180, 84, 0.12);
  border: 1px solid rgba(255, 180, 84, 0.5);
  font-family: var(--font-data, monospace);
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #ffb454;
}

.cinema-tip-title {
  margin: 2px 0 0 !important;
  font-size: 1.55rem;
  font-weight: 700;
  color: #eef5ff;
}

.cinema-tip-desc {
  margin: 0 !important;
  max-width: 620px;
  font-size: 0.92rem;
  line-height: 1.45;
  color: #a8bbd6;
}

.cinema-video-box {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #02040a;
  border: 1px solid rgba(89, 255, 200, 0.35);
  box-shadow: 0 20px 55px rgba(0, 0, 0, 0.78);
}

.cinema-video-el {
  display: block !important;
  width: 100% !important;
  height: min(46vh, 380px) !important;
  object-fit: contain !important;
  background: #02040a !important;
}

/* Línea de progreso del video abajo */
.cinema-timeline {
  height: 7px;
  background: rgba(255, 255, 255, 0.12);
  cursor: pointer;
  position: relative;
}
.cinema-timeline-fill {
  height: 100%;
  background: linear-gradient(90deg, #59ffc8, #ffb454);
  transition: width 0.08s linear;
}

/* Controles horizontales bien alineados */
.cinema-controls-row {
  width: 100%;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px;
  margin-top: 4px;
}

.cinema-btn {
  min-height: 40px !important;
  padding: 0 20px !important;
  border-radius: 4px !important;
  border: 1px solid rgba(215, 227, 244, 0.28) !important;
  background: rgba(10, 16, 30, 0.85) !important;
  color: #d7e3f4 !important;
  font-family: var(--font-data, monospace) !important;
  font-size: 0.8rem !important;
  cursor: pointer !important;
}
.cinema-btn-next {
  border-color: #ffb454 !important;
  background: rgba(255, 180, 84, 0.15) !important;
  color: #ffb454 !important;
  font-weight: 700 !important;
}
.cinema-btn-launch {
  border-color: #59ffc8 !important;
  background: rgba(89, 255, 200, 0.2) !important;
  color: #59ffc8 !important;
  font-weight: 700 !important;
  box-shadow: 0 0 22px rgba(89, 255, 200, 0.3) !important;
}

.cinema-dots-row {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 10px !important;
}
.cinema-dot {
  width: 10px !important;
  height: 10px !important;
  padding: 0 !important;
  border-radius: 50% !important;
  border: 0 !important;
  background: rgba(215, 227, 244, 0.25) !important;
  cursor: pointer !important;
}
.cinema-dot.is-seen { background: rgba(89, 255, 200, 0.6) !important; }
.cinema-dot.is-active {
  background: #ffb454 !important;
  transform: scale(1.3);
  box-shadow: 0 0 10px #ffb454;
}

/* ── ZORRITO FIJO EN LA ESQUINA DERECHA DURANTE TODO EL TUTORIAL (GIRA 360°) ── */
.cinema-corner-fox {
  position: fixed !important;
  right: 34px !important;
  bottom: 48px !important;
  z-index: 30 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 10px !important;
  pointer-events: none !important;
}

.cinema-fox-wheel {
  position: relative;
  width: 104px;
  height: 104px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle, rgba(16, 28, 52, 0.95) 45%, rgba(6, 10, 20, 0.98) 100%);
  border: 1.5px solid rgba(89, 255, 200, 0.45);
  box-shadow: 0 0 25px rgba(89, 255, 200, 0.25);
}

.cinema-fox-ring {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2.5px dashed #59ffc8;
  border-top-color: #ffb454;
  border-right-color: #ffb454;
  animation: fox-ring-spin 5s linear infinite;
}

.cinema-fox-spin360 {
  width: 68px !important;
  height: 68px !important;
  object-fit: contain !important;
  image-rendering: pixelated !important;
  animation: fox-spin-360 3.4s linear infinite !important;
}

@keyframes fox-spin-360 {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes fox-ring-spin {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

.cinema-loading-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-data, monospace);
  font-size: 0.74rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #59ffc8;
}

.cinema-wave-dots {
  display: inline-flex;
  gap: 4px;
}
.cinema-wave-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #59ffc8;
  box-shadow: 0 0 6px #59ffc8;
  animation: fox-dot-wave 1.2s ease-in-out infinite;
}
.cinema-wave-dots i:nth-child(2) { animation-delay: 0.2s; }
.cinema-wave-dots i:nth-child(3) { animation-delay: 0.4s; }

@keyframes fox-dot-wave {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
  40% { transform: translateY(-5px); opacity: 1; }
}

/* Pantallas estrechas: la mascota sube a la esquina superior izquierda, más
   pequeña, para no tapar los controles del tutorial. */
@media (max-width: 720px) {
  .cinema-corner-fox {
    top: 46px !important;
    left: 16px !important;
    right: auto !important;
    bottom: auto !important;
    flex-direction: row !important;
  }
  .cinema-fox-wheel { width: 52px; height: 52px; }
  .cinema-fox-ring { inset: -4px; border-width: 2px; }
  .cinema-fox-spin360 { width: 34px !important; height: 34px !important; }
  .cinema-loading-line { font-size: 0.62rem; }
  .cinema-video-el { height: min(34vh, 300px) !important; } /* deja sitio al aviso de audífonos */
  .cinema-controls-row { gap: 8px; }
  .cinema-btn { padding: 0 10px !important; font-size: 0.72rem !important; }
}
`;

function Emblem() {
  return (
    <svg width="110" height="110" viewBox="0 0 120 120" aria-hidden="true" style={{ color: '#59ffc8', marginBottom: 14 }}>
      <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
      <ellipse cx="60" cy="60" rx="54" ry="19" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.65" transform="rotate(-24 60 60)" />
      <circle cx="60" cy="60" r="24" fill="#081326" stroke="currentColor" strokeWidth="1.5" />
      <path d="M36 60 h8 l4 -12 l6 26 l6 -34 l6 30 l5 -14 l4 4 h9" fill="none" stroke="#59ffc8" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="106" cy="38" r="3.5" fill="#ffb454" />
    </svg>
  );
}

export default function BootScreen({ leaving }) {
  const [stage, setStage] = useState('studio'); // 'studio' -> 'title' -> 'homage' -> 'tips'
  const [assetsReady, setAssetsReady] = useState(false);
  const [tip, setTip] = useState(0);
  const [seenTips, setSeenTips] = useState(() => new Set([0]));
  const [bootAudioOn, setBootAudioOn] = useState(false);
  const [vidRatio, setVidRatio] = useState(0);

  const videoRef = useRef(null);
  const base = import.meta.env.BASE_URL;

  // Transiciones automáticas de película
  useEffect(() => {
    if (stage === 'studio') {
      const id = setTimeout(() => setStage('title'), 2800);
      return () => clearTimeout(id);
    }
    if (stage === 'title') {
      const id = setTimeout(() => setStage('homage'), 2800);
      return () => clearTimeout(id);
    }
    if (stage === 'homage') {
      const id = setTimeout(() => setStage('tips'), 2800);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [stage]);

  const advanceIntro = () => {
    if (stage === 'studio') setStage('title');
    else if (stage === 'title') setStage('homage');
    else if (stage === 'homage') setStage('tips');
  };

  useEffect(() => {
    setVidRatio(0);
    setSeenTips((prev) => {
      if (prev.has(tip)) return prev;
      const next = new Set(prev);
      next.add(tip);
      return next;
    });
  }, [tip]);

  // Controla el audio del video de los consejos
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !bootAudioOn;
    v.volume = 0.85;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }, [bootAudioOn, tip, stage]);

  const unlockVideoAudio = () => {
    const v = videoRef.current;
    if (v && bootAudioOn && v.muted) {
      v.muted = false;
      v.volume = 0.85;
    }
  };

  useEffect(() => {
    let alive = true;
    let count = 0;
    const done = () => {
      if (!alive) return;
      count += 1;
      if (count >= ANOMALIES.length) setAssetsReady(true);
    };
    ANOMALIES.forEach((a) => {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = `${base}svs/${a.svsId}.jpg`;
    });
    const patience = setTimeout(() => alive && setAssetsReady(true), 4500);
    return () => {
      alive = false;
      clearTimeout(patience);
    };
  }, [base]);

  const allTipsSeen = seenTips.size >= TIPS.length;
  const ready = assetsReady && allTipsSeen;

  const toggleBootAudio = (e) => {
    e.stopPropagation();
    const next = !bootAudioOn;
    setBootAudioOn(next);
    const v = videoRef.current;
    if (v) {
      v.muted = !next;
      v.volume = 0.85;
      if (next) v.play().catch(() => {});
    }
  };

  const launch = () => {
    if (videoRef.current) videoRef.current.pause();
    ambient.start();
    ambient.setMuted(!bootAudioOn);
    boot();
  };

  const handleTimeUpdate = (e) => {
    const v = e.currentTarget;
    if (v.duration > 0) {
      setVidRatio((v.currentTime / v.duration) * 100);
    }
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
  };

  return (
    <div
      className={`boot cinema-boot${leaving ? ' is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Pantalla de carga de Earth Information Jukebox"
      onClick={unlockVideoAudio}
    >
      <style>{SELF_CSS}</style>
      <div className="cinema-letterbox-top" aria-hidden="true" />
      <div className="cinema-letterbox-bottom" aria-hidden="true" />

      {/* Botón de Sonido exclusivo de esta pantalla */}
      <button
        type="button"
        className={`cinema-sound-btn${bootAudioOn ? ' is-on' : ''}`}
        aria-pressed={bootAudioOn}
        onClick={toggleBootAudio}
      >
        {bootAudioOn ? '🔊 Sonido ON' : '🔇 Silencio'}
      </button>

      {/* ESCENA 1: DEV DEVU PRESENTA */}
      {stage === 'studio' && (
        <div className="cinema-scene" key="studio" onClick={advanceIntro} role="presentation">
          <p className="cinema-kicker">NASA Space Apps Challenge · Crónicas Orbitales</p>
          <h1 className="cinema-studio-title">DEV DEVU PRESENTA</h1>
          <p className="cinema-quote">Una experiencia interactiva de sonificación planetaria</p>
        </div>
      )}

      {/* ESCENA 2: TÍTULO DE LA OBRA */}
      {stage === 'title' && (
        <div className="cinema-scene" key="title" onClick={advanceIntro} role="presentation">
          <Emblem />
          <p className="cinema-kicker">NASA Scientific Visualization Studio</p>
          <h1 className="cinema-main-title">Earth Information Jukebox</h1>
          <p className="cinema-sub">Sinfonía Orbital</p>
        </div>
      )}

      {/* ESCENA 3: HOMENAJE + EL ZORRITO EN GRANDE COMO TE GUSTÓ */}
      {stage === 'homage' && (
        <div className="cinema-scene" key="homage" onClick={advanceIntro} role="presentation">
          <p className="cinema-kicker">Inspirado en</p>
          <h2 className="cinema-homage-row">
            <span className="h-amber">Project Hail Mary</span>
            <span className="h-amp">&amp;</span>
            <span className="h-cyan">Outer Wilds</span>
          </h2>
          <p className="cinema-quote">
            «Explora el cosmos, escucha las anomalías y salva nuestro hogar, una nota a la vez.»
          </p>
          <img src={`${base}mascota.gif`} alt="Mascota Ryland Grace" className="cinema-hero-fox" />
        </div>
      )}

      {/* ESCENA 4: TUTORIAL DE 5 CONSEJOS */}
      {stage === 'tips' && (
        <div className="cinema-tips-wrap">
          <span className="cinema-tip-badge">Consejo {tip + 1} de {TIPS.length}</span>
          <h2 className="cinema-tip-title">{TIPS[tip].title}</h2>
          <p className="cinema-tip-desc">{TIPS[tip].text}</p>

          <div className="cinema-video-box">
            <video
              ref={videoRef}
              key={TIPS[tip].video}
              className="cinema-video-el"
              src={`${base}${TIPS[tip].video}`}
              autoPlay
              loop
              muted={!bootAudioOn}
              playsInline
              aria-label={`Vídeo de demostración: ${TIPS[tip].title}`}
              onTimeUpdate={handleTimeUpdate}
            />
            <div className="cinema-timeline" onClick={handleSeek} role="presentation" title="Adelantar o retroceder">
              <div className="cinema-timeline-fill" style={{ width: `${vidRatio}%` }} />
            </div>
          </div>

          <div className="cinema-controls-row">
            <button
              type="button"
              className="cinema-btn"
              onClick={() => setTip((tip + TIPS.length - 1) % TIPS.length)}
            >
              ‹ Anterior
            </button>

            <div className="cinema-dots-row">
              {TIPS.map((item, i) => (
                <button
                  key={item.title}
                  type="button"
                  className={`cinema-dot${i === tip ? ' is-active' : ''}${seenTips.has(i) ? ' is-seen' : ''}`}
                  onClick={() => setTip(i)}
                  aria-label={`Consejo ${i + 1}: ${item.title}`}
                  aria-current={i === tip ? 'step' : undefined}
                />
              ))}
            </div>

            {!ready ? (
              <button
                type="button"
                className="cinema-btn cinema-btn-next"
                onClick={() => setTip((tip + 1) % TIPS.length)}
              >
                Siguiente consejo ›
              </button>
            ) : (
              <button type="button" className="cinema-btn cinema-btn-launch" onClick={launch}>
                ▶ Iniciar experiencia
              </button>
            )}
          </div>

          {/* Aviso de audífonos, bajo los controles del tutorial */}
          <p
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              margin: '8px 0 0',
              fontSize: '0.74rem',
              letterSpacing: '0.1em',
              color: '#9fb2ce',
              fontFamily: 'var(--font-data, monospace)',
            }}
          >
            <img
              src={`${base}audifonos.png`}
              alt=""
              aria-hidden="true"
              style={{ width: '18px', height: '18px', objectFit: 'contain' }}
            />
            <span>Se recomienda usar audífonos y activar el sonido arriba a la derecha para la experiencia completa</span>
          </p>
        </div>
      )}

      {/* ZORRITO SIEMPRE PRESENTE EN LA ESQUINA DERECHA GIRANDO 360° */}
      <aside className="cinema-corner-fox" aria-hidden="true">
        <div className="cinema-fox-wheel">
          <span className="cinema-fox-ring" />
          <img src={`${base}mascota.gif`} alt="" className="cinema-fox-spin360" />
        </div>
        <div className="cinema-loading-line">
          <span>{ready ? 'Listo' : 'Cargando'}</span>
          <span className="cinema-wave-dots">
            <i /><i /><i />
          </span>
        </div>
      </aside>
    </div>
  );
}
