import { useEffect, useRef, useState } from 'react';
import { CATEGORIES } from '../data/anomalies.js';
import { DATASETS, ROLES } from '../data/datasets.js';
import { closePanel, completeMission, useScanner } from '../state/scanner.js';
import { sonifier, SLOT_COLORS, DEFAULT_MIX } from '../audio/jukebox.js';
import { STEPS, loadSource, createAnalyzer, normalized, normalizedFlux, sampleAt, layerStats, describeStrip } from '../jukebox/analysis.js';
import { createMission } from '../jukebox/missions.js';
import DatasetChart from './jukebox/DatasetChart.jsx';
import Mixer from './jukebox/Mixer.jsx';
import MissionCard from './jukebox/MissionCard.jsx';

// Pilar 2 · Jukebox analítica: la estación que se abre sobre una anomalía ya
// identificada. El clip del SVS se dibuja cuadro a cuadro en el visor y, unas
// 10 veces por segundo, se analizan sus píxeles: de ahí salen las 4 pistas de
// sonido, el histograma, las métricas, los anillos y la misión de cada dataset.

const ANALYSIS_MS = 100;
const RING_MS = 850;
const SCAN_COLOR = '89, 255, 200';
const percent = (value, digits = 0) => `${(value * 100).toFixed(digits)}%`;
const coordinate = (value, positive, negative) => `${Math.abs(value).toFixed(1)}°${value >= 0 ? positive : negative}`;

// Punto de la imagen (u, v en 0..1) que corresponde a una franja y a una
// posición a lo largo de ella.
function stripPoint(analysis, step, pos) {
  if (analysis.scan !== 'radial') return [(step + 0.5) / STEPS, 1 - pos];
  const angle = ((step + 0.5) / STEPS) * Math.PI * 2 - Math.PI / 2;
  const reach = Math.hypot(analysis.w, analysis.h) / 2;
  return [0.5 + (Math.cos(angle) * pos * reach) / analysis.w, 0.5 + (Math.sin(angle) * pos * reach) / analysis.h];
}

function drawScan(g, W, H, dpr, analysis, progress, beat) {
  g.lineCap = 'round';
  if (analysis.scan === 'radial') {
    const reach = Math.hypot(W, H) / 2;
    const angle = progress * Math.PI * 2 - Math.PI / 2;
    g.lineWidth = 2 * dpr;
    for (let k = 14; k >= 0; k--) {
      const a = angle - k * 0.02;
      g.strokeStyle = k === 0 ? '#eafff8' : `rgba(${SCAN_COLOR}, ${0.2 * (1 - k / 14)})`;
      g.beginPath();
      g.moveTo(W / 2, H / 2);
      g.lineTo(W / 2 + Math.cos(a) * reach, H / 2 + Math.sin(a) * reach);
      g.stroke();
    }
    return;
  }
  const x = progress * W;
  const tail = (56 + 60 * beat) * dpr; // la estela se ensancha con cada golpe de bombo
  const trail = g.createLinearGradient(x - tail, 0, x, 0);
  trail.addColorStop(0, `rgba(${SCAN_COLOR}, 0)`);
  trail.addColorStop(1, `rgba(${SCAN_COLOR}, ${0.24 + 0.3 * beat})`);
  g.fillStyle = trail;
  g.fillRect(x - tail, 0, tail, H);
  g.fillStyle = '#eafff8';
  g.fillRect(x - dpr, 0, 2 * dpr, H);
}

// Anillos de onda: dos círculos que se abren y se apagan sobre el píxel.
function drawRings(g, W, H, dpr, rings, now) {
  for (const ring of rings) {
    const age = (now - ring.born) / RING_MS;
    if (age < 0 || age >= 1) continue;
    const x = ring.u * W;
    const y = ring.v * H;
    g.strokeStyle = ring.color;
    for (const lag of [0, 0.22]) {
      const t = age - lag;
      if (t <= 0) continue;
      g.globalAlpha = (1 - t) ** 1.6;
      g.lineWidth = (2.5 - 1.5 * t) * dpr;
      g.beginPath();
      g.arc(x, y, (5 + 44 * t) * ring.scale * dpr, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
}

export default function AnalyticsJukebox({ anomaly }) {
  const config = DATASETS[anomaly.id];
  const { layers } = config;
  const category = CATEGORIES[anomaly.category];
  const radial = config.scan === 'radial';
  const completed = useScanner((s) => s.missions.includes(anomaly.id));

  const [source, setSource] = useState(null); // { el, origin, width, height }
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState(true);
  const [mix, setMix] = useState(() => DEFAULT_MIX.map((volume) => ({ volume, mute: false, solo: false })));
  const [isolated, setIsolated] = useState(-1);
  const [reading, setReading] = useState(false);
  const [advanced, setAdvanced] = useState(false); // consola multipista, métricas y gráfica, a la vista
  const [frozen, setFrozen] = useState(false); // vídeo en pausa a petición del jugador
  const [view, setView] = useState({ done: [], hint: '' }); // lo que muestra la tarjeta de misión

  const panel = useRef();
  const close = useRef();
  const viewer = useRef();
  const chart = useRef();
  const meters = useRef([]);
  const gauges = useRef([]);
  const live = useRef();
  const out = useRef({}); // nodos de texto de las métricas
  const rt = useRef({ rings: [], mission: null, analyzer: null }); // estado del bucle, fuera de React

  // Fenómeno que se ve aislado: el elegido en el selector o, si no hay
  // ninguno, la pista que esté sola en "solo".
  const solos = mix.map((m, i) => (m.solo ? i : -1)).filter((i) => i >= 0);
  const focus = isolated >= 0 ? isolated : solos.length === 1 ? solos[0] : -1;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const isolatedRef = useRef(isolated);
  isolatedRef.current = isolated;

  // Cargar la fuente (clip, fotograma o reconstrucción) y montar el análisis,
  // el audio y la misión.
  useEffect(() => {
    let alive = true;
    let element = null;
    setSource(null);
    setPlaying(false);
    setIsolated(-1);
    setFrozen(false);
    loadSource(anomaly.svsId, config).then((loaded) => {
      if (!alive) return;
      element = loaded.el;
      const analyzer = createAnalyzer(config, loaded.width / loaded.height);
      analyzer.update(loaded.el);
      sonifier.load(analyzer.analysis, { rootHz: anomaly.signal.hz, scale: config.scale, layers, sweep: config.sweep });

      const state = rt.current;
      const ring = (u, v, color, scale = 1) => {
        state.rings.push({ u, v, color, scale, born: performance.now() });
        if (state.rings.length > 70) state.rings.splice(0, 20);
      };
      const notify = () => {
        const mission = state.mission;
        if (!mission) return;
        setView({ done: [...mission.done], hint: mission.hint });
        if (mission.done.every(Boolean) && !state.celebrated) {
          state.celebrated = true;
          completeMission(anomaly.id);
          sonifier.fanfare();
          [0, 140, 280].forEach((delay, i) => setTimeout(() => ring(0.5, 0.5, i % 2 ? '#ffb454' : '#59ffc8', 3 + i), delay));
        }
      };
      const mission = createMission({
        spec: config.mission,
        layers,
        A: () => analyzer.analysis,
        son: sonifier,
        ring,
        notify,
        isolated: () => isolatedRef.current,
        video: loaded.origin === 'video' ? loaded.el : null,
        setReference: () => analyzer.setReference(),
      });
      Object.assign(state, { analyzer, mission, ring, rings: [], celebrated: false, lastAnalysis: 0, lastTime: -1, dirty: false, beat: 0, lastPing: 0 });
      mission.init?.();
      setView({ done: [...mission.done], hint: mission.hint });

      // El clip corre en bucle salvo que lo mueva la misión (viaje en el
      // tiempo) o deba seguir a nuestro barrido (Caldwell 73).
      if (loaded.origin === 'video' && config.video !== 'scrub' && !config.sweep.follow) loaded.el.play().catch(() => {});
      setSource(loaded);
    });
    return () => {
      alive = false;
      sonifier.unload();
      rt.current.mission = null;
      if (element instanceof HTMLVideoElement) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
    };
  }, [anomaly, config, layers]);

  useEffect(() => {
    sonifier.setMix(mix);
  }, [mix]);

  useEffect(() => {
    rt.current.dirty = true; // rehacer la imagen aislada con el fenómeno nuevo
  }, [focus]);

  useEffect(() => {
    close.current.focus();
  }, [anomaly]);

  const toggle = () => {
    if (sonifier.playing) {
      sonifier.pause();
      setPlaying(false);
    } else if (source) {
      const ok = sonifier.play();
      setAudio(ok);
      setPlaying(ok);
    }
  };

  // Congelar el vídeo ayuda a apuntar con calma en las misiones.
  const loops = source?.origin === 'video' && config.video === true && !config.sweep.follow;
  const freeze = () => {
    if (frozen) source.el.play().catch(() => {});
    else source.el.pause();
    setFrozen(!frozen);
  };

  // Guía paso a paso: en cada momento brilla un solo control, con su «Paso N»,
  // para que se vea qué toca ahora. No cambia las reglas de la misión, salvo
  // que la sonda no deja marcar el punto crítico hasta congelar el vídeo.
  const kind = config.mission.kind;
  const pending = view.done.findIndex((ok) => !ok); // -1: misión terminada (o aún sin cargar)
  const stepped = kind === 'probe' && loops && pending >= 0; // congelar → marcar
  let guide = null; // { target: 'freeze' | 'action' | 'slider' | 'isolate' | 'viewer', step }
  if (source && pending >= 0) {
    if (stepped) guide = frozen ? { target: 'action', step: 2 } : { target: 'freeze', step: 1 };
    else if (kind === 'probe' && pending === 1) guide = { target: 'action', step: 2 };
    else if (kind === 'timeTravel' && pending === 0) guide = { target: 'slider', step: 1 };
    else if (kind === 'separate' && pending === 0) guide = { target: 'isolate', step: 1 };
    else guide = { target: 'viewer', step: pending + 1 };
  }
  const chip = (target) => guide?.target === target && <span className="step-chip">Step {guide.step}</span>;

  // Teclado de la estación: Espacio sintoniza/pausa; Tab no sale del panel.
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  useEffect(() => {
    const key = (e) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof Element && e.target.closest('button, a, input'))) {
        e.preventDefault();
        toggleRef.current();
      } else if (e.key === 'Tab') {
        const items = panel.current.querySelectorAll('button, a[href], input');
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // Bucle de la estación.
  useEffect(() => {
    if (!source) return undefined;
    const state = rt.current;
    const { analyzer, mission } = state;
    const { analysis } = analyzer;
    const isVideo = source.origin === 'video';
    const follow = isVideo && config.sweep.follow;
    let id;
    let last = performance.now();
    let lastStep = -1;
    let fresh = false; // hay una lectura nueva del vídeo que la gráfica aún no ha visto
    let isoCanvas = null;

    const tick = (now) => {
      id = requestAnimationFrame(tick);
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      const focused = focusRef.current;

      // Caldwell 73: el vídeo de la NASA avanza con nuestro barrido.
      if (follow) {
        const video = source.el;
        const want = sonifier.elapsed() % video.duration;
        if (sonifier.playing) {
          if (video.paused) video.play().catch(() => {});
          if (Math.abs(video.currentTime - want) > 0.3) video.currentTime = want;
        } else if (!video.paused) {
          video.pause();
        }
      }

      // Análisis: cuando el vídeo ha avanzado (o algo obliga a rehacerlo).
      const time = isVideo ? source.el.currentTime : 0;
      if (now - state.lastAnalysis >= ANALYSIS_MS && (time !== state.lastTime || state.dirty) && !(isVideo && source.el.seeking)) {
        state.lastAnalysis = now;
        state.lastTime = time;
        state.dirty = false;
        analyzer.update(source.el);
        isoCanvas = focused >= 0 ? analyzer.renderIsolated(focused) : null;
        fresh = true;
        lastStep = -1; // refresca métricas y gráfica aunque el barrido esté quieto
      }
      if (focused < 0) isoCanvas = null;

      mission.update(dt);
      mission.gauges.forEach((gauge, i) => {
        if (gauges.current[i]) gauges.current[i].style.width = `${gauge.value * 100}%`;
      });

      // Lo que el motor de audio acaba de hacer sonar se convierte en anillos.
      const progress = sonifier.progress();
      const clock = sonifier.now();
      while (sonifier.events.length && sonifier.events[0].time <= clock) {
        const event = sonifier.events.shift();
        if (event.kind === 'beat') {
          state.beat = 1;
          continue;
        }
        const [u, v] = stripPoint(analysis, event.step, event.pos);
        const scale = event.kind === 'note' ? 0.45 + 0.5 * event.level : event.kind === 'hit' ? 0.8 + 0.7 * event.level : 1.1 + 0.6 * event.level;
        state.ring(u, v, event.kind === 'spark' ? '#fff6d0' : SLOT_COLORS[event.layer], scale);
      }
      state.beat = Math.max(0, state.beat - dt * 4);
      state.rings = state.rings.filter((ring) => now - ring.born < RING_MS);

      // Visor: fotograma (o fenómeno aislado), barrido, anillos y capa de misión.
      const canvas = viewer.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(canvas.clientWidth * dpr);
      const H = Math.round(canvas.clientHeight * dpr);
      const step = Math.min(STEPS - 1, Math.floor(progress * STEPS));
      const s = analysis.strips[step];
      // Fenómeno que manda en la franja: el aislado o el que más pesa.
      let lead = focused;
      if (lead < 0) {
        lead = 0;
        for (let k = 1; k < layers.length; k++) if (normalized(analysis, k, s.v[k]) > normalized(analysis, lead, s.v[lead])) lead = k;
      }
      if (W && H) {
        if (canvas.width !== W || canvas.height !== H) {
          canvas.width = W;
          canvas.height = H;
        }
        const g = canvas.getContext('2d');
        g.imageSmoothingQuality = 'high';
        if (config.gain) g.filter = `brightness(${config.gain})`;
        g.drawImage(isoCanvas ?? source.el, 0, 0, W, H);
        g.filter = 'none';
        if (!follow) drawScan(g, W, H, dpr, analysis, progress, state.beat);
        if (s.peak[lead] > 0.15) {
          // Pico del fenómeno en la franja: anillo ámbar con borde oscuro.
          const [u, v] = stripPoint(analysis, step, s.peakPos[lead]);
          g.lineWidth = 4 * dpr;
          g.strokeStyle = 'rgba(2, 3, 10, 0.8)';
          g.beginPath();
          g.arc(u * W, v * H, 6 * dpr, 0, Math.PI * 2);
          g.stroke();
          g.lineWidth = 2 * dpr;
          g.strokeStyle = '#ffb454';
          g.stroke();
        }
        mission.draw(g, W, H, dpr);
        drawRings(g, W, H, dpr, state.rings, now);
      }

      // Métricas, medidores, gráfica y lectura: al entrar en una franja nueva
      // o al llegar una lectura nueva del vídeo.
      if (step === lastStep) return;
      lastStep = step;
      const o = out.current;
      o.position.textContent = radial ? `${Math.round(progress * 360)}°` : percent(progress);
      o.lead.textContent = `${layers[lead].icon} ${layers[lead].name}`;
      o.mean.textContent = percent(s.v[lead], 1);
      o.peak.textContent = percent(s.peak[lead]);
      o.peakAt.textContent = radial ? `at ${percent(s.peakPos[lead])} of the radius` : `at ${percent(s.peakPos[lead])} height`;
      o.entropy.textContent = `${s.entropy.toFixed(2)} bits`;
      o.contrast.textContent = percent(s.sd, 1);
      o.whole.textContent = layers.map((layer, k) => `${layer.icon} ${percent(analysis.coverage[k], 1)}`).join(' · ');
      layers.forEach((layer, k) => {
        const level = layer.role === 'perc' ? Math.max(normalized(analysis, k, s.v[k]), normalizedFlux(analysis, k, s.flux[k])) : normalized(analysis, k, s.v[k]);
        if (meters.current[k]) meters.current[k].style.width = `${level * 100}%`;
      });
      chart.current?.update({ analysis, strip: s, step, progress, lead, mission, layers, fresh });
      fresh = false;
      // El texto en vivo cambia 8 veces por barrido: suficiente para seguirlo
      // sin saturar a un lector de pantalla.
      if (live.current && step % (STEPS / 8) === 0) live.current.textContent = describeStrip(analysis, step, layers);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [source, config, layers, radial, reading]);

  // Puntero sobre el visor: primero la misión; si ella no da sonido al pasar
  // el cursor, cruzar un pico de intensidad dispara un anillo y una nota.
  const pointer = (type) => (e) => {
    const state = rt.current;
    if (!state.mission) return;
    const box = viewer.current.getBoundingClientRect();
    const u = (e.clientX - box.left) / box.width;
    const v = (e.clientY - box.top) / box.height;
    if (type === 'down') {
      sonifier.wake();
      viewer.current.setPointerCapture(e.pointerId);
    }
    state.mission.pointer(type, u, v);
    if (type !== 'move' || state.mission.hover || u < 0 || u > 1 || v < 0 || v > 1) return;
    const now = performance.now();
    if (now - state.lastPing < 150) return;
    const { analysis } = state.analyzer;
    const sample = sampleAt(analysis, u, v, 3);
    let k = focusRef.current;
    if (k < 0) {
      k = 0;
      for (let i = 1; i < 4; i++) if (sample.w[i] > sample.w[k]) k = i;
    }
    if (sample.w[k] < 0.45) return;
    state.lastPing = now;
    state.ring(u, v, SLOT_COLORS[k], 0.5 + 0.6 * sample.w[k]);
    const pos = radial ? Math.hypot((u - 0.5) * analysis.w, (v - 0.5) * analysis.h) / (Math.hypot(analysis.w, analysis.h) / 2) : 1 - v;
    const role = layers[k].role;
    if (role === 'perc') {
      sonifier.click(0.1 + 0.15 * sample.w[k], 1200 + 4000 * pos);
    } else {
      const octave = role === 'bass' ? 1 : role === 'pad' ? 2 : 3;
      sonifier.tone(sonifier.scaleHz(pos, 2, octave), { level: 0.07 + 0.1 * sample.w[k], dur: role === 'melody' ? 0.25 : 0.45, type: role === 'pad' ? 'sine' : 'triangle' });
    }
  };

  const stats = source && reading ? layers.map((layer, k) => ({ ...layer, ...layerStats(rt.current.analyzer.analysis, k) })) : null;
  const setTrack = (i, patch) => setMix((all) => all.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const aspect = source ? source.width / source.height : 16 / 9;
  const caption =
    source?.origin === 'video'
      ? `Video: NASA's Scientific Visualization Studio · SVS #${anomaly.svsId}${config.gain ? ' · screen brightness boosted' : ''}`
      : source?.origin === 'procedural'
        ? 'Procedural reconstruction with the dataset palette (the SVS resource could not be loaded)'
        : `Still image: NASA's Scientific Visualization Studio · SVS #${anomaly.svsId}`;

  return (
    <div className="station-backdrop" onPointerDown={(e) => e.target === e.currentTarget && closePanel()}>
      <section
        ref={panel}
        className={`station${reading ? ' is-reading' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-title"
        style={{ '--c': category.color }}
      >
        <header className="station-head">
          <div>
            <span className="chip">{category.label}</span>
            <h2 id="station-title">
              {anomaly.title}
              {completed && (
                <span className="station-star" title="Mission complete">
                  {' '}
                  ★
                </span>
              )}
            </h2>
            <p className="station-id">
              NASA SVS #{anomaly.svsId} · {anomaly.year} · {anomaly.source}
            </p>
          </div>
          <div className="station-actions">
            <button type="button" className="btn" aria-pressed={reading} onClick={() => setReading(!reading)}>
              Reading mode
            </button>
            <button ref={close} type="button" className="btn btn-icon" onClick={closePanel} aria-label="Close analysis station">
              ✕
            </button>
          </div>
        </header>

        <p className="station-summary">{anomaly.summary}</p>

        {reading && (
          <section className="reading" aria-label="Accessible reading">
            <div>
              <h3>What you see</h3>
              <p>{config.see}</p>
            </div>
            <div>
              <h3>What you hear</h3>
              <p>
                {radial ? 'A needle rotates from the center of the image' : 'A vertical line sweeps the image from left to right'} in{' '}
                {config.sweep.seconds} seconds and starts over. Each phenomenon drives a track:{' '}
                {layers.map((layer) => `${layer.name.toLowerCase()}, ${ROLES[layer.role].toLowerCase()}`).join('; ')}. Notes rise in pitch
                the {radial ? 'farther from the center' : 'higher up'} the phenomenon is, and a kick drum marks the pulse wherever the image is
                busiest.
              </p>
            </div>
            <div>
              <h3>Right now</h3>
              <p ref={live} aria-live="polite">
                {source ? describeStrip(rt.current.analyzer.analysis, Math.min(STEPS - 1, Math.floor(sonifier.progress() * STEPS)), layers) : 'Loading…'}
              </p>
            </div>
            {stats && (
              <table>
                <caption>The four phenomena in the current frame</caption>
                <thead>
                  <tr>
                    <th scope="col">Phenomenon</th>
                    <th scope="col">Covers</th>
                    <th scope="col">Mean intensity</th>
                    <th scope="col">Peak at</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((item) => (
                    <tr key={item.name}>
                      <th scope="row">{item.name}</th>
                      <td>{percent(item.coverage, 1)}</td>
                      <td>{percent(item.intensity)}</td>
                      <td>{radial ? `${Math.round(item.hottest * 360)}°` : percent(item.hottest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <div className="station-grid">
          <div className="station-col">
            <figure className={`viewer${guide?.target === 'viewer' ? ' is-guide' : ''}`}>
              <canvas
                ref={viewer}
                style={{ '--ar': aspect }}
                role="img"
                aria-label={config.see}
                onPointerDown={pointer('down')}
                onPointerMove={pointer('move')}
                onPointerUp={pointer('up')}
                onPointerCancel={pointer('leave')}
                onPointerLeave={pointer('leave')}
              />
              {!source && <p className="viewer-loading">Loading the video…</p>}
              <figcaption>
                {chip('viewer')}
                {caption}
              </figcaption>
            </figure>

            <div className="transport">
              <button type="button" className="btn btn-tune" aria-pressed={playing} disabled={!source} onClick={toggle}>
                {playing ? '❚❚ Pause sweep' : '▶ Tune in / sonify data'}
              </button>
              {loops && (
                <button type="button" className={`btn${guide?.target === 'freeze' ? ' is-guide' : ''}`} aria-pressed={frozen} onClick={freeze}>
                  {frozen ? '▶ Resume video' : '❚❚ Freeze video'}
                  {stepped && <span className="step-chip">{frozen ? '✓ Step 1' : 'Step 1'}</span>}
                </button>
              )}
              {!audio && <span className="station-note">This browser has no audio: the sweep continues in visual mode.</span>}
            </div>

            <div className={`isolate${guide?.target === 'isolate' ? ' is-guide' : ''}`} role="group" aria-label="Isolate phenomenon">
              <h3>
                Isolate phenomenon
                {chip('isolate')}
              </h3>
              <div>
                <button type="button" className="btn" aria-pressed={isolated < 0} onClick={() => setIsolated(-1)}>
                  All
                </button>
                {layers.map((layer, k) => (
                  <button key={layer.name} type="button" className="btn" aria-pressed={isolated === k} onClick={() => setIsolated(isolated === k ? -1 : k)}>
                    <span aria-hidden="true">{layer.icon}</span> {layer.name}
                  </button>
                ))}
              </div>
              <p className="station-note">
                {focus >= 0
                  ? `${layers[focus].icon} ${layers[focus].line}`
                  : 'Pick a phenomenon to leave only its pixels glowing; the rest of the video dims.'}
              </p>
            </div>

          </div>

          <div className="station-col">
            {source && (
              <MissionCard
                key={anomaly.id}
                spec={config.mission}
                mission={rt.current.mission}
                view={view}
                completed={completed}
                guide={guide}
                locked={stepped && !frozen}
                gaugeRef={(i, el) => (gauges.current[i] = el)}
              />
            )}



            <section className="context" aria-label="Signal context">
              <h3>Signal context</h3>
              <p>{anomaly.context}</p>
              <p className="station-id">
                {anomaly.place} · {coordinate(anomaly.lat, 'N', 'S')}, {coordinate(anomaly.lon, 'E', 'W')}
              </p>
            </section>

            <button type="button" className="btn telemetry-toggle" aria-expanded={advanced} aria-controls="telemetry" onClick={() => setAdvanced(!advanced)}>
              {advanced ? 'Hide advanced telemetry ▴' : 'Show advanced telemetry ▾'}
            </button>

            <a className="btn station-link" href={anomaly.url} target="_blank" rel="noreferrer">
              See the visualization at svs.gsfc.nasa.gov/{anomaly.svsId} ↗
            </a>
          </div>
        </div>

        <div id="telemetry" className="telemetry" hidden={!advanced}>
          <div className="station-col">
            <DatasetChart ref={chart} config={config} layers={layers} source={source} />
          </div>
          <div className="station-col">
            <Mixer layers={layers} mix={mix} onChange={setTrack} meterRef={(i, el) => (meters.current[i] = el)} />

            <section className="metrics" aria-label="Metrics of the current strip">
              <h3>
                Current strip <span ref={(el) => (out.current.position = el)}>—</span>
              </h3>
              <p className="metrics-lead">
                Dominant: <b ref={(el) => (out.current.lead = el)}>—</b>
              </p>
              <dl>
                <div>
                  <dt>Mean value</dt>
                  <dd ref={(el) => (out.current.mean = el)}>—</dd>
                </div>
                <div>
                  <dt>Anomaly peak</dt>
                  <dd ref={(el) => (out.current.peak = el)}>—</dd>
                  <small ref={(el) => (out.current.peakAt = el)}>—</small>
                </div>
                <div>
                  <dt>Entropy</dt>
                  <dd ref={(el) => (out.current.entropy = el)}>—</dd>
                  <small>of 5 possible bits</small>
                </div>
                <div>
                  <dt>Contrast</dt>
                  <dd ref={(el) => (out.current.contrast = el)}>—</dd>
                  <small>σ of luminosity</small>
                </div>
              </dl>
              <p>
                Whole frame: <span ref={(el) => (out.current.whole = el)}>—</span>
              </p>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
