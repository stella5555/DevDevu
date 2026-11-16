import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CHARTS, collect, legendFor } from '../../jukebox/charts.js';
import Histogram from './Histogram.jsx';

// Gráfica de la estación. Por defecto es la propia del dataset (curva temporal,
// composición, perfil norte–sur, altura del dosel, monitor en vivo o la regla
// radial de Caldwell 73); un conmutador deja ver el histograma clásico de los
// cuatro fenómenos. La estación le pasa cada lectura con update().

const HEIGHT = { radial: 178, composition: 104 };

const DatasetChart = forwardRef(function DatasetChart({ config, layers, source }, ref) {
  const spec = config.chart;
  const [mode, setMode] = useState('dataset');
  const [tip, setTip] = useState(null); // { x, lines }
  const canvas = useRef();
  const histogram = useRef();
  const summary = useRef();
  const memory = useRef({}); // lo que cada gráfica recuerda entre lecturas
  const last = useRef(null); // última lectura recibida
  const result = useRef(null); // lo que devolvió el último dibujo (resumen y lectura al pasar el puntero)

  const draw = useCallback(() => {
    const el = canvas.current;
    const f = last.current;
    if (!el || !f) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (!width || !height) return;
    if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) {
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
    }
    const g = el.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    result.current = CHARTS[spec.kind](g, width, height, f, memory.current, spec);
    if (summary.current && summary.current.textContent !== result.current.summary) summary.current.textContent = result.current.summary;
  }, [spec]);

  useImperativeHandle(ref, () => ({
    // f: { analysis, strip, step, progress, lead, mission, layers, fresh }
    update(f) {
      last.current = f;
      collect(f, memory.current, spec);
      if (mode === 'histogram') histogram.current?.update(f.analysis.hist, f.strip.v[f.lead], f.analysis.w * f.analysis.h);
      else draw();
    },
  }), [mode, draw, spec]);

  // Al cambiar de vista o de tamaño, se redibuja con la última lectura.
  useEffect(() => {
    if (mode !== 'dataset') {
      const f = last.current;
      if (f) histogram.current?.update(f.analysis.hist, f.strip.v[f.lead], f.analysis.w * f.analysis.h);
      return undefined;
    }
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [mode, draw]);

  // Curva temporal: se mide la luz de cada año en una copia del vídeo, para
  // no mover el que maneja el deslizador de la misión.
  useEffect(() => {
    if (spec.kind !== 'timeline') return undefined;
    const st = memory.current;
    if (source?.origin !== 'video') {
      st.unavailable = Boolean(source);
      draw();
      return undefined;
    }
    let alive = true;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const probe = document.createElement('canvas');
    probe.width = 160;
    probe.height = Math.round(160 / (source.width / source.height));
    const g = probe.getContext('2d', { willReadFrequently: true });
    const [from, to] = spec.years;
    const seek = (time) =>
      new Promise((resolve) => {
        video.addEventListener('seeked', resolve, { once: true });
        video.currentTime = time;
      });
    video.addEventListener('loadeddata', async () => {
      const totals = [];
      for (let year = from; year <= to; year++) {
        await seek(((year - from) / (to - from)) * spec.span);
        if (!alive) return;
        g.drawImage(video, 0, 0, probe.width, probe.height);
        const { data } = g.getImageData(0, 0, probe.width, probe.height);
        let light = 0;
        for (let i = 0; i < data.length; i += 4) {
          const l = (data[i] * 54 + data[i + 1] * 183 + data[i + 2] * 19) >> 8;
          if (l > 12) light += l; // solo cuenta lo que brilla, no el fondo
        }
        totals.push(light);
      }
      st.index = totals.map((value) => (value / Math.max(1, totals[0])) * 100); // 2012 = 100
      draw();
    }, { once: true });
    video.src = source.el.currentSrc || source.el.src;
    return () => {
      alive = false;
      video.removeAttribute('src');
      video.load();
    };
  }, [spec, source, draw]);

  const hover = (e) => {
    const read = result.current?.hover;
    if (!read) return setTip(null);
    const box = canvas.current.getBoundingClientRect();
    const x = e.clientX - box.left;
    const lines = read(x);
    setTip(lines ? { x: x / box.width, lines } : null);
  };

  return (
    <figure className="histogram chart">
      <figcaption>
        <h3>{mode === 'dataset' ? spec.title : 'Histograma de fenómenos'}</h3>
        <div className="chart-switch" role="group" aria-label="Tipo de gráfica">
          <button type="button" className="btn" aria-pressed={mode === 'dataset'} onClick={() => setMode('dataset')}>
            Del fenómeno
          </button>
          <button type="button" className="btn" aria-pressed={mode === 'histogram'} onClick={() => setMode('histogram')}>
            Histograma
          </button>
        </div>
      </figcaption>

      {mode === 'histogram' ? (
        <Histogram ref={histogram} layers={layers} bare />
      ) : (
        <>
          <div className="histogram-plot">
            <canvas
              ref={canvas}
              style={{ height: HEIGHT[spec.kind] ?? 132 }}
              role="img"
              aria-label={`${spec.title}. El resumen bajo la gráfica dice lo mismo en texto.`}
              onPointerMove={hover}
              onPointerLeave={() => setTip(null)}
            />
            {tip && (
              <div className="histogram-tip" style={{ left: `${tip.x * 100}%` }} data-side={tip.x > 0.55 ? 'left' : 'right'}>
                <strong>{tip.lines[0]}</strong>
                {tip.lines.slice(1).map((text) => (
                  <span key={text}>{text}</span>
                ))}
              </div>
            )}
          </div>
          <p ref={summary} className="chart-summary" />
          <ul className="legend">
            {legendFor(spec, layers).map((item) => (
              <li key={item.label}>
                <i className={item.shape ? `legend-${item.shape}` : ''} style={{ background: item.color }} />
                {item.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  );
});

export default DatasetChart;
