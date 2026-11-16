import { useEffect, useRef } from 'react';
import { ANOMALIES } from '../data/anomalies.js';
import { telemetry } from '../state/telemetry.js';
import { scan, useScanner, toggleScanner, primaryAction, enterMuseum } from '../state/scanner.js';
import Oscilloscope from './Oscilloscope.jsx';
import SignalLog from './SignalLog.jsx';
import AnalyticsJukebox from './AnalyticsJukebox.jsx';
import DiscoveryMuseum from './DiscoveryMuseum.jsx';

const signed = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).padStart(5, '0')}°`;

function surface(t) {
  if (!t.onEarth) return 'Deep space';
  const lat = `${Math.abs(t.lat).toFixed(1)}°${t.lat >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(t.lon).toFixed(1)}°${t.lon >= 0 ? 'E' : 'W'}`;
  return `${lat}  ${lon}`;
}

// Botón que gira la órbita mientras se mantiene pulsado (ratón, dedo o teclado).
function OrbitButton({ dir, label, children }) {
  const hold = (value) => () => {
    telemetry.orbitButton = value;
  };
  return (
    <button
      type="button"
      className="btn btn-icon"
      aria-label={label}
      onPointerDown={hold(dir)}
      onPointerUp={hold(0)}
      onPointerLeave={hold(0)}
      onPointerCancel={hold(0)}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && hold(dir)()}
      onKeyUp={hold(0)}
      onBlur={hold(0)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export default function Hud() {
  const active = useScanner((s) => s.active);
  const audio = useScanner((s) => s.audio);
  const identified = useScanner((s) => s.identified);
  const openId = useScanner((s) => s.openId);
  const missions = useScanner((s) => s.missions);
  const museum = useScanner((s) => s.museum);
  const open = ANOMALIES.find((a) => a.id === openId);

  const az = useRef();
  const el = useRef();
  const zoom = useRef();
  const target = useRef();
  const reticle = useRef();
  const prompt = useRef();
  const hintArrow = useRef();
  const hintTag = useRef();

  useEffect(() => {
    let id;
    let lastPrompt = '';
    let lastDwell = -1;
    let lastHint = '';
    const tick = () => {
      az.current.textContent = signed(telemetry.az);
      el.current.textContent = signed(telemetry.el);
      zoom.current.textContent = `${(55 / telemetry.fov).toFixed(1)}×`;
      target.current.textContent = surface(telemetry);

      const classes = reticle.current.classList;
      classes.toggle('is-locked', telemetry.onEarth);
      classes.toggle('is-clear', scan.pending || scan.focus >= 0);
      const dwell = Math.round(scan.dwell * 100) / 100;
      if (dwell !== lastDwell) {
        lastDwell = dwell;
        reticle.current.style.setProperty('--dwell', dwell);
      }

      // Pista de ARIA: flecha alrededor de la retícula hacia la señal, o la
      // tecla que la trae si está en la cara oculta.
      const hint = scan.hint;
      let tag = '';
      if (hint.index >= 0) {
        if (hint.hidden) tag = `Far side · hold ${hint.hidden}`;
        else tag = hint.degrees < 2.5 ? 'On target' : `${Math.round(hint.degrees)}°`;
        const turn = hint.hidden ? (hint.hidden === 'Q' ? 0 : Math.PI) : -hint.angle;
        hintArrow.current.style.rotate = `${turn}rad`;
      }
      if (tag !== lastHint) {
        lastHint = tag;
        hintTag.current.textContent = tag;
        hintTag.current.hidden = !tag;
        hintArrow.current.hidden = !tag || tag === 'On target';
      }

      let text = '';
      if (scan.pending) text = 'Clear signal · hold the reticle or click';
      else if (scan.focus >= 0) text = `${ANOMALIES[scan.focus].short} · open analysis ⏎`;
      else if (telemetry.onHatch) text = 'Museum hatch · open ⏎';
      if (text !== lastPrompt) {
        lastPrompt = text;
        prompt.current.textContent = text;
        prompt.current.hidden = !text;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  // Tras un clic de ratón el botón suelta el foco, para que Espacio y Enter
  // vuelvan a ser del escáner. Con teclado (detail === 0) el foco se queda.
  const releaseFocus = (e) => {
    if (e.detail > 0) e.target.closest('button')?.blur();
  };

  let status = 'Orbital cabin · scanner on standby';
  if (active) {
    status = `Scanner active · ${identified.length} of ${ANOMALIES.length} signals identified`;
    if (!audio) status += ' · no audio';
  }

  return (
    <div className={`hud${open || museum ? ' has-panel' : ''}`} onClick={releaseFocus}>
      <header className="hud-top">
        <div className="hud-brand">
          <h1>Earth Jukebox</h1>
          <p>{status}</p>
        </div>
        <SignalLog />
      </header>

      <div ref={reticle} className="reticle" aria-hidden="true">
        <span className="reticle-dwell" />
        <span className="reticle-ring" />
        <span className="reticle-dot" />
        <span ref={hintArrow} className="reticle-hint" hidden />
      </div>
      <p ref={hintTag} className="hint-tag" hidden />
      <button ref={prompt} type="button" className="prompt" hidden onClick={primaryAction} />

      <footer className="hud-foot">
        <dl className="readouts">
          <div><dt>Azimuth</dt><dd ref={az}>+000.0°</dd></div>
          <div><dt>Elevation</dt><dd ref={el}>+000.0°</dd></div>
          <div><dt>Zoom</dt><dd ref={zoom}>1.0×</dd></div>
          <div className="wide"><dt>Under reticle</dt><dd ref={target}>—</dd></div>
        </dl>

        <Oscilloscope />

        <div className="controls">
          <div className="buttons">
            <button type="button" className="btn btn-scan" aria-pressed={active} onClick={toggleScanner}>
              {active ? 'Turn scanner off' : 'Turn scanner on'} <kbd>Space</kbd>
            </button>
            <button type="button" className="btn btn-museum" onClick={enterMuseum}>
              Museum · Earth Network <b>★ {missions.length}/{ANOMALIES.length}</b>
            </button>
            <div className="orbit" role="group" aria-label="Rotate the orbit">
              <OrbitButton dir={-1} label="Rotate orbit left (Q)">◀</OrbitButton>
              <span>Orbit</span>
              <OrbitButton dir={1} label="Rotate orbit right (E)">▶</OrbitButton>
            </div>
          </div>
          <p className="hint">
            Drag to look · scroll to zoom · arrows or WASD · Q/E rotate the orbit · Enter identifies · behind you, the museum hatch
          </p>
        </div>
      </footer>

      {museum && <DiscoveryMuseum />}
      {open && <AnalyticsJukebox anomaly={open} />}
    </div>
  );
}
