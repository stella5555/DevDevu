import { drawProcedural } from './procedural.js';

// Análisis en vivo de la estación. Unas 10 veces por segundo se copia el
// fotograma actual del vídeo a un lienzo pequeño y se lee píxel a píxel:
//
//   · cuánto pertenece cada píxel a cada uno de los 4 fenómenos del dataset
//   · las 128 franjas del barrido (lo que mueve la música y las métricas)
//   · el histograma de cada fenómeno
//   · una rejilla gruesa por fenómeno (lo que usan las misiones)
//
// Todo se guarda en búferes que se reutilizan: nada se reserva por fotograma.

export const STEPS = 128; // franjas por barrido (semicorcheas)
export const BANDS = 16; // divisiones a lo largo de cada franja (altura de nota)
export const GRID = 64; // columnas de la rejilla gruesa
const WIDTH = 512; // resolución de análisis
const LAYERS = 4;

// Fuente de píxeles de un dataset, por orden de preferencia: clip del SVS,
// su fotograma fijo y, si nada carga, la reconstrucción procedural. Todo se
// sirve desde public/svs/ porque el SVS no deja leer sus píxeles desde otra
// web. `?procedural` en la URL fuerza la reconstrucción, para probarla.
export function loadSource(svsId, { video, fallback }) {
  const base = `${import.meta.env.BASE_URL}svs/${svsId}`;
  const procedural = () => ({ el: drawProcedural(fallback, svsId), origin: 'procedural', width: 768, height: 432 });
  if (new URLSearchParams(window.location.search).has('procedural')) return Promise.resolve(procedural());

  const still = () =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ el: img, origin: 'still', width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(procedural());
      img.src = `${base}.jpg`;
    });
  if (!video) return still();

  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.poster = `${base}.jpg`;
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => still().then(settle), 8000); // red lenta o códec ausente
    el.addEventListener('loadeddata', () => settle({ el, origin: 'video', width: el.videoWidth, height: el.videoHeight }), { once: true });
    el.addEventListener('error', () => still().then(settle), { once: true });
    el.src = `${base}.mp4`;
  });
}

export function createAnalyzer({ scan, layers }, aspect) {
  const w = WIDTH;
  const h = Math.max(8, Math.round(w / aspect));
  const n = w * h;
  const gw = GRID;
  const gh = Math.max(4, Math.round(GRID / aspect));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  const iso = document.createElement('canvas');
  iso.width = w;
  iso.height = h;
  const isoG = iso.getContext('2d');
  const isoImage = isoG.createImageData(w, h);

  // Geometría fija: a qué franja, banda y celda pertenece cada píxel.
  const stripOf = new Uint8Array(n);
  const bandOf = new Uint8Array(n);
  const posOf = new Float32Array(n); // 0 abajo/centro → 1 arriba/borde
  const cellOf = new Uint16Array(n);
  const stripCount = new Uint32Array(STEPS);
  const bandCount = new Uint32Array(STEPS * BANDS);
  const cellCount = new Uint32Array(gw * gh);
  const reach = Math.hypot(w, h) / 2;
  for (let y = 0, p = 0; y < h; y++) {
    for (let x = 0; x < w; x++, p++) {
      let strip;
      let pos;
      if (scan === 'radial') {
        // Aguja en sentido horario desde las 12; bandas del centro al borde.
        const dx = x + 0.5 - w / 2;
        const dy = y + 0.5 - h / 2;
        const turn = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        strip = Math.min(STEPS - 1, Math.floor((turn / (Math.PI * 2)) * STEPS));
        pos = Math.min(0.9999, Math.hypot(dx, dy) / reach);
      } else {
        // Línea vertical de izquierda a derecha; bandas de abajo arriba.
        strip = Math.min(STEPS - 1, Math.floor((x * STEPS) / w));
        pos = (h - 1 - y) / (h - 1);
      }
      const band = Math.min(BANDS - 1, Math.floor(pos * BANDS));
      stripOf[p] = strip;
      bandOf[p] = band;
      posOf[p] = pos;
      cellOf[p] = Math.min(gh - 1, Math.floor((y * gh) / h)) * gw + Math.min(gw - 1, Math.floor((x * gw) / w));
      stripCount[strip]++;
      bandCount[strip * BANDS + band]++;
      cellCount[cellOf[p]]++;
    }
  }

  const luma = new Uint8Array(n);
  let reference = null; // luminosidad de un fotograma anterior (capas "lo que ha cambiado")
  const weights = Array.from({ length: LAYERS }, () => new Uint8Array(n));
  const bandSum = Array.from({ length: LAYERS }, () => new Float32Array(STEPS * BANDS));
  const cellSum = Array.from({ length: LAYERS }, () => new Float32Array(gw * gh));
  const peak = Array.from({ length: LAYERS }, () => new Uint8Array(STEPS));
  const peakAt = Array.from({ length: LAYERS }, () => new Float32Array(STEPS));
  const lumaSum = new Float64Array(STEPS);
  const lumaSq = new Float64Array(STEPS);
  const lumaBins = new Uint32Array(STEPS * 32);
  const match = layers.map((layer) => layer.match);

  const analysis = {
    w,
    h,
    gw,
    gh,
    scan,
    data: null, // RGBA del fotograma analizado
    luma,
    weights,
    frame: 0, // cuántos fotogramas se han analizado
    hist: Array.from({ length: LAYERS }, () => new Uint32Array(256)),
    cells: Array.from({ length: LAYERS }, () => new Float32Array(gw * gh)), // media 0..1 por celda
    coverage: new Float32Array(LAYERS), // fracción de la imagen que ocupa cada fenómeno
    strips: Array.from({ length: STEPS }, () => ({
      v: new Float32Array(LAYERS), // intensidad media de cada fenómeno, 0..1
      bands: Array.from({ length: LAYERS }, () => new Float32Array(BANDS)),
      flux: new Float32Array(LAYERS), // cambio respecto a la franja anterior
      peak: new Float32Array(LAYERS), // máximo de cada fenómeno…
      peakPos: new Float32Array(LAYERS), // …y dónde está a lo largo de la franja
      total: 0, // suma de los cuatro
      l: 0,
      sd: 0, // contraste: σ de luminosidad
      entropy: 0, // bits, 0..5
    })),
    range: Array.from({ length: LAYERS }, () => [0, 1]), // mín/máx de v a lo largo del barrido
    fluxRange: Array.from({ length: LAYERS }, () => [0, 1]),
    totalRange: [0, 1],
    maxBand: new Float32Array(LAYERS),
    maxPeak: new Float32Array(LAYERS),
    mean: new Float32Array(LAYERS),
    hottest: new Uint8Array(LAYERS), // franja donde más pesa cada fenómeno
  };

  function update(source) {
    g.drawImage(source, 0, 0, w, h);
    const { data } = g.getImageData(0, 0, w, h);
    analysis.data = data;
    for (let p = 0, i = 0; p < n; p++, i += 4) luma[p] = (data[i] * 54 + data[i + 1] * 183 + data[i + 2] * 19) >> 8;

    for (let k = 0; k < LAYERS; k++) {
      bandSum[k].fill(0);
      cellSum[k].fill(0);
      peak[k].fill(0);
      analysis.hist[k].fill(0);
    }
    lumaSum.fill(0);
    lumaSq.fill(0);
    lumaBins.fill(0);
    const covered = [0, 0, 0, 0];

    for (let y = 0, p = 0, i = 0; y < h; y++) {
      const v = (y + 0.5) / h;
      for (let x = 0; x < w; x++, p++, i += 4) {
        const l = luma[p];
        // Borde: cuánto cambia la luminosidad alrededor del píxel.
        const edge =
          Math.abs(luma[x < w - 1 ? p + 1 : p] - luma[x > 0 ? p - 1 : p]) + Math.abs(luma[y < h - 1 ? p + w : p] - luma[y > 0 ? p - w : p]);
        const strip = stripOf[p];
        const slot = strip * BANDS + bandOf[p];
        const cell = cellOf[p];
        const ref = reference ? reference[p] : l;
        const u = (x + 0.5) / w;
        for (let k = 0; k < LAYERS; k++) {
          let value = match[k](data[i], data[i + 1], data[i + 2], l, edge, u, v, ref);
          value = value <= 0 ? 0 : value >= 1 ? 255 : (value * 255) | 0;
          weights[k][p] = value;
          analysis.hist[k][value]++;
          if (!value) continue;
          bandSum[k][slot] += value;
          cellSum[k][cell] += value;
          if (value > 64) covered[k]++;
          if (value > peak[k][strip]) {
            peak[k][strip] = value;
            peakAt[k][strip] = posOf[p];
          }
        }
        lumaSum[strip] += l;
        lumaSq[strip] += l * l;
        lumaBins[strip * 32 + (l >> 3)]++;
      }
    }

    // De acumuladores a franjas.
    for (let s = 0; s < STEPS; s++) {
      const strip = analysis.strips[s];
      const size = stripCount[s] || 1;
      strip.total = 0;
      for (let k = 0; k < LAYERS; k++) {
        let sum = 0;
        for (let b = 0; b < BANDS; b++) {
          const slot = s * BANDS + b;
          sum += bandSum[k][slot];
          strip.bands[k][b] = bandCount[slot] ? bandSum[k][slot] / bandCount[slot] / 255 : 0;
        }
        strip.v[k] = sum / size / 255;
        strip.peak[k] = peak[k][s] / 255;
        strip.peakPos[k] = peakAt[k][s];
        strip.total += strip.v[k];
      }
      const mean = lumaSum[s] / size;
      strip.l = mean / 255;
      strip.sd = Math.sqrt(Math.max(0, lumaSq[s] / size - mean * mean)) / 255;
      let entropy = 0;
      for (let b = 0; b < 32; b++) {
        const count = lumaBins[s * 32 + b];
        if (count) entropy -= (count / size) * Math.log2(count / size);
      }
      strip.entropy = entropy;
    }

    // Cambio entre franjas vecinas y rangos a lo largo del barrido.
    let totalMin = Infinity;
    let totalMax = 0;
    for (let k = 0; k < LAYERS; k++) {
      let min = Infinity;
      let max = 0;
      let fluxMin = Infinity;
      let fluxMax = 0;
      let maxBand = 1e-6;
      let maxPeak = 1e-6;
      let sum = 0;
      let hottest = 0;
      for (let s = 0; s < STEPS; s++) {
        const strip = analysis.strips[s];
        const prev = analysis.strips[(s + STEPS - 1) % STEPS];
        let diff = 0;
        for (let b = 0; b < BANDS; b++) {
          diff += Math.abs(strip.bands[k][b] - prev.bands[k][b]);
          if (strip.bands[k][b] > maxBand) maxBand = strip.bands[k][b];
        }
        strip.flux[k] = diff / BANDS;
        const value = strip.v[k];
        if (value < min) min = value;
        if (value > max) {
          max = value;
          hottest = s;
        }
        if (strip.flux[k] < fluxMin) fluxMin = strip.flux[k];
        if (strip.flux[k] > fluxMax) fluxMax = strip.flux[k];
        if (strip.peak[k] > maxPeak) maxPeak = strip.peak[k];
        sum += value;
      }
      analysis.range[k][0] = min;
      analysis.range[k][1] = max;
      analysis.fluxRange[k][0] = fluxMin;
      analysis.fluxRange[k][1] = fluxMax;
      analysis.maxBand[k] = maxBand;
      analysis.maxPeak[k] = maxPeak;
      analysis.mean[k] = sum / STEPS;
      analysis.hottest[k] = hottest;
      analysis.coverage[k] = covered[k] / n;
      for (let c = 0; c < gw * gh; c++) analysis.cells[k][c] = cellSum[k][c] / cellCount[c] / 255;
    }
    for (let s = 0; s < STEPS; s++) {
      const { total } = analysis.strips[s];
      if (total < totalMin) totalMin = total;
      if (total > totalMax) totalMax = total;
    }
    analysis.totalRange[0] = totalMin;
    analysis.totalRange[1] = totalMax;
    analysis.frame++;
    return analysis;
  }

  return {
    analysis,
    update,
    // Fija el fotograma actual como referencia para las capas de cambio.
    setReference() {
      reference = new Uint8Array(luma);
    },
    // Imagen con un solo fenómeno brillando y el resto atenuado y sin color.
    renderIsolated(k) {
      const { data } = analysis;
      const out = isoImage.data;
      const layer = weights[k];
      for (let p = 0, i = 0; p < n; p++, i += 4) {
        const t = Math.pow(layer[p] / 255, 0.7);
        const dim = luma[p] * 0.16;
        const boost = 1 + 0.5 * t;
        out[i] = Math.min(255, dim + (data[i] * boost - dim) * t);
        out[i + 1] = Math.min(255, dim + (data[i + 1] * boost - dim) * t);
        out[i + 2] = Math.min(255, dim + (data[i + 2] * boost - dim) * t);
        out[i + 3] = 255;
      }
      isoG.putImageData(isoImage, 0, 0);
      return iso;
    },
  };
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

// Valor de una franja dentro del rango que recorre el barrido, 0..1.
export function normalized(analysis, k, value) {
  const [min, max] = analysis.range[k];
  return max - min < 1e-6 ? 0 : clamp01((value - min) / (max - min));
}

export function normalizedFlux(analysis, k, value) {
  const [min, max] = analysis.fluxRange[k];
  return max - min < 1e-6 ? 0 : clamp01((value - min) / (max - min));
}

// Media de cada fenómeno (0..1) y de la luminosidad en un disco alrededor de
// un punto (u, v en 0..1). Es lo que "ve" una sonda, una boya o el cursor.
export function sampleAt(analysis, u, v, radius = 4) {
  const { w, h, weights, luma } = analysis;
  const cx = Math.round(clamp01(u) * (w - 1));
  const cy = Math.round(clamp01(v) * (h - 1));
  const out = { w: [0, 0, 0, 0], l: 0, max: 0, maxU: u, maxV: v };
  let count = 0;
  for (let y = Math.max(0, cy - radius); y <= Math.min(h - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(w - 1, cx + radius); x++) {
      const p = y * w + x;
      for (let k = 0; k < LAYERS; k++) out.w[k] += weights[k][p];
      out.l += luma[p];
      if (luma[p] > out.max) {
        out.max = luma[p];
        out.maxU = (x + 0.5) / w;
        out.maxV = (y + 0.5) / h;
      }
      count++;
    }
  }
  for (let k = 0; k < LAYERS; k++) out.w[k] /= count * 255;
  out.l /= count * 255;
  out.max /= 255;
  return out;
}

// Valor de la rejilla gruesa de un fenómeno, suavizado con sus vecinas
// (radio 1: las 8 de alrededor; radio 2: una zona más ancha).
export function cellAt(analysis, k, u, v, radius = 1) {
  const { gw, gh, cells } = analysis;
  const cx = Math.min(gw - 1, Math.floor(clamp01(u) * gw));
  const cy = Math.min(gh - 1, Math.floor(clamp01(v) * gh));
  let sum = 0;
  let count = 0;
  for (let y = Math.max(0, cy - radius); y <= Math.min(gh - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(gw - 1, cx + radius); x++) {
      sum += cells[k][y * gw + x];
      count++;
    }
  }
  return sum / count;
}

// Máximo de la rejilla suavizada de un fenómeno y dónde está.
export function hotspot(analysis, k, radius = 1) {
  const { gw, gh } = analysis;
  let best = { value: 0, u: 0.5, v: 0.5 };
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const u = (x + 0.5) / gw;
      const v = (y + 0.5) / gh;
      const value = cellAt(analysis, k, u, v, radius);
      if (value > best.value) best = { value, u, v };
    }
  }
  return best;
}

// Celda (sin suavizar) donde un fenómeno es más intenso.
export function peakCell(analysis, k) {
  const { gw, gh, cells } = analysis;
  let best = 0;
  for (let c = 1; c < gw * gh; c++) if (cells[k][c] > cells[k][best]) best = c;
  return { value: cells[k][best], u: ((best % gw) + 0.5) / gw, v: (Math.floor(best / gw) + 0.5) / gh };
}

// Estadística de un fenómeno para la tabla del modo lectura.
export function layerStats(analysis, k) {
  const counts = analysis.hist[k];
  let present = 0;
  let sum = 0;
  for (let value = 1; value < 256; value++) {
    present += counts[value];
    sum += value * counts[value];
  }
  return {
    coverage: analysis.coverage[k], // fracción de la imagen con presencia clara
    intensity: present ? sum / present / 255 : 0, // intensidad media donde aparece
    hottest: analysis.hottest[k] / STEPS, // posición del barrido donde más pesa
  };
}

// Descripción en palabras de una franja, para el modo lectura.
export function describeStrip(analysis, index, layers) {
  const s = analysis.strips[index];
  const where =
    analysis.scan === 'radial'
      ? `Aguja a ${Math.round((index / STEPS) * 360)} grados`
      : `Barrido al ${Math.round((index / STEPS) * 100)} por ciento del ancho`;
  const light = s.l < 0.06 ? 'casi negra' : s.l < 0.2 ? 'oscura' : s.l < 0.45 ? 'de brillo medio' : 'brillante';
  const level = (value) => (value > 0.66 ? 'fuerte' : value > 0.33 ? 'medio' : 'suave');
  const present = layers
    .map((layer, k) => ({ name: layer.name.toLowerCase(), value: normalized(analysis, k, s.v[k]), raw: s.v[k] }))
    .filter((item) => item.raw > 0.004 && item.value > 0.12)
    .sort((a, b) => b.value - a.value);
  if (!present.length) return `${where}: franja ${light}, sin ninguno de los cuatro fenómenos. Casi silencio.`;
  return `${where}: franja ${light}. Suenan ${present.map((item) => `${item.name} (${level(item.value)})`).join(', ')}.`;
}
