import { useEffect, useRef } from 'react';
import { ANOMALIES, CATEGORIES } from '../data/anomalies.js';
import { onduloscope } from '../audio/onduloscope.js';
import { scan, isIdentified } from '../state/scanner.js';

// Onduloscopio del HUD: dibuja en vivo la forma de onda que sale por los
// altavoces (AnalyserNode). Lejos de toda señal es estática pura; al acercar
// la mira la traza se ordena hasta mostrar la onda limpia de la misión.
const SAMPLES = 2048;
const SPAN = 900; // muestras visibles (~19 ms a 48 kHz)
const GAIN = 2.4; // amplificación vertical de la traza
const IDLE = [127, 143, 168];
const SCOPE = [89, 255, 200];

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function describe(known) {
  if (!scan.active) return 'Standby';
  if (scan.target < 0 || scan.signal < 0.06) return 'Static only';
  if (known && scan.signal > 0.5) return ANOMALIES[scan.target].short;
  if (scan.hidden) return 'Signal beyond the horizon';
  if (scan.pending) return 'Clear signal · locking';
  return scan.signal < 0.45 ? 'Weak signal' : 'Emerging signal';
}

// Sin audio disponible, la traza se sintetiza con la misma lógica.
function synthesize(data, seconds) {
  const s = scan.signal;
  const hz = scan.target >= 0 ? ANOMALIES[scan.target].signal.hz : 220;
  const noise = scan.active ? 0.02 + 0.3 * (1 - s) : 0.003;
  const tone = scan.active ? 0.28 * s : 0;
  for (let i = 0; i < SAMPLES; i++) {
    data[i] = (Math.random() * 2 - 1) * noise + tone * Math.sin((Math.PI * 2 * hz * i) / 48000 + seconds * 6);
  }
}

export default function Oscilloscope() {
  const canvas = useRef();
  const label = useRef();
  const percent = useRef();
  const meter = useRef();

  useEffect(() => {
    const el = canvas.current;
    const g = el.getContext('2d');
    const data = new Float32Array(SAMPLES);
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.max(1, Math.round(el.clientWidth * dpr));
      el.height = Math.max(1, Math.round(el.clientHeight * dpr));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    let id;
    let shown = 0; // intensidad suavizada, para el color y el medidor
    let lastLabel = '';
    let lastPercent = -1;
    let lastMs = 0;
    const tick = (ms) => {
      id = requestAnimationFrame(tick);
      const { width: w, height: h } = el;
      const known = scan.target >= 0 && isIdentified(ANOMALIES[scan.target].id);
      const dt = Math.min((ms - lastMs) / 1000, 0.1);
      lastMs = ms;
      shown += (scan.signal - shown) * (1 - Math.exp(-dt * 14));

      if (!onduloscope.waveform(data)) synthesize(data, ms / 1000);
      // Disparo en el cruce por cero ascendente: con señal clara la onda se queda quieta.
      let start = 0;
      if (shown > 0.35) {
        for (let i = 1; i < SAMPLES - SPAN; i++) {
          if (data[i - 1] < 0 && data[i] >= 0) {
            start = i;
            break;
          }
        }
      }

      g.clearRect(0, 0, w, h);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(89, 255, 200, 0.1)';
      g.beginPath();
      for (let i = 1; i < 8; i++) {
        const x = Math.round((w * i) / 8) + 0.5;
        g.moveTo(x, 0);
        g.lineTo(x, h);
      }
      for (let i = 1; i < 4; i++) {
        const y = Math.round((h * i) / 4) + 0.5;
        g.moveTo(0, y);
        g.lineTo(w, y);
      }
      g.stroke();

      // La traza pasa de gris a verde con la señal; identificada, toma su color.
      const to = known ? hexToRgb(CATEGORIES[ANOMALIES[scan.target].category].color) : SCOPE;
      const rgb = IDLE.map((c, i) => Math.round(c + (to[i] - c) * shown));
      g.strokeStyle = `rgba(${rgb.join(', ')}, ${0.7 + 0.3 * shown})`;
      g.shadowColor = `rgb(${rgb.join(', ')})`;
      g.shadowBlur = 10 * shown * dpr;
      g.lineWidth = 1.4 * dpr;
      g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < SPAN; i++) {
        const v = Math.max(-1, Math.min(1, data[start + i] * GAIN));
        const x = (i / (SPAN - 1)) * w;
        const y = h / 2 - v * h * 0.46;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.shadowBlur = 0;

      const text = describe(known);
      if (text !== lastLabel) {
        label.current.textContent = lastLabel = text;
      }
      const pct = Math.round(shown * 100);
      if (pct !== lastPercent) {
        lastPercent = pct;
        percent.current.textContent = `${pct}%`;
        meter.current.style.width = `${pct}%`;
      }
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, []);

  return (
    <section className="scope" aria-label="Onduloscope">
      <header>
        <h2>Onduloscope</h2>
        <p ref={label} role="status">Standby</p>
      </header>
      <canvas ref={canvas} aria-hidden="true" />
      <div className="scope-meter">
        <span>Signal</span>
        <div className="meter"><i ref={meter} /></div>
        <span ref={percent} className="scope-percent">0%</span>
      </div>
    </section>
  );
}
