import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SLOT_COLORS } from '../../audio/jukebox.js';

// Histograma vivo de los 4 fenómenos: cuántos píxeles del fotograma actual
// tienen cada intensidad (de "apenas" a "de lleno"). Los píxeles donde el
// fenómeno no aparece quedan fuera. El eje vertical es logarítmico porque las
// zonas tenues son muchísimo más extensas que los núcleos.
//
// Los colores son los de las pistas del mezclador, validados para daltonismo
// sobre el fondo del panel; la cuarta pista es neutra a propósito y se
// distingue por su relleno.

const PAD = { left: 34, right: 8, top: 8, bottom: 20 };
const INK = '#d7e3f4';
const INK_DIM = '#7f8fa8';
const GRID = 'rgba(215, 227, 244, 0.1)';
const ORDER = [3, 2, 1, 0]; // la neutra con relleno va debajo
const BINS = 32; // tramos de intensidad: 8 niveles de 255 cada uno
const binOf = (level) => Math.min(BINS - 1, (level - 1) >> 3);

// Píxeles de un fenómeno en cada tramo de intensidad (el nivel 0, "no
// aparece", queda fuera).
function binned(counts) {
  const out = new Float64Array(BINS);
  for (let level = 1; level < 256; level++) out[binOf(level)] += counts[level];
  return out;
}
const compact = (n) => (n >= 1000 ? `${n / 1000}K` : String(n));

// Con `bare` no pone marco ni título: va dentro de DatasetChart.
const Histogram = forwardRef(function Histogram({ layers, bare = false }, ref) {
  const canvas = useRef();
  const data = useRef({ hist: null, marker: null, total: 1 });
  const [hover, setHover] = useState(null); // tramo 0..31 bajo el puntero

  const draw = useCallback(() => {
    const el = canvas.current;
    const { hist, marker } = data.current;
    if (!el || !hist) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) {
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
    }
    const g = el.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;

    const series = hist.map(binned);
    let max = 10;
    for (const bins of series) for (const count of bins) if (count > max) max = count;
    const ceiling = Math.log10(max + 1);
    const x = (bin) => PAD.left + ((bin + 0.5) / BINS) * plotW;
    const y = (count) => PAD.top + plotH * (1 - Math.log10(count + 1) / ceiling);

    // Rejilla y ejes: décadas de píxeles en vertical, intensidad en horizontal.
    g.font = "10px 'JetBrains Mono', ui-monospace, monospace";
    g.fillStyle = INK_DIM;
    g.strokeStyle = GRID;
    g.lineWidth = 1;
    g.textBaseline = 'middle';
    g.textAlign = 'right';
    for (let decade = 10; Math.log10(decade + 1) <= ceiling; decade *= 10) {
      const py = Math.round(y(decade)) + 0.5;
      g.beginPath();
      g.moveTo(PAD.left, py);
      g.lineTo(width - PAD.right, py);
      g.stroke();
      g.fillText(compact(decade), PAD.left - 6, py);
    }
    g.textBaseline = 'top';
    [0, 25, 50, 75, 100].forEach((percent, i, all) => {
      g.textAlign = i === 0 ? 'left' : i === all.length - 1 ? 'right' : 'center';
      g.fillText(`${percent} %`, PAD.left + (percent / 100) * plotW, height - PAD.bottom + 6);
    });
    g.beginPath();
    g.moveTo(PAD.left, PAD.top + plotH + 0.5);
    g.lineTo(width - PAD.right, PAD.top + plotH + 0.5);
    g.stroke();

    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (const k of ORDER) {
      const bins = series[k];
      g.beginPath();
      for (let bin = 0; bin < BINS; bin++) {
        if (bin === 0) g.moveTo(x(bin), y(bins[bin]));
        else g.lineTo(x(bin), y(bins[bin]));
      }
      g.strokeStyle = SLOT_COLORS[k];
      g.lineWidth = 2;
      g.stroke();
      if (k === 3) {
        g.lineTo(x(BINS - 1), PAD.top + plotH);
        g.lineTo(x(0), PAD.top + plotH);
        g.closePath();
        g.globalAlpha = 0.1;
        g.fillStyle = SLOT_COLORS[k];
        g.fill();
        g.globalAlpha = 1;
      }
    }

    // Intensidad media, en la franja que suena, del fenómeno que la domina.
    if (marker !== null) {
      const px = Math.round(PAD.left + Math.min(1, marker) * plotW) + 0.5;
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px, PAD.top);
      g.lineTo(px, PAD.top + plotH);
      g.stroke();
      g.fillStyle = INK;
      g.beginPath();
      g.moveTo(px - 4, PAD.top);
      g.lineTo(px + 4, PAD.top);
      g.lineTo(px, PAD.top + 6);
      g.fill();
    }
    if (hover !== null) {
      const px = Math.round(x(hover)) + 0.5;
      g.strokeStyle = INK_DIM;
      g.beginPath();
      g.moveTo(px, PAD.top);
      g.lineTo(px, PAD.top + plotH);
      g.stroke();
    }
  }, [hover]);

  useImperativeHandle(ref, () => ({
    // hist: 4 histogramas de 256 niveles · marker: 0..1 · total: píxeles del fotograma
    update(hist, marker, total) {
      data.current = { hist, marker, total };
      draw();
    },
  }), [draw]);

  useEffect(() => {
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [draw]);

  const track = (e) => {
    const box = canvas.current.getBoundingClientRect();
    const t = (e.clientX - box.left - PAD.left) / (box.width - PAD.left - PAD.right);
    setHover(Math.min(BINS - 1, Math.floor(Math.min(1, Math.max(0, t)) * BINS)));
  };
  const Frame = bare ? 'div' : 'figure';
  const share = (k) => {
    const { hist, total } = data.current;
    const percent = hist ? (binned(hist[k])[hover] / total) * 100 : 0;
    return percent >= 0.01 || percent === 0 ? `${percent.toFixed(2)} %` : '< 0.01 %';
  };

  return (
    <Frame className={bare ? undefined : 'histogram'}>
      {!bare && (
        <figcaption>
          <h3>Histograma de fenómenos</h3>
          <span>píxeles por intensidad · escala logarítmica</span>
        </figcaption>
      )}
      <div className="histogram-plot">
        <canvas
          ref={canvas}
          role="img"
          aria-label="Histograma en vivo de la intensidad de los cuatro fenómenos en el fotograma actual. La tabla del modo lectura da los mismos datos en texto."
          onPointerMove={track}
          onPointerLeave={() => setHover(null)}
        />
        {hover !== null && (
          <div className="histogram-tip" style={{ left: `${((hover + 0.5) / BINS) * 100}%` }} data-side={hover > BINS * 0.55 ? 'left' : 'right'}>
            <strong>
              Intensidad {Math.round((hover / BINS) * 100)}–{Math.round(((hover + 1) / BINS) * 100)} %
            </strong>
            {layers.map((layer, k) => (
              <span key={layer.name}>
                <i style={{ background: SLOT_COLORS[k] }} />
                {layer.name}
                <b>{share(k)}</b>
              </span>
            ))}
          </div>
        )}
      </div>
      <ul className="legend">
        {layers.map((layer, k) => (
          <li key={layer.name}>
            <i style={{ background: SLOT_COLORS[k] }} />
            {layer.icon} {layer.name}
          </li>
        ))}
        <li>
          <i className="legend-marker" />
          Franja actual
        </li>
      </ul>
      {bare && <p className="chart-summary">Píxeles del fotograma por intensidad de cada fenómeno · escala logarítmica.</p>}
    </Frame>
  );
});

export default Histogram;
