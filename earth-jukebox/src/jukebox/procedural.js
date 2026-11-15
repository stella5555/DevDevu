// Reconstrucción procedural de cada dataset, por si no carga su fotograma del
// SVS (public/svs/<id>.jpg). No pretende ser un mapa real: reproduce la paleta
// y la estructura general de la visualización original para que el barrido,
// el histograma y la sonificación sigan teniendo sentido.

const W = 768;
const H = 432;

function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x, y, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x, y, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x, y, seed + i * 17);
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum / (1 - 0.5 ** octaves);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

// Degradado por tramos: stops = [[posición 0..1, [r, g, b]], …]
function ramp(stops, t) {
  t = clamp01(t);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      return lerp(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return stops[stops.length - 1][1];
}

// Filamentos: crestas finas de ruido, como líneas de corriente.
const ridges = (x, y, seed) => 1 - Math.abs(fbm(x, y, seed) * 2 - 1);
const isLand = (u, v, seed, level = 0.47) => fbm(u * 5, v * 3.2, seed) - Math.abs(v - 0.45) * 0.35 > level;

// Disco del planeta: 0 fuera, sombreado 0..1 dentro (más oscuro en el limbo).
function globe(u, v) {
  const d = Math.hypot((u - 0.5) * (W / H), v - 0.5) / 0.44;
  return d >= 1 ? 0 : 0.35 + 0.65 * Math.sqrt(1 - d * d);
}

function paint(g, shade) {
  const image = g.createImageData(W, H);
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i += 4) {
      const [r, gr, b] = shade(x / W, y / H);
      image.data[i] = r;
      image.data[i + 1] = gr;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
}

function dots(g, rnd, count, accept, colors, size = 1.4) {
  for (let i = 0; i < count; i++) {
    const u = rnd();
    const v = rnd();
    const keep = accept(u, v);
    if (rnd() > keep) continue;
    g.globalAlpha = 0.35 + rnd() * 0.65;
    g.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const s = size * (0.5 + rnd());
    g.fillRect(u * W, v * H, s, s);
  }
  g.globalAlpha = 1;
}

const THERMAL = [[0, [6, 18, 70]], [0.3, [14, 90, 200]], [0.5, [30, 185, 110]], [0.68, [240, 225, 60]], [0.85, [232, 90, 30]], [1, [150, 16, 16]]];
const CANOPY = [[0, [120, 92, 50]], [0.4, [92, 110, 44]], [0.75, [70, 170, 50]], [1, [225, 245, 200]]];

const STYLES = {
  // Caldwell 73: núcleo blanco denso y estrellas blancas, azules y naranjas.
  stars(g, rnd) {
    g.fillStyle = '#020204';
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * 0.42);
    glow.addColorStop(0, 'rgba(255, 250, 235, 0.95)');
    glow.addColorStop(0.25, 'rgba(230, 220, 205, 0.35)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    const colors = ['#ffffff', '#ffffff', '#fff3df', '#bcd3ff', '#8fb4ff', '#ffb070', '#ff7850'];
    for (let i = 0; i < 4200; i++) {
      const spread = rnd() < 0.6 ? 0.12 : 0.42;
      const radius = Math.abs(Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(Math.PI * 2 * rnd())) * spread * H;
      const angle = rnd() * Math.PI * 2;
      const size = rnd() < 0.04 ? 2.2 + rnd() * 1.6 : 0.6 + rnd() * 1.1;
      g.globalAlpha = 0.4 + rnd() * 0.6;
      g.fillStyle = colors[Math.floor(rnd() * colors.length)];
      g.beginPath();
      g.arc(W / 2 + Math.cos(angle) * radius * 1.25, H / 2 + Math.sin(angle) * radius, size, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  },

  // Luces nocturnas: continentes gris oscuro, ciudades ámbar, cambio en morado/naranja.
  lights(g, rnd) {
    paint(g, (u, v) => (isLand(u, v, 7) ? [26, 28, 33] : [5, 6, 9]));
    const urban = (u, v) => (isLand(u, v, 7) ? smooth(0.5, 0.75, fbm(u * 14, v * 9, 41)) : 0);
    dots(g, rnd, 26000, urban, ['#ffd58a', '#ffb454', '#fff1cf'], 1.2);
    dots(g, rnd, 5000, (u, v) => urban(u, v) * smooth(0.55, 0.7, fbm(u * 6, v * 4, 77)), ['#b98cff', '#ff8a3c'], 1.6);
  },

  // Rayos: mapa gris con puntos amarillos concentrados en los trópicos.
  sparks(g, rnd) {
    paint(g, (u, v) => (isLand(u, v, 7) ? [62, 62, 62] : [36, 36, 36]));
    const storms = (u, v) => (isLand(u, v, 7) ? smooth(0.3, 0, Math.abs(v - 0.52)) * smooth(0.42, 0.7, fbm(u * 9, v * 6, 23)) : 0);
    dots(g, rnd, 30000, storms, ['#ffe94d', '#fff6a8', '#ffd21f'], 1.8);
  },

  // Corrientes: filamentos coloreados por temperatura; tierra gris.
  currents(g) {
    paint(g, (u, v) => {
      if (isLand(u, v, 7)) return [88, 88, 88];
      const heat = 1 - Math.abs(v - 0.5) * 2.1 + (fbm(u * 6, v * 6, 9) - 0.5) * 0.5;
      const flow = 0.35 + 0.65 * smooth(0.55, 0.95, ridges(u * 16, v * 11, 13));
      return ramp(THERMAL, heat).map((c) => c * flow);
    });
  },

  // Aerosoles: plumas de colores sobre un mapa casi negro.
  aerosols(g) {
    paint(g, (u, v) => {
      let c = isLand(u, v, 11) ? [26, 30, 28] : [6, 10, 13];
      const swirl = ridges(u * 7 + fbm(u * 3, v * 3, 5), v * 7, 19);
      c = add(c, [60, 235, 90], smooth(0.72, 0.98, swirl) * smooth(0.25, 0.05, Math.abs(v - 0.28)) * 0.9); // cintas verdes
      c = add(c, [200, 215, 235], smooth(0.7, 0.98, ridges(u * 9, v * 9, 29)) * smooth(0.62, 0.9, v) * 0.7); // sal marina
      const dust = Math.exp(-(((u - 0.47) / 0.16) ** 2) - ((v - 0.42) / 0.05) ** 2);
      c = add(c, [225, 130, 230], dust * (0.5 + fbm(u * 12, v * 12, 31)) * 0.9); // polvo sahariano
      const smoke = Math.exp(-(((u - 0.55) / 0.05) ** 2) - ((v - 0.63) / 0.07) ** 2);
      return add(c, [255, 120, 40], smoke * (0.4 + fbm(u * 14, v * 14, 37))); // humo de incendios
    });
  },

  // Perpetual Ocean 2 (versión por temperatura): océano azul oscuro con
  // filamentos naranjas y amarillos; tierra verde y ocre.
  globeOcean(g) {
    paint(g, (u, v) => {
      const k = globe(u, v);
      if (!k) return [0, 0, 0];
      if (isLand(u * 1.4, v * 1.4, 15, 0.56)) return lerp([70, 120, 60], [190, 160, 100], fbm(u * 8, v * 8, 3)).map((c) => c * k);
      const flow = smooth(0.62, 0.97, ridges(u * 18, v * 18, 21));
      return lerp([14, 40, 110], lerp([235, 120, 40], [255, 215, 90], flow), flow).map((c) => c * k);
    });
  },

  // CO₂: globo casi negro con velos anaranjados.
  globeCarbon(g) {
    paint(g, (u, v) => {
      const k = globe(u, v);
      if (!k) return [0, 0, 0];
      const base = isLand(u * 1.4, v * 1.4, 25) ? [30, 26, 22] : [8, 8, 9];
      const veil = smooth(0.45, 0.85, fbm(u * 6 + fbm(u * 3, v * 3, 2), v * 6, 27)) * smooth(0.75, 0.2, v);
      return add(base, [255, 130, 50], veil * 0.85).map((c) => c * k);
    });
  },

  // Calidad del aire: tres gajos, uno por contaminante.
  globeSectors(g) {
    const sectors = [[[250, 240, 200], [235, 190, 90]], [[20, 120, 40], [80, 240, 100]], [[90, 70, 150], [215, 195, 245]]];
    paint(g, (u, v) => {
      const k = globe(u, v);
      if (!k) return [0, 0, 0];
      const [from, to] = sectors[u < 0.44 ? 0 : u < 0.6 ? 1 : 2];
      return lerp(from, to, fbm(u * 8 + fbm(u * 4, v * 4, 6), v * 8, 33)).map((c) => c * k);
    });
  },

  // GEDI: océano azul liso; el color del bosque crece con su altura.
  globeForest(g) {
    paint(g, (u, v) => {
      const k = globe(u, v);
      if (!k) return [0, 0, 0];
      if (!isLand(u * 1.3, v * 1.3, 35)) return [70, 125, 170].map((c) => c * k);
      const height = fbm(u * 10, v * 10, 39) * smooth(0.4, 0.05, Math.abs(v - 0.5));
      return ramp(CANOPY, height * 1.6).map((c) => c * k);
    });
  },

  // Río atmosférico: banda azul en diagonal sobre un océano gris azulado.
  river(g) {
    paint(g, (u, v) => {
      if (u > 0.68 + (fbm(v * 5, 1, 45) - 0.5) * 0.3) return lerp([110, 150, 70], [215, 200, 120], fbm(u * 9, v * 9, 47));
      let c = lerp([84, 110, 118], [70, 190, 205], smooth(0.5, 0.8, fbm(u * 5, v * 5, 49)));
      const band = Math.abs(v - (0.95 - u * 1.15) + (fbm(u * 6, v * 6, 51) - 0.5) * 0.12);
      return lerp(c, [25, 165, 255], smooth(0.09, 0.02, band));
    });
  },
};

export function drawProcedural(style, seed = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  STYLES[style](canvas.getContext('2d'), mulberry32(seed));
  return canvas;
}
