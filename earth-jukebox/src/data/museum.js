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
  title: 'Centro de la red: la Tierra',
  text: 'La Tierra funciona como un solo sistema: océano, atmósfera, vida y actividad humana se pasan calor, agua, carbono y partículas sin parar. Cada nodo de esta red es una forma de mirar ese intercambio desde el espacio.',
};

export const MUSEUM = {
  'caldwell-73': {
    craft: 'hubble',
    instrument: 'Telescopio espacial Hubble',
    conclusion: 'Cualquier imagen puede oírse si se fija una regla. Aquí, la distancia al centro es la altura de la nota y el brillo es el volumen. Con esa misma idea suenan los otros nueve nodos de la red.',
    part: 'Campana solista',
    angle: null, // sobre el centro de la red
    lift: 2.7,
  },
  'night-lights': {
    craft: 'suomi',
    instrument: 'Sensor VIIRS a bordo del satélite Suomi NPP',
    conclusion: 'Entre 2012 y 2023 la noche se volvió más brillante sobre todo en Asia y África: la luz sigue a la electrificación y al crecimiento de las ciudades. Donde se apaga cuenta otra historia: una guerra, una crisis o farolas más eficientes.',
    part: 'Destellos agudos',
    angle: 200,
    lift: 0.5,
  },
  co2: {
    craft: 'terra',
    instrument: 'Simulación DYAMOND (modelos GEOS y MITgcm), que se apoya en datos de satélites como Terra (MODIS) y Suomi NPP (VIIRS)',
    conclusion: 'El CO₂ no sale repartido por igual: brota de focos concretos —centrales, ciudades, incendios— y el viento lo mezcla hasta envolver el planeta entero.',
    part: 'Bajo profundo',
    angle: 240,
    lift: -0.4,
  },
  'air-quality': {
    craft: 'terra',
    instrument: 'Modelo GEOS-CF de la NASA: una simulación de la química del aire, no una medida directa',
    conclusion: 'La contaminación no respeta fronteras: el humo de los grandes incendios de Norteamérica en 2024 viajó miles de kilómetros, y cada contaminante dibuja su propio mapa.',
    part: 'Cuerdas sostenidas',
    angle: 280,
    lift: 0.5,
  },
  aerosols: {
    craft: 'terra',
    instrument: 'Modelo GEOS-FP de la NASA, corregido con observaciones de aerosoles tomadas desde satélite',
    conclusion: 'El aire está lleno de partículas con origen propio: polvo de los desiertos, humo de incendios, sal del mar y sulfatos. El viento las lleva de un continente a otro en cuestión de días.',
    part: 'Soplo de viento',
    angle: 320,
    lift: -0.4,
  },
  'gedi-forest': {
    craft: 'iss',
    instrument: 'Lidar GEDI, instalado en la Estación Espacial Internacional',
    conclusion: 'Con un láser desde la Estación Espacial, GEDI mide la altura de los bosques del planeta. Las selvas tropicales guardan los doseles más altos y densos y, con ellos, enormes reservas de carbono.',
    part: 'Marimba',
    angle: 0,
    lift: 0.5,
  },
  lightning: {
    craft: 'iss',
    instrument: 'Sensor LIS, instalado en la Estación Espacial Internacional',
    conclusion: 'Los rayos no caen al azar: se concentran sobre tierra firme en los trópicos, donde el calor y la humedad levantan las tormentas más altas. África central es la región más activa del planeta.',
    part: 'Percusión eléctrica',
    angle: 60,
    lift: -0.4,
  },
  'atmospheric-river': {
    craft: 'terra',
    instrument: 'Reanálisis MERRA-2: un modelo meteorológico corregido con observaciones de satélite y de superficie',
    conclusion: 'Un río atmosférico transporta, en forma de vapor, tanta agua como varios grandes ríos juntos. Cuando topa con la costa y sus montañas, el aire sube y descarga lluvia y nieve.',
    part: 'Línea ascendente',
    angle: 100,
    lift: 0.5,
  },
  'perpetual-ocean-2': {
    craft: 'jason',
    instrument: 'Modelo oceánico ECCO2, ajustado con altimetría de satélite (la serie Jason, entre otros) y boyas',
    conclusion: 'La corriente del Golfo es un río dentro del mar: estrecha, rápida y cálida. Al separarse de la costa se retuerce en meandros y suelta anillos que mezclan agua cálida y fría.',
    part: 'Arpegio',
    angle: 140,
    lift: -0.4,
  },
  'sea-currents': {
    craft: 'jason',
    instrument: 'Modelo oceánico ECCO2, ajustado con altimetría de satélite (la serie Jason, entre otros) y boyas',
    conclusion: 'El océano no es una bañera quieta: es un mosaico de corrientes y remolinos que mueven calor. El agua tropical viaja hacia los polos por el borde occidental de cada cuenca.',
    part: 'Oleaje de fondo',
    angle: 170,
    lift: 0.5,
  },
};

export const CRAFTS = {
  hubble: 'Hubble',
  iss: 'Estación Espacial',
  suomi: 'Suomi NPP',
  terra: 'Terra',
  jason: 'Jason',
};

export const LINKS = [
  {
    id: 'luces-co2',
    a: 'night-lights',
    b: 'co2',
    title: 'Urbanización y energía → emisiones',
    text: 'La luz nocturna delata dónde hay ciudades, industria y consumo de energía. La mayor parte de esa energía aún se obtiene quemando combustibles fósiles, así que el mapa de luces y el de focos de CO₂ dibujan casi las mismas regiones.',
  },
  {
    id: 'co2-aire',
    a: 'co2',
    b: 'air-quality',
    title: 'Una misma chimenea, dos problemas',
    text: 'Las combustiones que emiten CO₂ —centrales, tráfico, incendios— emiten también óxidos de nitrógeno y monóxido de carbono, y con la luz del sol esos gases forman ozono cerca del suelo. El CO₂ calienta el clima; sus compañeros de chimenea dañan el aire que respiramos.',
  },
  {
    id: 'corrientes-golfo',
    a: 'sea-currents',
    b: 'perpetual-ocean-2',
    title: 'El océano transporta calor',
    text: 'Las corrientes de frontera occidental —Golfo, Kuroshio, Agulhas— son las cintas que llevan el calor de los trópicos hacia los polos. El mapa de temperatura de la superficie es la huella de ese transporte.',
  },
  {
    id: 'golfo-rio',
    a: 'perpetual-ocean-2',
    b: 'atmospheric-river',
    title: 'Agua cálida → vapor → corredores',
    text: 'El agua cálida evapora más. Sobre los océanos templados y tropicales el aire se carga de vapor y los vientos lo encauzan en corredores estrechos, los ríos atmosféricos, que llevan esa humedad a miles de kilómetros.',
  },
  {
    id: 'rio-rayos',
    a: 'atmospheric-river',
    b: 'lightning',
    title: 'La humedad es el combustible de las tormentas',
    text: 'Cuando el aire húmedo se ve obligado a subir, el vapor condensa, libera calor y levanta nubes de gran altura. Dentro de ellas, los choques entre hielo y granizo separan cargas eléctricas: por eso los rayos se concentran donde sobran humedad y ascenso, en los trópicos continentales.',
  },
  {
    id: 'aerosoles-bosques',
    a: 'aerosols',
    b: 'gedi-forest',
    title: 'Fuego que resta, polvo que suma',
    text: 'Cada incendio convierte bosque en humo: resta biomasa al dosel que mide GEDI y suma carbono negro a la atmósfera. En sentido contrario, el polvo del Sahara cruza el Atlántico y deja caer fósforo sobre la Amazonia, reponiendo parte de los nutrientes que la lluvia arrastra.',
  },
  {
    id: 'caldwell-centro',
    a: 'caldwell-73',
    b: 'hub',
    title: 'La clave para traducir luz en sonido',
    text: 'La sonificación de Caldwell 73 es la piedra de Rosetta de la red: su regla —la posición decide la altura de la nota y el brillo el volumen— es la que convierte en sonido la luz que registran todos los demás instrumentos.',
  },
  {
    id: 'co2-bosques',
    a: 'co2',
    b: 'gedi-forest',
    bridge: true,
    title: 'Los bosques son carbono en pie',
    text: 'Al crecer, un bosque retira CO₂ del aire y lo guarda en madera; cuando se tala o arde, lo devuelve. Por eso medir la altura del dosel con GEDI es una forma de medir cuánto carbono almacena.',
  },
  {
    id: 'aerosoles-aire',
    a: 'aerosols',
    b: 'air-quality',
    bridge: true,
    title: 'El mismo humo, visto dos veces',
    text: 'El humo que un modelo dibuja como carbono negro en altura es, a ras de suelo, las partículas finas PM2.5 del modelo de calidad del aire: el mismo fenómeno mirado como clima y como salud.',
  },
  {
    id: 'co2-corrientes',
    a: 'co2',
    b: 'sea-currents',
    bridge: true,
    title: 'El océano amortigua',
    text: 'El océano absorbe alrededor de una cuarta parte del CO₂ que emitimos y la mayor parte del calor extra que ese gas retiene. Las corrientes reparten ambos por todo el planeta.',
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
