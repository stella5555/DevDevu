// Configuración de la estación de análisis (Pilar 2) para cada anomalía.
//
//   video     hay clip del SVS en public/svs/<id>.mp4 (el .jpg queda de póster
//             y de reserva). 'scrub': el vídeo no corre solo, lo mueve la misión.
//   scan      'sweep' línea vertical de izquierda a derecha · 'radial' aguja
//             que gira desde el centro (Caldwell 73: más lejos, más agudo).
//   sweep     segundos por vuelta. Con `follow`, nuestro barrido no dibuja su
//             propia aguja: sigue la línea que ya trae el vídeo de la NASA
//             (gira en sentido antihorario, una vuelta exacta por clip).
//   scale     escala musical (semitonos sobre la fundamental de la señal).
//   fallback  estilo de la reconstrucción procedural (jukebox/procedural.js).
//   see       modo lectura: qué se ve en el clip.
//   layers    los 4 fenómenos de la imagen. Cada uno mueve una pista (`role`)
//             y se puede aislar en el visor. `match` decide, píxel a píxel y
//             por su color, cuánto pertenece ese píxel al fenómeno (0..1):
//             es una lectura de los colores de la visualización —según la
//             leyenda oficial del SVS cuando existe—, no del dato científico.
//                 match(r, g, b, luma, borde, u, v, lumaDeReferencia)
//   chart     la gráfica propia del dataset (jukebox/charts.js).
//   mission   la mecánica propia de la estación (jukebox/missions.js).

const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
const MINOR_PENTATONIC = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

// Rampa 0..1 entre dos umbrales, y saturación (máx − mín) de un color.
const ramp = (x, from, to) => (x <= from ? 0 : x >= to ? 1 : (x - from) / (to - from));
const sat = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
const fromCenter = (u, v) => Math.hypot(u - 0.5, v - 0.5);

// GEDI: la leyenda del SVS va de 0 m (pardo oscuro) a 50 m (crema casi
// blanco), así que la altura del dosel se estima por la luminosidad de la tierra.
const gediLand = (r, g, b, l) => (1 - ramp(b - r, 5, 30)) * ramp(l, 28, 45);
export const GEDI_MAX_METERS = 50;
export const gediHeight = (r, g, b, l) => gediLand(r, g, b, l) * ramp(l, 60, 215); // 0..1 de 50 m

const rayo = (r, g, b) => ramp(Math.min(r, g) - b, 40, 120);
const tropico = (v) => 1 - ramp(Math.abs(v - 0.5), 0.12, 0.2);

export const DATASETS = {
  'caldwell-73': {
    video: true,
    scan: 'radial',
    sweep: { seconds: 30, follow: true },
    scale: MAJOR_PENTATONIC,
    fallback: 'stars',
    see: 'NASA\'s official sonification video: the Hubble photograph of the globular cluster Caldwell 73, with thousands of stars on a black background and a very dense white core at the center. A thin line rotates from the center, counterclockwise, and draws a circle around each star it touches.',
    layers: [
      { icon: '🔴', name: 'Red giants', role: 'bass', line: 'Old, cool stars: the orange and red dots of the cluster.', match: (r, g, b, l) => ramp(r - b, 25, 110) * ramp(l, 40, 120) },
      { icon: '🔵', name: 'Blue stars', role: 'melody', line: 'Hot stars: the bluish dots, scattered across the field.', match: (r, g, b, l) => ramp(b - r, 20, 90) * ramp(l, 40, 120) },
      { icon: '✨', name: 'Cluster core', role: 'pad', line: 'The center, where stars are packed so tightly they merge into a white glow.', match: (r, g, b, l, e, u, v) => ramp(l, 110, 220) * (1 - ramp(fromCenter(u, v), 0.1, 0.3)) },
      { icon: '💫', name: 'Bright isolated stars', role: 'perc', line: 'The most luminous stars outside the core: each one is a flash.', match: (r, g, b, l, e, u, v) => ramp(l, 170, 250) * ramp(fromCenter(u, v), 0.15, 0.3) },
    ],
    chart: { kind: 'radial', title: 'NASA\'s rule: distance from center → frequency' },
    mission: {
      kind: 'calibrate',
      title: 'Calibrate the onduloscope',
      brief: 'NASA\'s rule for this sonification: near the center it sounds low, far away it sounds high, and brightness is volume. Check it by tapping two stars.',
      steps: ['Tap a star next to the core: it sounds low', 'Tap a bright star far from the core: it sounds high'],
    },
  },

  'night-lights': {
    video: 'scrub',
    gain: 2.6, // brillo solo de pantalla; el análisis lee el vídeo tal cual
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: MAJOR_PENTATONIC,
    fallback: 'lights',
    see: 'A flat, very wide map of the world at night: continents barely visible over a black ocean and cities as points of light. The year is labeled at the center and advances from 2012 to 2023; with it, the patches of light in Asia, Africa and the Middle East slowly grow.',
    layers: [
      { icon: '🌑', name: 'Dark and rural areas', role: 'bass', line: 'Land with almost no light: countryside, deserts and jungles.', match: (r, g, b, l) => ramp(l, 5, 11) * (1 - ramp(l, 15, 26)) },
      { icon: '🏙️', name: 'New metropolises', role: 'melody', line: 'Light that was not there in 2012: what has grown up to the chosen year.', match: (r, g, b, l, e, u, v, ref) => ramp(l - ref, 4, 24) },
      { icon: '💡', name: 'Stable urban grid', role: 'pad', line: 'Light that already shone in 2012 and is still there.', match: (r, g, b, l, e, u, v, ref) => ramp(Math.min(l, ref), 18, 60) },
      { icon: '⚡', name: 'Consumption peaks', role: 'perc', line: 'The brightest cores: the big metropolitan areas.', match: (r, g, b, l) => ramp(l, 60, 130) },
    ],
    chart: { kind: 'timeline', title: 'Nighttime light over time · 2012 → 2023', years: [2012, 2023], span: 6.5 },
    mission: {
      kind: 'timeTravel',
      title: 'Time travel (2012 ↔ 2023)',
      brief: 'Slide the year: cities light up and the music fills with pulses. Then point to where the power grid grew the most.',
      steps: ['Travel from 2012 to 2023 with the slider', 'Tap the region where light grew the most'],
      years: [2012, 2023],
      span: 6.5, // segundos del clip que recorre la serie anual
      growth: 1, // índice de la capa "Nuevas metrópolis"
    },
  },

  'sea-currents': {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: DORIAN,
    fallback: 'currents',
    see: 'A flat map of the world ocean with the continents in gray. The currents are thousands of moving filaments colored by temperature: red and orange in the tropics, yellow and green at mid-latitudes, dark blue toward the poles. The eddies of the Gulf Stream, the Kuroshio and the Agulhas never stop spinning.',
    layers: [
      { icon: '🌡️', name: 'Warm current', role: 'bass', line: 'Tropical water: the red and orange filaments.', match: (r, g, b) => ramp(r - b, 40, 160) },
      { icon: '🌀', name: 'High-speed flow', role: 'melody', line: 'The brightest, most saturated filaments: where the water runs fastest.', match: (r, g, b) => ramp(Math.max(r, g, b), 150, 250) * ramp(sat(r, g, b), 80, 180) },
      { icon: '❄️', name: 'Deep cold mass', role: 'pad', line: 'Cold high-latitude water: the dark blues.', match: (r, g, b) => ramp(b - r, 20, 120) },
      { icon: '⚡', name: 'Boundary eddies', role: 'perc', line: 'Sharp edges between different waters: fronts and eddies.', match: (r, g, b, l, e) => ramp(e, 60, 200) * ramp(sat(r, g, b), 25, 60) },
    ],
    chart: { kind: 'profile', title: 'North–south thermal profile', global: true, warm: 0, flow: 1 },
    mission: {
      kind: 'buoy',
      title: 'Sonic buoy in the ocean flow',
      brief: 'Drag the buoy over the map and drop it in the water. Its pulses speed up with the flow and get lower and warmer with temperature. Look for the Gulf Stream or the Agulhas Current.',
      steps: ['Drop the buoy in the ocean', 'Hold it for 1.5 s over a fast, warm current'],
      warm: 0, flow: 1, cold: 2,
    },
  },

  'perpetual-ocean-2': {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: MINOR_PENTATONIC,
    fallback: 'globeOcean',
    see: 'A close-up of the North Atlantic off the east coast of North America, shown in green and ochre on the left. Over a dark blue ocean, the Gulf Stream is a ribbon of orange and yellow filaments that climbs along the coast and then twists into large meanders and eddies out at sea.',
    layers: [
      { icon: '🌡️', name: 'Warm current', role: 'bass', line: 'The warm water of the Gulf Stream: the orange filaments.', match: (r, g, b) => ramp(r - b, 55, 130) * ramp(r - g, 22, 65) },
      { icon: '🌀', name: 'High-speed flow', role: 'melody', line: 'The brightest filaments: the fast core of the current.', match: (r, g, b) => ramp(Math.max(r, g, b), 165, 235) * ramp(r - b, 40, 110) * ramp(g, 120, 190) },
      { icon: '❄️', name: 'Deep cold mass', role: 'pad', line: 'The cold, slow water surrounding the current: the blues.', match: (r, g, b) => ramp(b - r, 25, 90) },
      { icon: '⚡', name: 'Boundary eddies', role: 'perc', line: 'Where the warm current sheds rings and collides with cold water.', match: (r, g, b, l, e) => ramp(e, 40, 140) * ramp(r - g, 10, 40) },
    ],
    chart: { kind: 'profile', title: 'North–south thermal profile of the frame', global: false, warm: 0, flow: 1 },
    mission: {
      kind: 'buoy',
      title: 'Sonic buoy in the Gulf Stream',
      brief: 'Drag the buoy and drop it in the water. Its pulses speed up with the flow and get lower and warmer with temperature. Follow it to the core of the current.',
      steps: ['Drop the buoy in the ocean', 'Hold it for 1.5 s over a fast, warm current'],
      warm: 0, flow: 1, cold: 2,
    },
  },

  aerosols: {
    video: false, // el SVS solo publica imágenes fijas de este recurso
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: [0, 2, 3, 7, 8],
    fallback: 'aerosols',
    see: 'A flat map of the world on a dark background, covered in swirls of aerosols. A large lilac plume of dust leaves the Sahara and crosses the Atlantic; over southern Africa there is orange and red smoke; green ribbons of sulfates snake through the high latitudes and blue-gray swirls of sea salt cover the southern oceans. It is a still image: the SVS does not publish video for this resource.',
    layers: [
      { icon: '🔥', name: 'Wildfire smoke (black carbon)', role: 'bass', line: 'Orange and red in the SVS legend: soot from wildfires and burning.', match: (r, g, b) => ramp(r - Math.max(g, b), 30, 120) },
      { icon: '🏜️', name: 'Desert dust', role: 'melody', line: 'Lilac in the SVS legend: fine sand lifted by the wind.', match: (r, g, b) => ramp(Math.min(r, b) - g, 15, 80) },
      { icon: '🌊', name: 'Sea salt', role: 'pad', line: 'Blue-gray in the SVS legend: sea spray whipped up by storms.', match: (r, g, b, l) => ramp(l, 70, 190) * (1 - ramp(sat(r, g, b), 35, 90)) },
      { icon: '🌋', name: 'Sulfates (volcanoes and industry)', role: 'perc', line: 'Green in the SVS legend: sulfur particles from volcanoes and fuels.', match: (r, g, b) => ramp(g - Math.max(r, b), 30, 130) },
    ],
    chart: { kind: 'composition', title: 'Air composition · map vs. strip' },
    mission: {
      kind: 'separate',
      title: 'Separate the 4 pollutants',
      brief: 'A huge plume leaves Africa and crosses the Atlantic. Isolate the phenomena one by one until you find out what it is made of, then tap its core.',
      steps: ['Isolate the particle that forms the Atlantic plume', 'Tap the core of the cloud'],
      target: 1,
    },
  },

  'air-quality': {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: [0, 1, 5, 7, 8],
    fallback: 'globeSectors',
    see: 'The globe rotates on a black background, split into labeled vertical slices, one per pollutant: carbon monoxide in gold, fine PM2.5 particles in cream, nitrogen oxides in green and ozone in violet. Where there are fires, the gold and cream slices turn dark red.',
    layers: [
      { icon: '🔥', name: 'Wildfire smoke', role: 'bass', line: 'Dark red inside the CO and PM2.5 slices: plumes from large wildfires.', match: (r, g, b) => ramp(r - g, 70, 160) * ramp(r, 120, 200) },
      { icon: '🚗', name: 'Nitrogen oxides', role: 'melody', line: 'The green slice: gases from traffic, industry and burning.', match: (r, g, b) => ramp(g - Math.max(r, b), 30, 120) },
      { icon: '🌫️', name: 'Background CO and particles', role: 'pad', line: 'The gold and cream slices: carbon monoxide and PM2.5 away from the sources.', match: (r, g, b) => ramp(Math.min(r, g) - b, 30, 110) * (1 - ramp(r - g, 50, 110)) },
      { icon: '☀️', name: 'Ozone', role: 'perc', line: 'The violet slice: ozone near the surface.', match: (r, g, b) => ramp(Math.min(r, b) - g, 15, 80) },
    ],
    chart: { kind: 'composition', title: 'Air composition · map vs. strip' },
    mission: {
      kind: 'separate',
      title: 'Separate the 4 pollutants',
      brief: 'One of the pollutants forms intense plumes that the wind carries from the fires. Isolate the phenomena until you find it, then tap the core of the plume.',
      steps: ['Isolate the pollutant of the big plumes', 'Tap the core of the plume'],
      target: 0,
    },
  },

  co2: {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: MINOR_PENTATONIC,
    fallback: 'globeCarbon',
    see: 'The globe rotates almost in the dark on a black background. Carbon dioxide appears as orange veils that concentrate over eastern and southern Asia and fray in the wind; the continents can be made out in gray.',
    layers: [
      { icon: '🏭', name: 'Dense CO₂ plume', role: 'bass', line: 'Deep orange: where the simulated concentration is highest, over the major sources.', match: (r, g, b) => ramp(r - b, 60, 160) * ramp(r, 110, 220) },
      { icon: '🌍', name: 'Surface without plume', role: 'melody', line: 'Continents and clouds in gray: the backdrop the gas moves across.', match: (r, g, b, l) => ramp(l, 60, 180) * (1 - ramp(sat(r, g, b), 20, 50)) },
      { icon: '🌬️', name: 'CO₂ in transport', role: 'pad', line: 'Faint orange veil: diluted gas the wind spreads far from its source.', match: (r, g, b) => ramp(r - b, 14, 50) * (1 - ramp(r - b, 60, 110)) },
      { icon: '⚠️', name: 'Saturation front', role: 'perc', line: 'The brightest cores of the plume.', match: (r, g, b, l) => ramp(r - b, 85, 145) * ramp(l, 85, 150) },
    ],
    chart: { kind: 'series', title: 'CO₂ saturation monitor', key: 0 },
    mission: {
      kind: 'probe',
      title: 'Climate pressure alert',
      brief: 'Drag the probe across the globe: the beep speeds up the denser the carbon plume is. Find where it is most concentrated and mark it.',
      steps: ['Freeze the video and move the probe into the plume (saturation ≥ 50%)', 'Mark the critical point (saturation ≥ 85%)'],
      target: 0,
      unit: 'the CO₂ plume',
    },
  },

  'atmospheric-river': {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: [0, 2, 5, 7, 9],
    fallback: 'river',
    see: 'The northeast Pacific off the west coast of North America, shown in green and ochre on the right. A bright blue band of water vapor, labeled as an atmospheric river, crosses the gray ocean diagonally until it makes landfall. Thin white lines mark the wind, an H the center of high pressure and a turquoise veil the fainter moisture.',
    layers: [
      { icon: '🌬️', name: 'Moisture in transit', role: 'bass', line: 'Turquoise veil: fainter moisture around the river.', match: (r, g, b) => ramp(g - r, 18, 60) * ramp(b - r, 12, 50) * (1 - ramp(b - r, 60, 110)) },
      { icon: '🌧️', name: 'Rain and snow', role: 'melody', line: 'White over the mountains and yellow dots: where the vapor is already falling as snow and rain.', match: (r, g, b, l) => Math.max(ramp(r - b, 90, 180) * ramp(r, 180, 240), ramp(l, 200, 245) * (1 - ramp(sat(r, g, b), 20, 50))) },
      { icon: '💧', name: 'Dense vapor river', role: 'pad', line: 'Deep blue: the water vapor corridor, the atmospheric river.', match: (r, g, b) => ramp(b - r, 60, 120) * ramp(b, 160, 225) },
      { icon: '⚠️', name: 'Saturation front', role: 'perc', line: 'The coast and its mountains: the terrain that forces the vapor to rise and unload.', match: (r, g, b, l, e) => ramp(Math.min(r, g) - b, 25, 90) * ramp(e, 30, 120) },
    ],
    chart: { kind: 'series', title: 'Vapor saturation monitor', key: 2 },
    mission: {
      kind: 'probe',
      title: 'Climate pressure alert',
      brief: 'Drag the probe along the vapor corridor: the beep speeds up with saturation. Find the most loaded point of the river and mark it.',
      steps: ['Freeze the video and move the probe into the vapor corridor (saturation ≥ 50%)', 'Mark the critical point (saturation ≥ 85%)'],
      target: 2,
      unit: 'water vapor',
    },
  },

  'gedi-forest': {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: MAJOR_PENTATONIC,
    fallback: 'globeForest',
    see: 'The globe rotates on a black background with South America at the center. The ocean is flat blue and forest height is drawn in relief and color, following the SVS legend: brown and dark olive green for low vegetation, light green for rainforest and near-white cream for the 50-meter canopy.',
    layers: [
      { icon: '🌱', name: 'Understory and savanna', role: 'bass', line: 'Vegetation under 20 m: the brown and dark olive tones.', match: (r, g, b, l) => gediLand(r, g, b, l) * (1 - ramp(gediHeight(r, g, b, l), 0.36, 0.44)) },
      { icon: '🌳', name: 'Giant canopy (over 40 m)', role: 'melody', line: 'The lightest tones in the legend: treetops above 40 m.', match: (r, g, b, l) => ramp(gediHeight(r, g, b, l), 0.62, 0.78) },
      { icon: '🌲', name: 'Medium dense forest', role: 'pad', line: 'Mid greens: forest between 20 and 40 m.', match: (r, g, b, l) => ramp(gediHeight(r, g, b, l), 0.36, 0.44) * (1 - ramp(gediHeight(r, g, b, l), 0.66, 0.8)) },
      { icon: '🪵', name: 'Total biomass', role: 'perc', line: 'All vegetation, weighing more the taller it is.', match: (r, g, b, l) => gediHeight(r, g, b, l) },
    ],
    chart: { kind: 'canopy', title: 'Canopy height along the sweep (0–50 m)', biomass: 3, land: [0, 1, 2] },
    mission: {
      kind: 'canopy',
      title: 'Amazon elevation profile',
      brief: 'Move the cursor over the rainforest: below, the profile of the trees under it is drawn, from 0 to 50 m (the SVS scale), and the marimba rises in pitch with height. Find the tallest canopy.',
      steps: ['Sweep a rainforest (mean canopy of the profile ≥ 20 m)', 'Find the tallest canopy in the image'],
      biomass: 3,
    },
  },

  lightning: {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: [0, 3, 5, 6, 7, 10],
    fallback: 'sparks',
    see: 'A flat map of the world in dark grays, with clouds in light gray. Each detected lightning flash is a yellow dot that appears and disappears: they cluster over tropical South America, central Africa and Southeast Asia, almost always over land.',
    layers: [
      { icon: '🌩️', name: 'Continental discharges', role: 'bass', line: 'Lightning outside the tropical belt: mid-latitude storms.', match: (r, g, b, l, e, u, v) => rayo(r, g, b) * (1 - tropico(v)) },
      { icon: '⚡', name: 'Tropical supercells', role: 'melody', line: 'Lightning inside the tropical belt, where activity concentrates.', match: (r, g, b, l, e, u, v) => rayo(r, g, b) * tropico(v) },
      { icon: '🌧️', name: 'Cloud front (CPC)', role: 'pad', line: 'The CPC cloud composite, in light gray beneath the lightning.', match: (r, g, b, l) => ramp(l, 52, 105) * (1 - ramp(sat(r, g, b), 25, 60)) },
      { icon: '💥', name: 'Extreme bursts (LIS)', role: 'perc', line: 'The brightest dots: clusters of rapid-fire discharges.', match: (r, g, b, l) => rayo(r, g, b) * ramp(l, 105, 175) },
    ],
    chart: { kind: 'series', title: 'Electrical discharge monitor', key: 1, flash: [0, 1] },
    mission: {
      kind: 'stormHunter',
      title: 'Storm hunter',
      brief: 'Each new flash triggers a crackle. Watch where they pile up and hold the cursor over the planet\'s epicenter of greatest discharge.',
      steps: ['Watch the flashes for 4 s', 'Hold the cursor for 2 s over the epicenter'],
      flashes: [0, 1],
    },
  },
};

export const ROLES = { bass: 'Bass / drone', melody: 'Melody / arpeggio', pad: 'Ambient pad', perc: 'Percussion / flashes' };
