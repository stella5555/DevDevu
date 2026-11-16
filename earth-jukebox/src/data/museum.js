// Pilar 3 · Museo de los Descubrimientos: la Red del Sistema Terrestre.
//
// Cada anomalía es un nodo de la red. Su ficha del museo dice:
//   craft        qué miniatura 3D lo representa (museum/Miniatures.jsx)
//   instrument   quién lo mide de verdad. Varios recursos del SVS no son
//                observaciones directas sino modelos alimentados con datos de
//                satélite: la miniatura es entonces un satélite de los que
//                aportan esos datos, y el texto lo dice así.
//   conclusion   la conclusión científica, que se desbloquea con la ★ de su misión
//   part         su instrumento en la Sinfonía Planetaria (audio/symphony.js)
//   angle, lift  dónde va en el anillo de la red (grados y altura)
//
// LINKS son los hilos causales. Los marcados con `bridge` no venían en el
// guion original del museo: se añadieron para que los tres grupos de nodos
// formen una sola red conectada. Son relaciones igual de establecidas.

export const HUB = {
  id: 'hub',
  title: 'Center of the network: Earth',
  text: 'Earth works as a single system: ocean, atmosphere, life and human activity constantly exchange heat, water, carbon and particles. Each node in this network is a way of looking at that exchange from space.',
};

export const MUSEUM = {
  'caldwell-73': {
    craft: 'hubble',
    instrument: 'Hubble Space Telescope',
    conclusion: 'Any image can be heard once you set a rule. Here, distance from the center is the pitch of the note and brightness is the volume. The other nine nodes of the network sound with that same idea.',
    part: 'Solo bell',
    angle: null, // sobre el centro de la red
    lift: 2.7,
  },
  'night-lights': {
    craft: 'suomi',
    instrument: 'VIIRS sensor aboard the Suomi NPP satellite',
    conclusion: 'Between 2012 and 2023 the night grew brighter, especially over Asia and Africa: light follows electrification and the growth of cities. Where it dims, it tells another story: a war, a crisis or more efficient streetlights.',
    part: 'Bright chimes',
    angle: 200,
    lift: 0.5,
  },
  co2: {
    craft: 'terra',
    instrument: 'DYAMOND simulation (GEOS and MITgcm models), which relies on data from satellites such as Terra (MODIS) and Suomi NPP (VIIRS)',
    conclusion: 'CO₂ is not released evenly: it rises from specific sources —power plants, cities, fires— and the wind mixes it until it wraps the whole planet.',
    part: 'Deep bass',
    angle: 240,
    lift: -0.4,
  },
  'air-quality': {
    craft: 'terra',
    instrument: 'NASA\'s GEOS-CF model: a simulation of air chemistry, not a direct measurement',
    conclusion: 'Pollution does not respect borders: smoke from North America\'s great wildfires of 2024 traveled thousands of kilometers, and each pollutant draws its own map.',
    part: 'Sustained strings',
    angle: 280,
    lift: 0.5,
  },
  aerosols: {
    craft: 'terra',
    instrument: 'NASA\'s GEOS-FP model, corrected with aerosol observations taken from satellites',
    conclusion: 'The air is full of particles, each with its own origin: desert dust, wildfire smoke, sea salt and sulfates. The wind carries them from one continent to another in a matter of days.',
    part: 'Breath of wind',
    angle: 320,
    lift: -0.4,
  },
  'gedi-forest': {
    craft: 'iss',
    instrument: 'GEDI lidar, installed on the International Space Station',
    conclusion: 'With a laser from the Space Station, GEDI measures the height of the planet\'s forests. Tropical rainforests hold the tallest, densest canopies and, with them, enormous carbon stores.',
    part: 'Marimba',
    angle: 0,
    lift: 0.5,
  },
  lightning: {
    craft: 'iss',
    instrument: 'LIS sensor, installed on the International Space Station',
    conclusion: 'Lightning does not strike at random: it concentrates over land in the tropics, where heat and humidity build the tallest storms. Central Africa is the most active region on the planet.',
    part: 'Electric percussion',
    angle: 60,
    lift: -0.4,
  },
  'atmospheric-river': {
    craft: 'terra',
    instrument: 'MERRA-2 reanalysis: a weather model corrected with satellite and surface observations',
    conclusion: 'An atmospheric river carries, as vapor, as much water as several great rivers combined. When it hits the coast and its mountains, the air rises and unloads rain and snow.',
    part: 'Rising line',
    angle: 100,
    lift: 0.5,
  },
  'perpetual-ocean-2': {
    craft: 'jason',
    instrument: 'ECCO2 ocean model, tuned with satellite altimetry (the Jason series, among others) and buoys',
    conclusion: 'The Gulf Stream is a river within the sea: narrow, fast and warm. As it leaves the coast it twists into meanders and sheds rings that mix warm and cold water.',
    part: 'Arpeggio',
    angle: 140,
    lift: -0.4,
  },
  'sea-currents': {
    craft: 'jason',
    instrument: 'ECCO2 ocean model, tuned with satellite altimetry (the Jason series, among others) and buoys',
    conclusion: 'The ocean is not a still bathtub: it is a mosaic of currents and eddies that move heat. Tropical water travels toward the poles along the western edge of each basin.',
    part: 'Background swell',
    angle: 170,
    lift: 0.5,
  },
};

export const CRAFTS = {
  hubble: 'Hubble',
  iss: 'Space Station',
  suomi: 'Suomi NPP',
  terra: 'Terra',
  jason: 'Jason',
};

export const LINKS = [
  {
    id: 'luces-co2',
    a: 'night-lights',
    b: 'co2',
    title: 'Urbanization and energy → emissions',
    text: 'Nighttime light reveals where there are cities, industry and energy use. Most of that energy still comes from burning fossil fuels, so the map of lights and the map of CO₂ sources trace almost the same regions.',
  },
  {
    id: 'co2-aire',
    a: 'co2',
    b: 'air-quality',
    title: 'One smokestack, two problems',
    text: 'The combustion that emits CO₂ —power plants, traffic, fires— also emits nitrogen oxides and carbon monoxide, and with sunlight those gases form ozone near the ground. CO₂ warms the climate; its smokestack companions damage the air we breathe.',
  },
  {
    id: 'corrientes-golfo',
    a: 'sea-currents',
    b: 'perpetual-ocean-2',
    title: 'The ocean transports heat',
    text: 'The western boundary currents —Gulf Stream, Kuroshio, Agulhas— are the ribbons that carry heat from the tropics toward the poles. The surface temperature map is the footprint of that transport.',
  },
  {
    id: 'golfo-rio',
    a: 'perpetual-ocean-2',
    b: 'atmospheric-river',
    title: 'Warm water → vapor → corridors',
    text: 'Warm water evaporates more. Over temperate and tropical oceans the air fills with vapor and the winds channel it into narrow corridors, atmospheric rivers, which carry that moisture thousands of kilometers.',
  },
  {
    id: 'rio-rayos',
    a: 'atmospheric-river',
    b: 'lightning',
    title: 'Moisture is the fuel of storms',
    text: 'When moist air is forced to rise, the vapor condenses, releases heat and builds towering clouds. Inside them, collisions between ice and hail separate electric charges: that is why lightning concentrates where moisture and uplift abound, over tropical land.',
  },
  {
    id: 'aerosoles-bosques',
    a: 'aerosols',
    b: 'gedi-forest',
    title: 'Fire subtracts, dust adds',
    text: 'Every fire turns forest into smoke: it subtracts biomass from the canopy GEDI measures and adds black carbon to the atmosphere. In the other direction, Saharan dust crosses the Atlantic and drops phosphorus on the Amazon, replacing part of the nutrients that rain washes away.',
  },
  {
    id: 'caldwell-centro',
    a: 'caldwell-73',
    b: 'hub',
    title: 'The key to translating light into sound',
    text: 'The Caldwell 73 sonification is the Rosetta Stone of the network: its rule —position sets the pitch of the note and brightness the volume— is what turns into sound the light recorded by all the other instruments.',
  },
  {
    id: 'co2-bosques',
    a: 'co2',
    b: 'gedi-forest',
    bridge: true,
    title: 'Forests are standing carbon',
    text: 'As it grows, a forest removes CO₂ from the air and stores it in wood; when it is cut down or burns, it gives it back. That is why measuring canopy height with GEDI is a way of measuring how much carbon it stores.',
  },
  {
    id: 'aerosoles-aire',
    a: 'aerosols',
    b: 'air-quality',
    bridge: true,
    title: 'The same smoke, seen twice',
    text: 'The smoke one model draws as black carbon aloft is, at ground level, the fine PM2.5 particles of the air quality model: the same phenomenon seen as climate and as health.',
  },
  {
    id: 'co2-corrientes',
    a: 'co2',
    b: 'sea-currents',
    bridge: true,
    title: 'The ocean is a buffer',
    text: 'The ocean absorbs about a quarter of the CO₂ we emit and most of the extra heat that gas traps. The currents spread both across the whole planet.',
  },
];

const RADIUS = 4.3;

// Posición [x, y, z] de un nodo de la red (el centro está en el origen).
export function nodePosition(id) {
  if (id === 'hub') return [0, 0, 0];
  const { angle, lift } = MUSEUM[id];
  if (angle === null) return [0, lift, 0];
  const a = (angle * Math.PI) / 180;
  return [Math.sin(a) * RADIUS, lift, Math.cos(a) * RADIUS];
}
