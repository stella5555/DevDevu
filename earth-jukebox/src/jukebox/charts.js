import { STEPS, BANDS } from './analysis.js';
import { SLOT_COLORS, sonifier } from '../audio/jukebox.js';
import { GEDI_MAX_METERS } from '../data/datasets.js';

// Gráficas de la estación, una por tipo de dataset. Todas se dibujan en un
// <canvas> a partir de lo que el análisis acaba de leer en el vídeo:
//
//   timeline     curva 2012 → 2023 de la luz nocturna
//   composition  barras de composición: todo el mapa frente a la franja actual
//   profile      perfil norte–sur de calidez y velocidad del agua
//   canopy       altura del dosel (m) a lo largo del barrido
//   series       monitor en vivo, como un sismógrafo
//   radial       la regla de Caldwell 73: distancia al centro → frecuencia
//
// Cada una recibe (g, ancho, alto, f, st, spec) y devuelve { summary, hover }:
// `f` es la lectura del momento (análisis, franja, misión…), `st` su memoria
// entre fotogramas, `summary` la frase que resume la gráfica y `hover(x)` las
// líneas del recuadro al pasar el puntero.

const INK = '#d7e3f4';
const INK_DIM = '#7f8fa8';
const GRID = 'rgba(215, 227, 244, 0.1)';
const NEUTRAL = '#cfcabd';
const AMBER = '#ffb454';
const FONT = "10px 'JetBrains Mono', ui-monospace, monospace";
const ON_FILL = ['#ffffff', '#04060d', '#ffffff', '#04060d']; // texto sobre cada color de pista
const pct = (value, digits = 0) => `${(value * 100).toFixed(digits)}%`;
const clamp01 = (value) => Math.min(1, Math.max(0, value));

function plotArea(w, h, pad = {}) {
  const left = pad.left ?? 38;
  const right = pad.right ?? 8;
  const top = pad.top ?? 10;
  const bottom = pad.bottom ?? 20;
  return { x: left, y: top, w: w - left - right, h: h - top - bottom };
}

function text(g, value, x, y, align = 'left', color = INK_DIM, baseline = 'middle') {
  g.font = FONT;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = baseline;
  g.fillText(value, x, y);
}

// Eje vertical: una línea de rejilla y una etiqueta por marca.
function yAxis(g, p, ticks, toY) {
  g.strokeStyle = GRID;
  g.lineWidth = 1;
  for (const [value, label] of ticks) {
    const y = Math.round(toY(value)) + 0.5;
    g.beginPath();
    g.moveTo(p.x, y);
    g.lineTo(p.x + p.w, y);
    g.stroke();
    text(g, label, p.x - 6, y, 'right');
  }
}

function xLabels(g, p, labels) {
  labels.forEach(([t, label], i) => {
    const align = i === 0 ? 'left' : i === labels.length - 1 ? 'right' : 'center';
    text(g, label, p.x + t * p.w, p.y + p.h + 6, align, INK_DIM, 'top');
  });
}

function line(g, points, color, width = 2) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
}

// Marcador vertical con etiqueta: dónde está el barrido, la boya o el deslizador.
function marker(g, p, t, label) {
  const x = Math.round(p.x + clamp01(t) * p.w) + 0.5;
  g.strokeStyle = INK;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, p.y);
  g.lineTo(x, p.y + p.h);
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(x - 4, p.y);
  g.lineTo(x + 4, p.y);
  g.lineTo(x, p.y + 6);
  g.fill();
  if (label) text(g, label, t > 0.8 ? x - 6 : x + 6, p.y + 5, t > 0.8 ? 'right' : 'left', INK);
}

function dot(g, x, y, color, radius = 4) {
  g.fillStyle = '#080c16'; // anillo del color del fondo: el punto se lee sobre la línea
  g.beginPath();
  g.arc(x, y, radius + 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
  g.fill();
}

function nearest(p, x, count) {
  return Math.min(count - 1, Math.max(0, Math.round(((x - p.x) / p.w) * (count - 1))));
}

// ── #5313 · Curva temporal 2012 → 2023 ──
function timeline(g, w, h, f, st, spec) {
  const p = plotArea(w, h);
  const [from, to] = spec.years;
  if (!st.index) {
    text(g, st.unavailable ? 'The yearly series needs the 2012–2023 video.' : 'Measuring the light of each year in the video…', p.x + p.w / 2, p.y + p.h / 2, 'center');
    return { summary: st.unavailable ? 'No video, no time series: see the histogram.' : 'Measuring…' };
  }
  const values = st.index;
  const low = Math.floor((Math.min(...values) - 2) / 5) * 5;
  const high = Math.ceil((Math.max(...values) + 2) / 5) * 5;
  const toX = (i) => p.x + (i / (values.length - 1)) * p.w;
  const toY = (v) => p.y + p.h * (1 - (v - low) / (high - low));
  yAxis(g, p, [[low, String(low)], [(low + high) / 2, String((low + high) / 2)], [high, String(high)]], toY);
  xLabels(g, p, [0, 3, 6, 9, 11].map((i) => [i / (values.length - 1), String(from + i)]));
  const points = Array.from(values, (v, i) => [toX(i), toY(v)]);
  // Área tenue bajo la curva y línea encima.
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.lineTo(p.x + p.w, p.y + p.h);
  g.lineTo(p.x, p.y + p.h);
  g.closePath();
  g.fillStyle = 'rgba(255, 180, 84, 0.1)';
  g.fill();
  line(g, points, AMBER);

  // Dónde está el deslizador de la misión.
  const year = f.mission?.year ?? from;
  const at = clamp01((year - from) / (to - from)) * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(at));
  const value = values[i] + (values[i + 1] - values[i]) * (at - i);
  marker(g, p, at / (values.length - 1), String(Math.round(year)));
  dot(g, toX(at), toY(value), AMBER);
  const change = value - 100;
  return {
    summary: `${Math.round(year)}: total light ${value.toFixed(0)} (2012 = 100), ${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(0)}% vs. 2012.`,
    hover: (x) => {
      const k = nearest(p, x, values.length);
      return [String(from + k), `Total light ${values[k].toFixed(1)}`, '(2012 = 100)'];
    },
  };
}

// ── #5669 y #5533 · Composición: todo el mapa frente a la franja actual ──
function composition(g, w, h, f) {
  const { analysis, strip, layers } = f;
  const labelWidth = 92;
  const rows = [['Whole map', Array.from(analysis.mean)], ['Current strip', Array.from(strip.v)]];
  const barHeight = Math.min(28, (h - 26) / 2 - 8);
  const left = labelWidth;
  const width = w - left - 8;
  const lead = [];
  rows.forEach(([label, values], r) => {
    const y = 8 + r * (barHeight + 16);
    text(g, label, left - 10, y + barHeight / 2, 'right', INK);
    const total = values.reduce((sum, v) => sum + v, 0);
    if (total < 1e-4) {
      g.fillStyle = GRID;
      g.fillRect(left, y, width, barHeight);
      text(g, 'none of the four in this strip', left + 8, y + barHeight / 2);
      lead.push(null);
      return;
    }
    let x = left;
    let top = 0;
    values.forEach((v, k) => {
      const share = v / total;
      if (share > values[top] / total) top = k;
      const segment = share * width;
      if (segment < 0.5) return;
      // Hueco de 2 px del color del fondo entre segmentos, no un borde.
      g.fillStyle = SLOT_COLORS[k];
      g.beginPath();
      g.roundRect(x + 1, y, Math.max(1, segment - 2), barHeight, 3);
      g.fill();
      if (segment > 36) text(g, `${Math.round(share * 100)}%`, x + 7, y + barHeight / 2, 'left', ON_FILL[k]);
      x += segment;
    });
    lead.push({ name: layers[top].name, share: values[top] / total });
  });
  xLabels(g, { x: left, y: 8, w: width, h: 2 * barHeight + 18 }, [[0, '0%'], [0.5, '50%'], [1, '100%']]);
  const [map, here] = lead;
  return {
    summary: `${here ? `Current strip: ${here.name.toLowerCase()} dominates (${pct(here.share)})` : 'Current strip: no particles'} · whole map: ${map ? `${map.name.toLowerCase()} (${pct(map.share)})` : 'no particles'}.`,
  };
}

// ── #3912 y #5425 · Perfil térmico norte–sur ──
function profile(g, w, h, f, st, spec) {
  const { analysis, layers } = f;
  const { gw, gh } = analysis;
  const p = plotArea(w, h);
  const rows = (k) => {
    const out = new Float32Array(gh);
    for (let y = 0; y < gh; y++) {
      let sum = 0;
      for (let x = 0; x < gw; x++) sum += analysis.cells[k][y * gw + x];
      out[y] = sum / gw;
    }
    return out;
  };
  const warm = rows(spec.warm);
  const flow = rows(spec.flow);
  const peak = Math.max(0.02, ...warm, ...flow);
  const top = Math.ceil(peak * 20) / 20; // techo redondeado al 5 %
  const toX = (y) => p.x + (y / (gh - 1)) * p.w;
  const toY = (v) => p.y + p.h * (1 - v / top);
  yAxis(g, p, [[0, '0 %'], [top / 2, pct(top / 2, top < 0.2 ? 1 : 0)], [top, pct(top)]], toY);
  xLabels(g, p, spec.global ? [[0, '90°N'], [0.25, '45°N'], [0.5, 'equator'], [0.75, '45°S'], [1, '90°S']] : [[0, 'north of frame'], [0.5, 'center'], [1, 'south of frame']]);
  line(g, Array.from(flow, (v, y) => [toX(y), toY(v)]), SLOT_COLORS[spec.flow]);
  line(g, Array.from(warm, (v, y) => [toX(y), toY(v)]), SLOT_COLORS[spec.warm]);

  const place = (t) => {
    if (!spec.global) return `${Math.round(t * 100)}% from the north`;
    const lat = 90 - t * 180;
    return Math.abs(lat) < 1.5 ? 'at the equator' : `at ${Math.abs(lat).toFixed(0)}°${lat > 0 ? 'N' : 'S'}`;
  };
  const maxAt = (values) => values.indexOf(Math.max(...values)) / (gh - 1);
  const buoy = f.mission?.item;
  let buoyText = '';
  if (buoy && (buoy.placed || buoy.dragging)) {
    marker(g, p, buoy.v, 'buoy');
    const row = Math.min(gh - 1, Math.round(buoy.v * (gh - 1)));
    buoyText = ` Buoy ${place(buoy.v)}: warmth ${pct(warm[row], 1)}, flow ${pct(flow[row], 1)}.`;
  }
  return {
    summary: `${layers[spec.warm].name}: peak ${place(maxAt(warm))} · ${layers[spec.flow].name.toLowerCase()}: peak ${place(maxAt(flow))}.${buoyText}`,
    hover: (x) => {
      const row = nearest(p, x, gh);
      return [place(row / (gh - 1)), `${layers[spec.warm].name} ${pct(warm[row], 1)}`, `${layers[spec.flow].name} ${pct(flow[row], 1)}`];
    },
  };
}

// ── #4950 · Altura del dosel a lo largo del barrido ──
function canopy(g, w, h, f, st, spec) {
  const { analysis, progress } = f;
  const p = plotArea(w, h);
  const mean = new Float32Array(STEPS);
  const peak = new Float32Array(STEPS);
  for (let i = 0; i < STEPS; i++) {
    const s = analysis.strips[i];
    // Fracción de la franja que es tierra firme: la media se hace solo sobre ella.
    const land = Math.min(1, spec.land.reduce((sum, k) => sum + s.v[k], 0));
    mean[i] = land > 0.03 ? Math.min(GEDI_MAX_METERS, (s.v[spec.biomass] / land) * GEDI_MAX_METERS) : 0;
    peak[i] = land > 0.03 ? s.peak[spec.biomass] * GEDI_MAX_METERS : 0;
  }
  const toX = (i) => p.x + (i / (STEPS - 1)) * p.w;
  const toY = (m) => p.y + p.h * (1 - m / GEDI_MAX_METERS);
  yAxis(g, p, [[0, '0 m'], [25, '25 m'], [50, '50 m']], toY);
  xLabels(g, p, [[0, 'start of sweep'], [0.5, 'middle'], [1, 'end']]);
  const meanPoints = Array.from(mean, (m, i) => [toX(i), toY(m)]);
  g.beginPath();
  meanPoints.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.lineTo(p.x + p.w, p.y + p.h);
  g.lineTo(p.x, p.y + p.h);
  g.closePath();
  g.fillStyle = 'rgba(47, 174, 110, 0.2)';
  g.fill();
  line(g, Array.from(peak, (m, i) => [toX(i), toY(m)]), NEUTRAL, 1.5);
  line(g, meanPoints, '#2fae6e');
  marker(g, p, progress, 'sweep');
  const i = Math.min(STEPS - 1, Math.floor(progress * STEPS));
  return {
    summary: mean[i] > 0 ? `Current strip: mean height ${mean[i].toFixed(0)} m, tallest tree ${peak[i].toFixed(0)} m.` : 'Current strip: no land (ocean or space).',
    hover: (x) => {
      const k = nearest(p, x, STEPS);
      return [`At ${Math.round((k / (STEPS - 1)) * 100)}% of the sweep`, `Mean height ${mean[k].toFixed(0)} m`, `Tallest ${peak[k].toFixed(0)} m`];
    },
  };
}

// ── #5196, #4960 y #5011 · Monitor en vivo ──
const HISTORY = 240; // muestras: unos 24 s a 10 lecturas por segundo

// Se llama con cada lectura nueva del vídeo, se esté viendo o no la gráfica.
function collectSeries(f, st, spec) {
  const { analysis, strip } = f;
  st.a ??= [];
  st.b ??= [];
  st.scale ??= 1e-4;
  const under = clamp01(strip.v[spec.key] / Math.max(1e-4, analysis.range[spec.key][1]));
  let whole;
  if (spec.flash) {
    // Descargas nuevas: cuánto han crecido las celdas con rayos desde la lectura anterior.
    const size = analysis.gw * analysis.gh;
    st.cells ??= new Float32Array(size);
    whole = 0;
    for (let c = 0; c < size; c++) {
      let now = 0;
      for (const k of spec.flash) now += analysis.cells[k][c];
      if (st.primed && now > st.cells[c]) whole += now - st.cells[c];
      st.cells[c] = now;
    }
    st.primed = true;
  } else {
    whole = analysis.coverage[spec.key];
  }
  st.scale = Math.max(st.scale * 0.999, whole); // el máximo reciente marca el 100 %
  st.a.push(under);
  st.b.push(whole / st.scale);
  if (st.a.length > HISTORY) {
    st.a.shift();
    st.b.shift();
  }
}

function series(g, w, h, f, st, spec) {
  const p = plotArea(w, h);
  const a = st.a ?? [];
  const b = st.b ?? [];
  const toX = (i, n) => p.x + p.w - ((n - 1 - i) / (HISTORY - 1)) * p.w; // lo último, a la derecha
  const toY = (v) => p.y + p.h * (1 - clamp01(v));
  yAxis(g, p, [[0, '0%'], [0.5, '50%'], [1, '100%']], toY);
  // Rejilla vertical cada 6 s, como el papel de un sismógrafo.
  g.strokeStyle = GRID;
  for (let k = 1; k < 4; k++) {
    const x = Math.round(p.x + (k / 4) * p.w) + 0.5;
    g.beginPath();
    g.moveTo(x, p.y);
    g.lineTo(x, p.y + p.h);
    g.stroke();
  }
  xLabels(g, p, [[0, '24 s ago'], [0.5, '12 s ago'], [1, 'now']]);
  line(g, b.map((v, i) => [toX(i, b.length), toY(v)]), NEUTRAL, 1.5);
  line(g, a.map((v, i) => [toX(i, a.length), toY(v)]), SLOT_COLORS[spec.key]);
  // Picos: máximos locales claros de la traza principal.
  for (let i = 2; i < a.length - 2; i++) {
    if (a[i] > 0.6 && a[i] >= a[i - 1] && a[i] > a[i + 1] && a[i] >= a[i - 2] && a[i] > a[i + 2]) dot(g, toX(i, a.length), toY(a[i]), AMBER, 3);
  }
  if (a.length) dot(g, toX(a.length - 1, a.length), toY(a[a.length - 1]), SLOT_COLORS[spec.key]);
  const lastA = a[a.length - 1] ?? 0;
  const lastB = b[b.length - 1] ?? 0;
  return {
    summary: `Now, under the sweep: ${pct(lastA)} · ${spec.flash ? 'new discharges' : 'whole frame'}: ${pct(lastB)} · peak of the last 24 s: ${pct(Math.max(0, ...a))}.`,
  };
}

// ── #13786 · La regla de la NASA: distancia al centro → frecuencia ──
function radial(g, w, h, f) {
  const { strip, progress, layers } = f;
  const side = Math.min(h - 4, w * 0.36);
  const cx = side / 2 + 4;
  const cy = h / 2;
  const reach = side / 2 - 4;
  const hzAt = (radius) => sonifier.scaleHz(radius, 3, 2);
  // Brillo de cada tramo de la aguja: lo más intenso de cualquiera de las capas.
  const bright = Array.from({ length: BANDS }, (_, b) => Math.max(...layers.map((_, k) => strip.bands[k][b])));
  const top = Math.max(1e-4, ...bright);
  const best = bright.indexOf(Math.max(...bright));

  // Diana: anillos más claros cuanto más agudos, y la aguja del barrido.
  for (let ring = 12; ring >= 1; ring--) {
    g.strokeStyle = `rgba(89, 255, 200, ${0.12 + 0.5 * (ring / 12)})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, (ring / 12) * reach, 0, Math.PI * 2);
    g.stroke();
  }
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  g.strokeStyle = INK;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach);
  g.stroke();
  bright.forEach((value, b) => {
    if (value / top < 0.12) return;
    const radius = ((b + 0.5) / BANDS) * reach;
    g.fillStyle = b === best ? AMBER : 'rgba(234, 255, 248, 0.85)';
    g.beginPath();
    g.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 1.5 + 3 * (value / top), 0, Math.PI * 2);
    g.fill();
  });
  text(g, 'low', cx, cy + 12, 'center', INK);
  text(g, 'high', cx, cy - reach + 9, 'center', INK);

  // Escalera: a cada distancia, su nota.
  const p = { x: side + 56, y: 10, w: w - side - 64, h: h - 30 };
  const low = Math.log2(hzAt(0));
  const high = Math.log2(hzAt(1));
  const toX = (radius) => p.x + radius * p.w;
  const toY = (hz) => p.y + p.h * (1 - (Math.log2(hz) - low) / (high - low));
  yAxis(g, p, [0, 1 / 3, 2 / 3, 1].map((radius) => [hzAt(radius), `${Math.round(hzAt(radius))} Hz`]), toY);
  xLabels(g, p, [[0, 'center'], [0.5, 'mid distance'], [1, 'edge']]);
  const steps = [];
  for (let i = 0; i <= 240; i++) {
    const radius = i / 240;
    const y = toY(hzAt(radius));
    if (steps.length && steps[steps.length - 1][1] !== y) steps.push([toX(radius), steps[steps.length - 1][1]]);
    steps.push([toX(radius), y]);
  }
  line(g, steps, '#59ffc8');
  const radius = (best + 0.5) / BANDS;
  const hz = hzAt(radius);
  if (top > 0.02) dot(g, toX(radius), toY(hz), AMBER);
  return {
    summary: top > 0.02 ? `Needle at ${Math.round(progress * 360)}°: the brightest point of the strip is at ${Math.round(radius * 100)}% of the radius and sounds at ${Math.round(hz)} Hz.` : `Needle at ${Math.round(progress * 360)}°: strip almost empty.`,
    hover: (x) => {
      if (x < p.x) return null;
      const at = clamp01((x - p.x) / p.w);
      return [`At ${Math.round(at * 100)}% of the radius`, `${Math.round(hzAt(at))} Hz`];
    },
  };
}

export const CHARTS = { timeline, composition, profile, canopy, series, radial };

// Lo que debe registrarse con cada lectura, aunque la gráfica no esté a la vista.
export function collect(f, st, spec) {
  if (spec.kind === 'series' && f.fresh) collectSeries(f, st, spec);
}

// Leyenda de cada gráfica: [{ color, label, shape }]
export function legendFor(spec, layers) {
  switch (spec.kind) {
    case 'timeline':
      return [{ color: AMBER, label: 'Total light of the image (2012 = 100)' }, { color: INK, label: 'Slider year', shape: 'marker' }];
    case 'composition':
      return layers.map((layer, k) => ({ color: SLOT_COLORS[k], label: `${layer.icon} ${layer.name}`, shape: 'box' }));
    case 'profile':
      return [
        { color: SLOT_COLORS[spec.warm], label: `${layers[spec.warm].icon} ${layers[spec.warm].name}` },
        { color: SLOT_COLORS[spec.flow], label: `${layers[spec.flow].icon} ${layers[spec.flow].name}` },
        { color: INK, label: 'Buoy', shape: 'marker' },
      ];
    case 'canopy':
      return [{ color: '#2fae6e', label: 'Mean height over land' }, { color: NEUTRAL, label: 'Tallest tree in the strip' }, { color: INK, label: 'Sweep', shape: 'marker' }];
    case 'series':
      return [
        { color: SLOT_COLORS[spec.key], label: `${layers[spec.key].icon} ${layers[spec.key].name}, under the sweep` },
        { color: NEUTRAL, label: spec.flash ? 'New discharges across the map' : `${layers[spec.key].name}, whole frame` },
        { color: AMBER, label: 'Peak', shape: 'dot' },
      ];
    default:
      return [{ color: '#59ffc8', label: 'Note for each distance' }, { color: AMBER, label: 'Brightest point of the strip', shape: 'dot' }];
  }
}
