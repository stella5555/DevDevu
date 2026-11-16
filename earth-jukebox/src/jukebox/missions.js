import { GEDI_MAX_METERS, gediHeight } from '../data/datasets.js';
import { sampleAt, cellAt, hotspot, peakCell } from './analysis.js';

// Las 7 mecánicas de misión de la estación. Cada una es un objeto con el
// mismo contrato, que el visor y la tarjeta de misión usan sin conocerlas:
//
//   steps / done     lista de objetivos y cuáles están cumplidos
//   hint             texto vivo de ayuda
//   gauges           medidores vivos [{ label, value 0..1 }]
//   control          control propio de la tarjeta: deslizador o botón
//   pointer(t,u,v)   puntero sobre el visor ('down' | 'move' | 'up' | 'leave'),
//                    con u, v en 0..1 sobre la imagen
//   update(dt)       cada frame
//   draw(g,W,H,dpr)  capa propia sobre el visor
//   hover            true si la misión ya da sonido al pasar el cursor
//
// `m` es lo que la estación presta a la misión: el análisis vivo (m.A()), el
// motor de audio (m.son), anillos sobre el visor (m.ring), el fenómeno aislado
// (m.isolated()), el vídeo y m.notify() para refrescar la tarjeta.

const pct = (value) => `${Math.round(value * 100)}%`;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const AMBER = '#ffb454';
const SCOPE = '#59ffc8';

function base(m) {
  return {
    steps: m.spec.steps,
    done: m.spec.steps.map(() => false),
    hint: '',
    gauges: [],
    control: null,
    hover: false,
    pointer() {},
    update() {},
    draw() {},
  };
}

// Máximo suavizado de un fenómeno, recalculado solo cuando hay fotograma nuevo.
function tracker(m, layer, radius = 1) {
  let frame = -1;
  let spot = { value: 0, u: 0.5, v: 0.5 };
  return () => {
    const A = m.A();
    if (A.frame !== frame) {
      frame = A.frame;
      spot = hotspot(A, layer, radius);
    }
    return spot;
  };
}

function marker(g, x, y, dpr, color, radius = 9) {
  g.lineWidth = 4 * dpr;
  g.strokeStyle = 'rgba(2, 3, 10, 0.85)';
  g.beginPath();
  g.arc(x, y, radius * dpr, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2 * dpr;
  g.strokeStyle = color;
  g.stroke();
}

function label(g, text, x, y, dpr, align = 'left') {
  g.font = `${11 * dpr}px 'JetBrains Mono', ui-monospace, monospace`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineWidth = 3 * dpr;
  g.strokeStyle = 'rgba(2, 3, 10, 0.9)';
  g.strokeText(text, x, y);
  g.fillStyle = '#eafff8';
  g.fillText(text, x, y);
}

// ── #13786 · Tutorial: calibrar el onduloscopio ──
function calibrate(m) {
  const M = base(m);
  M.hint = 'Tap any star to hear it.';
  const NEAR = 0.18;
  const FAR = 0.4;
  M.pointer = (type, u, v) => {
    if (type !== 'down') return;
    const A = m.A();
    const star = sampleAt(A, u, v, 5); // se ajusta a la estrella más brillante bajo el dedo
    // Radio como lo mide el barrido: 0 en el centro, 1 en la esquina.
    const radius = Math.hypot((star.maxU - 0.5) * A.w, (star.maxV - 0.5) * A.h) / (Math.hypot(A.w, A.h) / 2);
    const hz = m.son.scaleHz(radius, 3, 2);
    m.son.tone(hz, { level: 0.08 + 0.45 * star.max, dur: 0.9, type: 'triangle' });
    m.ring(star.maxU, star.maxV, '#ffffff', 0.7 + star.max);
    const pitch = radius < NEAR ? 'low' : radius > FAR ? 'high' : 'mid';
    M.hint = `At ${pct(radius)} of the radius and brightness ${pct(star.max)}: ${pitch} note (${Math.round(hz)} Hz).`;
    if (radius < NEAR && star.max > 0.5) M.done[0] = true;
    if (radius > FAR && star.max > 0.55) M.done[1] = true;
    m.notify();
  };
  M.draw = (g, W, H, dpr) => {
    const reach = Math.hypot(W, H) / 2;
    g.setLineDash([6 * dpr, 6 * dpr]);
    g.lineWidth = 1.5 * dpr;
    for (const [radius, text] of [[NEAR, 'low'], [FAR, 'high →']]) {
      g.strokeStyle = 'rgba(234, 255, 248, 0.6)';
      g.beginPath();
      g.arc(W / 2, H / 2, radius * reach, 0, Math.PI * 2);
      g.stroke();
      label(g, text, W / 2 + radius * reach * 0.72, H / 2 - radius * reach * 0.72 - 9 * dpr, dpr, 'center');
    }
    g.setLineDash([]);
  };
  return M;
}

// ── #5313 · Viaje en el tiempo (2012 ↔ 2023) ──
function timeTravel(m) {
  const M = base(m);
  const [from, to] = m.spec.years;
  const top = tracker(m, m.spec.growth);
  let year = from;
  let pulse = 0;
  Object.defineProperty(M, 'year', { get: () => year }); // lo lee la curva temporal
  M.control = { type: 'slider', label: 'Year', min: from, max: to, step: 0.05, value: from, format: (value) => String(Math.round(value)) };
  M.hint = `You are in ${from}. Drag the slider toward ${to}.`;
  // El fotograma de 2012 es la referencia de "lo que ha crecido".
  M.init = () => m.setReference();
  M.setControl = (value) => {
    year = value;
    const t = (value - from) / (to - from);
    if (m.video) m.video.currentTime = t * m.spec.span;
    m.son.energy = 0.1 + 0.9 * t;
    if (value >= to - 0.4 && !M.done[0]) {
      M.done[0] = true;
      M.hint = `${to}: isolate “New metropolises” to see what grew, then tap the region that grew the most.`;
    } else if (!M.done[0]) {
      M.hint = `Year ${Math.round(value)}: new light covers ${pct(m.A().coverage[m.spec.growth])} of the image.`;
    }
    m.notify();
  };
  M.update = (dt) => {
    // Cuanto más avanza el año, más pulsos saltan donde la luz ha crecido.
    const t = (year - from) / (to - from);
    pulse -= dt * (0.5 + 7 * t);
    if (pulse > 0 || t < 0.05) return;
    pulse = 1;
    const A = m.A();
    const cells = A.cells[m.spec.growth];
    const peak = top().value;
    if (peak < 0.01) return;
    for (let tries = 0; tries < 12; tries++) {
      const c = Math.floor(Math.random() * cells.length);
      if (cells[c] < peak * 0.35) continue;
      const u = ((c % A.gw) + 0.5) / A.gw;
      const v = (Math.floor(c / A.gw) + 0.5) / A.gh;
      m.ring(u, v, AMBER, 0.5 + cells[c] / peak);
      if (!m.son.playing) m.son.tone(m.son.scaleHz(1 - v, 2, 3), { level: 0.05 + 0.1 * t, dur: 0.25, type: 'triangle' });
      break;
    }
  };
  M.pointer = (type, u, v) => {
    if (type !== 'down') return;
    if (!M.done[0]) {
      M.hint = `First travel to ${to} with the slider.`;
    } else {
      const here = cellAt(m.A(), m.spec.growth, u, v) / Math.max(1e-6, top().value);
      m.ring(u, v, here >= 0.6 ? SCOPE : '#ffffff', 1);
      if (here >= 0.6) M.done[1] = true;
      else M.hint = `Here light grew to ${pct(here)} of the maximum. Keep looking.`;
    }
    m.notify();
  };
  M.draw = (g, W, H, dpr) => {
    if (M.done[1]) marker(g, top().u * W, top().v * H, dpr, SCOPE, 12);
  };
  return M;
}

// ── #5669 y #5533 · Separar los 4 contaminantes ──
function separate(m) {
  const M = base(m);
  const target = m.spec.target;
  const core = tracker(m, target);
  let seen = -2;
  M.hint = 'Use “Isolate phenomenon” to try each layer.';
  M.update = () => {
    const isolated = m.isolated();
    if (isolated === seen) return;
    seen = isolated;
    if (isolated === target) {
      M.done[0] = true;
      M.hint = `Yes: it is ${m.layers[target].name.toLowerCase()}. Now tap the core of the cloud.`;
    } else if (isolated >= 0 && !M.done[0]) {
      M.hint = `${m.layers[isolated].name} covers ${pct(m.A().coverage[isolated])} of the image, but it does not form that cloud. Try another layer.`;
    }
    m.notify();
  };
  M.pointer = (type, u, v) => {
    if (type !== 'down') return;
    if (!M.done[0]) {
      M.hint = 'First isolate the right layer.';
    } else {
      const here = cellAt(m.A(), target, u, v) / Math.max(1e-6, core().value);
      m.ring(u, v, here >= 0.7 ? SCOPE : '#ffffff', 1);
      if (here >= 0.7) M.done[1] = true;
      else M.hint = `Density here: ${pct(here)} of the maximum. The core is where the layer shines brightest.`;
    }
    m.notify();
  };
  M.draw = (g, W, H, dpr) => {
    if (M.done[1]) marker(g, core().u * W, core().v * H, dpr, SCOPE, 12);
  };
  return M;
}

// Objeto que se arrastra por el visor (boya, sonda).
function draggable(M, m, start) {
  const item = { u: start[0], v: start[1], dragging: false, placed: false };
  M.pointer = (type, u, v) => {
    if (type === 'down') item.dragging = true;
    if (type === 'leave') item.dragging = false;
    if (item.dragging && type !== 'up') {
      item.u = clamp01(u);
      item.v = clamp01(v);
    }
    if (type === 'up' && item.dragging) {
      item.dragging = false;
      item.placed = true;
      M.dropped?.();
    }
  };
  return item;
}

// ── #3912 y #5425 · Boya sonora en el flujo oceánico ──
function buoy(m) {
  const M = base(m);
  const { warm, flow, cold } = m.spec;
  const fastest = tracker(m, flow);
  const item = draggable(M, m, [0.08, 0.86]);
  M.item = item; // lo lee el perfil norte–sur
  const read = { flow: 0, warmth: 0.5, water: false };
  let beat = 0;
  let held = 0;
  M.gauges = [{ label: 'Flow', value: 0 }, { label: 'Warmth', value: 0 }];
  M.hint = 'Drag the buoy from the corner and drop it in the water.';

  // Partículas que siguen las líneas de corriente. No hay dato de velocidad en
  // el vídeo: se mueven a lo largo de las crestas del flujo (perpendiculares a
  // su gradiente) y más deprisa donde el flujo es más intenso.
  const particles = Array.from({ length: 240 }, () => ({ u: Math.random(), v: Math.random(), pu: 0, pv: 0, age: Math.random() * 2 }));
  const field = (A, u, v) => {
    const x = Math.min(A.gw - 1, Math.max(0, Math.floor(u * A.gw)));
    const y = Math.min(A.gh - 1, Math.max(0, Math.floor(v * A.gh)));
    const c = y * A.gw + x;
    return A.cells[flow][c] + 0.6 * A.cells[warm][c];
  };

  M.dropped = () => {
    if (read.water) {
      M.done[0] = true;
      M.hint = 'Buoy in the water. Move it to a fast, warm current.';
    } else {
      M.hint = 'That is land: drop it in the ocean.';
    }
    m.notify();
  };

  M.update = (dt) => {
    const A = m.A();
    const peak = Math.max(0.02, fastest().value);
    const du = 1 / A.gw;
    const dv = 1 / A.gh;
    for (const p of particles) {
      const here = field(A, p.u, p.v);
      p.age -= dt;
      if (p.age <= 0 || p.u < 0 || p.u > 1 || p.v < 0 || p.v > 1 || here < peak * 0.04) {
        // Renace al azar donde haya corriente; si no la encuentra a la
        // primera, espera oculta al siguiente frame.
        p.age = 0;
        for (let tries = 0; tries < 8; tries++) {
          const u = Math.random();
          const v = Math.random();
          if (Math.random() > field(A, u, v) / peak) continue;
          p.u = u;
          p.v = v;
          p.age = 0.8 + Math.random() * 1.8;
          break;
        }
        p.pu = p.u;
        p.pv = p.v;
        continue;
      }
      const gx = field(A, p.u + du, p.v) - field(A, p.u - du, p.v);
      const gy = field(A, p.u, p.v + dv) - field(A, p.u, p.v - dv);
      const length = Math.hypot(gx, gy) || 1;
      const speed = (0.02 + 0.16 * Math.min(1, here / peak)) * dt;
      p.pu = p.u;
      p.pv = p.v;
      p.u += (-gy / length) * speed;
      p.v += (gx / length) * speed * (A.w / A.h);
    }

    const s = sampleAt(A, item.u, item.v, 6);
    read.water = s.w[warm] + s.w[cold] + s.w[flow] > 0.06;
    read.flow = clamp01(cellAt(A, flow, item.u, item.v) / peak);
    read.warmth = clamp01(s.w[warm] / (s.w[warm] + s.w[cold] + 0.02));
    M.gauges[0].value = read.water ? read.flow : 0;
    M.gauges[1].value = read.water ? read.warmth : 0;
    if (!item.placed && !item.dragging) return;

    // Pulsos de la boya: más rápidos con el flujo, más graves con el calor.
    beat -= dt;
    if (beat <= 0 && read.water) {
      beat = 1.05 - 0.85 * read.flow;
      const hz = m.son.scaleHz(1 - read.warmth, 2, 2);
      m.son.tone(hz, { level: 0.2, dur: 0.3 + 0.4 * read.warmth, type: read.warmth > 0.5 ? 'triangle' : 'sine' });
      if (read.warmth > 0.5) m.son.tone(hz / 2, { level: 0.16 * read.warmth, dur: 0.5 });
      m.ring(item.u, item.v, read.warmth > 0.5 ? '#ff8a3c' : '#5aa9ff', 0.6 + read.flow);
    }
    if (M.done[0] && !M.done[1]) {
      held = read.water && read.flow >= 0.7 && read.warmth >= 0.6 ? held + dt : 0;
      if (held >= 1.5) {
        M.done[1] = true;
        m.notify();
      }
    }
  };

  M.draw = (g, W, H, dpr) => {
    g.lineWidth = 1.2 * dpr;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(234, 255, 248, 0.55)';
    g.beginPath();
    for (const p of particles) {
      if (p.age <= 0) continue;
      g.moveTo(p.pu * W, p.pv * H);
      g.lineTo(p.u * W, p.v * H);
    }
    g.stroke();
    // La boya: flotador con mástil; el color sigue la calidez del agua.
    const x = item.u * W;
    const y = item.v * H;
    const color = !read.water ? '#cfcabd' : read.warmth > 0.5 ? '#ff8a3c' : '#5aa9ff';
    marker(g, x, y, dpr, color, 10);
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, 4 * dpr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#eafff8';
    g.lineWidth = 2 * dpr;
    g.beginPath();
    g.moveTo(x, y - 10 * dpr);
    g.lineTo(x, y - 22 * dpr);
    g.stroke();
    if (!item.placed && !item.dragging) label(g, 'buoy', x + 16 * dpr, y, dpr);
  };
  return M;
}

// ── #5011 · Cazador de tormentas ──
function stormHunter(m) {
  const M = base(m);
  M.hover = true;
  const layers = m.spec.flashes;
  let previous = null;
  let heat = null; // descarga acumulada por celda
  let frame = -1;
  let observed = 0;
  let lock = 0;
  let geiger = 0;
  let budget = 2; // anillos de destello disponibles
  let cursor = null;
  const epicenter = { u: 0.5, v: 0.5, value: 0 };
  M.gauges = [{ label: 'Discharge under the cursor', value: 0 }];
  M.hint = 'Watch where the flashes repeat.';

  const smooth = (A, cx, cy) => {
    let sum = 0;
    for (let y = Math.max(0, cy - 1); y <= Math.min(A.gh - 1, cy + 1); y++) {
      for (let x = Math.max(0, cx - 1); x <= Math.min(A.gw - 1, cx + 1); x++) sum += heat[y * A.gw + x];
    }
    return sum;
  };

  M.update = (dt) => {
    const A = m.A();
    const size = A.gw * A.gh;
    if (frame >= 0) observed += dt;
    budget = Math.min(3, budget + dt * 6);
    if (!heat) {
      heat = new Float32Array(size);
      previous = new Float32Array(size);
    }
    if (A.frame !== frame) {
      // Fotograma nuevo: los destellos son las celdas donde han aparecido rayos.
      const first = frame < 0;
      frame = A.frame;
      const flashes = [];
      for (let c = 0; c < size; c++) {
        let now = 0;
        for (const k of layers) now += A.cells[k][c];
        const rise = now - previous[c];
        if (!first && rise > 0.012) flashes.push({ c, rise });
        heat[c] = heat[c] * 0.996 + now;
        previous[c] = now;
      }
      flashes.sort((a, b) => b.rise - a.rise);
      const room = Math.min(2, Math.floor(budget));
      budget -= room;
      for (const { c, rise } of flashes.slice(0, room)) {
        m.ring(((c % A.gw) + 0.5) / A.gw, (Math.floor(c / A.gw) + 0.5) / A.gh, '#fff6a8', 0.3 + Math.min(0.5, rise * 6));
        m.son.click(0.06 + Math.min(0.2, rise * 3), 1800 + Math.random() * 3000);
      }
      epicenter.value = 0;
      for (let y = 0; y < A.gh; y++) {
        for (let x = 0; x < A.gw; x++) {
          const value = smooth(A, x, y);
          if (value > epicenter.value) Object.assign(epicenter, { value, u: (x + 0.5) / A.gw, v: (y + 0.5) / A.gh });
        }
      }
      if (observed >= 4 && !M.done[0]) {
        M.done[0] = true;
        M.hint = 'Enough data: move the cursor to where the most discharges pile up and hold it still.';
        m.notify();
      }
    }
    if (!cursor) {
      M.gauges[0].value = 0;
      lock = Math.max(0, lock - dt);
      return;
    }
    const here = smooth(A, Math.min(A.gw - 1, Math.floor(cursor.u * A.gw)), Math.min(A.gh - 1, Math.floor(cursor.v * A.gh))) / Math.max(1e-6, epicenter.value);
    M.gauges[0].value = clamp01(here);
    // Contador Geiger: chasquidos más seguidos cuanto más cerca del epicentro.
    geiger -= dt * (1 + 14 * here * here);
    if (geiger <= 0) {
      geiger = 1;
      m.son.click(0.04 + 0.1 * here, 900 + 900 * here);
    }
    lock = M.done[0] && !M.done[1] && here >= 0.85 ? lock + dt / 2 : Math.max(0, lock - dt);
    if (lock >= 1) {
      M.done[1] = true;
      m.notify();
    }
  };
  M.pointer = (type, u, v) => {
    cursor = type === 'leave' ? null : { u, v };
  };
  M.draw = (g, W, H, dpr) => {
    if (M.done[1]) marker(g, epicenter.u * W, epicenter.v * H, dpr, SCOPE, 14);
    if (!cursor) return;
    const x = cursor.u * W;
    const y = cursor.v * H;
    marker(g, x, y, dpr, AMBER, 16);
    if (lock > 0) {
      g.strokeStyle = SCOPE;
      g.lineWidth = 3 * dpr;
      g.beginPath();
      g.arc(x, y, 22 * dpr, -Math.PI / 2, -Math.PI / 2 + lock * Math.PI * 2);
      g.stroke();
    }
  };
  return M;
}

// ── #5196 y #4960 · Alerta de presión climática ──
function probe(m) {
  const M = base(m);
  const target = m.spec.target;
  const WIDE = 2;
  const core = tracker(m, target, WIDE);
  const item = draggable(M, m, [0.1, 0.84]);
  let saturation = 0;
  let beep = 0;
  M.gauges = [{ label: 'Saturation', value: 0 }];
  M.control = { type: 'button', label: 'Mark critical point' };
  M.hint = `Drag the probe around the viewer looking for ${m.spec.unit}.`;
  const read = () => {
    saturation = clamp01(cellAt(m.A(), target, item.u, item.v, WIDE) / Math.max(0.02, core().value));
    M.gauges[0].value = saturation;
  };
  M.update = (dt) => {
    read();
    if (saturation >= 0.5 && !M.done[0]) {
      M.done[0] = true;
      M.hint = 'Inside the corridor. Find the maximum and mark it.';
      m.notify();
    }
    if (!item.placed && !item.dragging) return;
    // Alarma: el pitido se acelera y sube de tono con la saturación.
    beep -= dt;
    if (beep <= 0) {
      beep = 0.95 - 0.82 * saturation;
      m.son.tone(330 * 2 ** (saturation * 1.6), { level: 0.07 + 0.1 * saturation, dur: 0.07, type: 'square' });
      if (saturation > 0.3) m.ring(item.u, item.v, saturation > 0.85 ? '#ff5d5d' : AMBER, 0.4 + saturation);
    }
  };
  M.action = () => {
    read();
    m.ring(item.u, item.v, saturation >= 0.85 ? SCOPE : '#ffffff', 1.4);
    if (saturation >= 0.85) M.done[1] = M.done[0] = true;
    else M.hint = `Saturation ${pct(saturation)}: not the critical point yet (85% needed). If it slips away, freeze the video.`;
    m.notify();
  };
  M.draw = (g, W, H, dpr) => {
    const x = item.u * W;
    const y = item.v * H;
    const color = saturation > 0.85 ? '#ff5d5d' : saturation > 0.5 ? AMBER : '#eafff8';
    marker(g, x, y, dpr, color, 12);
    g.strokeStyle = color;
    g.lineWidth = 1.5 * dpr;
    g.beginPath();
    g.moveTo(x - 20 * dpr, y);
    g.lineTo(x - 6 * dpr, y);
    g.moveTo(x + 6 * dpr, y);
    g.lineTo(x + 20 * dpr, y);
    g.moveTo(x, y - 20 * dpr);
    g.lineTo(x, y - 6 * dpr);
    g.moveTo(x, y + 6 * dpr);
    g.lineTo(x, y + 20 * dpr);
    g.stroke();
    label(g, item.placed || item.dragging ? pct(saturation) : 'probe', x + 24 * dpr, y, dpr);
    if (M.done[1]) marker(g, core().u * W, core().v * H, dpr, SCOPE, 16);
  };
  return M;
}

// ── #4950 · Perfil de elevación del dosel ──
function canopy(m) {
  const M = base(m);
  M.hover = true;
  const SAMPLES = 56;
  const SPAN = 0.28; // ancho del perfil, como fracción de la imagen
  const heights = new Float32Array(SAMPLES); // metros
  let peakFrame = -1;
  let peak = 0.02; // altura (0..1 de 50 m) de la celda más alta del fotograma
  let cursor = null;
  let note = 0;
  let under = 0; // m bajo el cursor
  M.gauges = [{ label: 'Height under the cursor', value: 0 }];
  M.hint = 'Move the cursor over land.';

  const heightAt = (A, x, y) => {
    let sum = 0;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= A.w || py >= A.h) continue;
        const i = (py * A.w + px) * 4;
        sum += gediHeight(A.data[i], A.data[i + 1], A.data[i + 2], A.luma[py * A.w + px]);
        count++;
      }
    }
    return count ? (sum / count) * GEDI_MAX_METERS : 0;
  };

  M.pointer = (type, u, v) => {
    if (type !== 'leave') cursor = { u, v };
  };
  M.update = (dt) => {
    const A = m.A();
    if (!cursor || !A.data) return;
    const y = Math.round(cursor.v * (A.h - 1));
    let land = 0;
    let total = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const u = cursor.u + (i / (SAMPLES - 1) - 0.5) * SPAN;
      heights[i] = u < 0 || u > 1 ? 0 : heightAt(A, Math.round(u * (A.w - 1)), y);
      if (heights[i] > 2) {
        land++;
        total += heights[i];
      }
    }
    const mean = land > SAMPLES * 0.4 ? total / land : 0;
    if (A.frame !== peakFrame) {
      peakFrame = A.frame;
      peak = Math.max(0.02, peakCell(A, m.spec.biomass).value);
    }
    const here = sampleAt(A, cursor.u, cursor.v, 4).w[m.spec.biomass];
    under = here * GEDI_MAX_METERS;
    M.gauges[0].value = clamp01(under / GEDI_MAX_METERS);

    // Marimba: más aguda cuanto más alto el dosel, más rica cuanto más denso.
    note -= dt;
    if (note <= 0 && under >= 3) {
      note = 0.13;
      m.son.marimba(m.son.scaleHz(under / GEDI_MAX_METERS, 3, 2), 0.1 + 0.3 * (under / GEDI_MAX_METERS), clamp01(mean / 28));
    }
    const text = `Canopy under the cursor: ${Math.round(under)} m · tallest in the image: ${Math.round(peak * GEDI_MAX_METERS)} m.`;
    let changed = text !== M.hint;
    M.hint = text;
    if (mean >= 20 && !M.done[0]) changed = M.done[0] = true;
    if (M.done[0] && here >= peak * 0.9 && !M.done[1]) {
      changed = M.done[1] = true;
      m.ring(cursor.u, cursor.v, SCOPE, 1.6);
    }
    if (changed) m.notify();
  };

  M.draw = (g, W, H, dpr) => {
    if (!cursor) return;
    // Transecto sobre la imagen.
    const x0 = (cursor.u - SPAN / 2) * W;
    const y = cursor.v * H;
    g.strokeStyle = '#eafff8';
    g.lineWidth = 1.5 * dpr;
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x0 + SPAN * W, y);
    g.stroke();
    marker(g, cursor.u * W, y, dpr, AMBER, 7);

    // Perfil de árboles en la franja inferior, de 0 a 50 m.
    const top = H * 0.7;
    const floor = H - 14 * dpr;
    const scale = (floor - top - 10 * dpr) / GEDI_MAX_METERS;
    g.fillStyle = 'rgba(2, 3, 10, 0.78)';
    g.fillRect(0, top, W, H - top);
    g.strokeStyle = 'rgba(215, 227, 244, 0.22)';
    g.lineWidth = dpr;
    for (const meters of [0, 25, 50]) {
      const py = Math.round(floor - meters * scale) + 0.5;
      g.beginPath();
      g.moveTo(40 * dpr, py);
      g.lineTo(W - 8 * dpr, py);
      g.stroke();
      label(g, `${meters} m`, 34 * dpr, py, dpr, 'right');
    }
    const step = (W - 56 * dpr) / SAMPLES;
    for (let i = 0; i < SAMPLES; i++) {
      const meters = heights[i];
      if (meters < 2) continue;
      const cx = 44 * dpr + (i + 0.5) * step;
      const tall = meters * scale;
      const t = clamp01(meters / GEDI_MAX_METERS);
      // Del oliva oscuro al crema, como la leyenda del SVS.
      g.fillStyle = `rgb(${Math.round(92 + 140 * t)}, ${Math.round(112 + 128 * t)}, ${Math.round(50 + 150 * t * t)})`;
      g.fillRect(cx - dpr * 0.75, floor - tall * 0.45, dpr * 1.5, tall * 0.45); // tronco
      g.beginPath(); // copa
      g.ellipse(cx, floor - tall * 0.68, Math.max(2 * dpr, step * 0.62), tall * 0.34, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  return M;
}

const KINDS = { calibrate, timeTravel, separate, buoy, stormHunter, probe, canopy };

export function createMission(m) {
  return KINDS[m.spec.kind](m);
}
