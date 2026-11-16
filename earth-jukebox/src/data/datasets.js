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
    see: 'Vídeo oficial de la sonificación de la NASA: la fotografía del Hubble del cúmulo globular Caldwell 73, con miles de estrellas sobre fondo negro y un núcleo blanco muy denso en el centro. Una línea fina gira desde el centro, en sentido contrario a las agujas del reloj, y rodea con un círculo cada estrella que toca.',
    layers: [
      { icon: '🔴', name: 'Gigantes rojas', role: 'bass', line: 'Estrellas viejas y frías: los puntos anaranjados y rojos del cúmulo.', match: (r, g, b, l) => ramp(r - b, 25, 110) * ramp(l, 40, 120) },
      { icon: '🔵', name: 'Estrellas azules', role: 'melody', line: 'Estrellas calientes: los puntos azulados, dispersos por todo el campo.', match: (r, g, b, l) => ramp(b - r, 20, 90) * ramp(l, 40, 120) },
      { icon: '✨', name: 'Núcleo del cúmulo', role: 'pad', line: 'El centro, donde las estrellas están tan juntas que se funden en un resplandor blanco.', match: (r, g, b, l, e, u, v) => ramp(l, 110, 220) * (1 - ramp(fromCenter(u, v), 0.1, 0.3)) },
      { icon: '💫', name: 'Estrellas brillantes aisladas', role: 'perc', line: 'Las estrellas más luminosas fuera del núcleo: cada una es un destello.', match: (r, g, b, l, e, u, v) => ramp(l, 170, 250) * ramp(fromCenter(u, v), 0.15, 0.3) },
    ],
    chart: { kind: 'radial', title: 'Regla de la NASA: distancia al centro → frecuencia' },
    mission: {
      kind: 'calibrate',
      title: 'Calibrar el onduloscopio',
      brief: 'Regla de la NASA para esta sonificación: cerca del centro suena grave, lejos suena agudo, y el brillo es el volumen. Compruébalo tocando dos estrellas.',
      steps: ['Toca una estrella junto al núcleo: suena grave', 'Toca una estrella brillante lejos del núcleo: suena aguda'],
    },
  },

  'night-lights': {
    video: 'scrub',
    gain: 2.6, // brillo solo de pantalla; el análisis lee el vídeo tal cual
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: MAJOR_PENTATONIC,
    fallback: 'lights',
    see: 'Mapa plano y muy alargado del mundo de noche: continentes apenas visibles sobre océano negro y las ciudades como puntos de luz. El año aparece rotulado en el centro y avanza de 2012 a 2023; con él, las manchas de luz de Asia, África y Oriente Medio crecen poco a poco.',
    layers: [
      { icon: '🌑', name: 'Zonas oscuras y rurales', role: 'bass', line: 'Tierra firme casi sin luz: campo, desiertos y selvas.', match: (r, g, b, l) => ramp(l, 5, 11) * (1 - ramp(l, 15, 26)) },
      { icon: '🏙️', name: 'Nuevas metrópolis', role: 'melody', line: 'Luz que no estaba en 2012: lo que ha crecido hasta el año elegido.', match: (r, g, b, l, e, u, v, ref) => ramp(l - ref, 4, 24) },
      { icon: '💡', name: 'Red urbana estable', role: 'pad', line: 'Luz que ya brillaba en 2012 y sigue ahí.', match: (r, g, b, l, e, u, v, ref) => ramp(Math.min(l, ref), 18, 60) },
      { icon: '⚡', name: 'Picos de consumo', role: 'perc', line: 'Los núcleos más brillantes: las grandes áreas metropolitanas.', match: (r, g, b, l) => ramp(l, 60, 130) },
    ],
    chart: { kind: 'timeline', title: 'Evolución de la luz nocturna · 2012 → 2023', years: [2012, 2023], span: 6.5 },
    mission: {
      kind: 'timeTravel',
      title: 'Viaje en el tiempo (2012 ↔ 2023)',
      brief: 'Desliza el año: las ciudades se encienden y la música se llena de pulsos. Después, señala dónde creció más la red eléctrica.',
      steps: ['Viaja de 2012 a 2023 con el deslizador', 'Toca la región donde más creció la luz'],
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
    see: 'Mapa plano del océano mundial con los continentes en gris. Las corrientes son miles de filamentos en movimiento coloreados por temperatura: rojo y naranja en los trópicos, amarillo y verde en latitudes medias, azul oscuro hacia los polos. Los remolinos de la corriente del Golfo, de Kuroshio y de Agulhas giran sin parar.',
    layers: [
      { icon: '🌡️', name: 'Corriente cálida', role: 'bass', line: 'Agua tropical: los filamentos rojos y naranjas.', match: (r, g, b) => ramp(r - b, 40, 160) },
      { icon: '🌀', name: 'Flujo de alta velocidad', role: 'melody', line: 'Los filamentos más brillantes y saturados: donde el agua corre más deprisa.', match: (r, g, b) => ramp(Math.max(r, g, b), 150, 250) * ramp(sat(r, g, b), 80, 180) },
      { icon: '❄️', name: 'Masa fría profunda', role: 'pad', line: 'Agua fría de latitudes altas: los azules oscuros.', match: (r, g, b) => ramp(b - r, 20, 120) },
      { icon: '⚡', name: 'Remolinos de frontera', role: 'perc', line: 'Bordes nítidos entre aguas distintas: frentes y remolinos.', match: (r, g, b, l, e) => ramp(e, 60, 200) * ramp(sat(r, g, b), 25, 60) },
    ],
    chart: { kind: 'profile', title: 'Perfil térmico norte–sur', global: true, warm: 0, flow: 1 },
    mission: {
      kind: 'buoy',
      title: 'Boya sonora en el flujo oceánico',
      brief: 'Arrastra la boya sobre el mapa y suéltala en el agua. Sus pulsos se aceleran con el flujo y se vuelven más graves y cálidos con la temperatura. Busca la corriente del Golfo o la de Agulhas.',
      steps: ['Suelta la boya en el océano', 'Mantenla 1,5 s sobre una corriente rápida y cálida'],
      warm: 0, flow: 1, cold: 2,
    },
  },

  'perpetual-ocean-2': {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: MINOR_PENTATONIC,
    fallback: 'globeOcean',
    see: 'Primer plano del Atlántico norte frente a la costa este de Norteamérica, que aparece en verde y ocre a la izquierda. Sobre un océano azul oscuro, la corriente del Golfo es una cinta de filamentos naranjas y amarillos que sube pegada a la costa y luego se retuerce en grandes meandros y remolinos mar adentro.',
    layers: [
      { icon: '🌡️', name: 'Corriente cálida', role: 'bass', line: 'El agua templada de la corriente del Golfo: los filamentos naranjas.', match: (r, g, b) => ramp(r - b, 55, 130) * ramp(r - g, 22, 65) },
      { icon: '🌀', name: 'Flujo de alta velocidad', role: 'melody', line: 'Los filamentos más brillantes: el núcleo rápido de la corriente.', match: (r, g, b) => ramp(Math.max(r, g, b), 165, 235) * ramp(r - b, 40, 110) * ramp(g, 120, 190) },
      { icon: '❄️', name: 'Masa fría profunda', role: 'pad', line: 'El agua fría y lenta que rodea la corriente: los azules.', match: (r, g, b) => ramp(b - r, 25, 90) },
      { icon: '⚡', name: 'Remolinos de frontera', role: 'perc', line: 'Donde la corriente cálida se desprende en anillos y choca con el agua fría.', match: (r, g, b, l, e) => ramp(e, 40, 140) * ramp(r - g, 10, 40) },
    ],
    chart: { kind: 'profile', title: 'Perfil térmico norte–sur del encuadre', global: false, warm: 0, flow: 1 },
    mission: {
      kind: 'buoy',
      title: 'Boya sonora en la corriente del Golfo',
      brief: 'Arrastra la boya y suéltala en el agua. Sus pulsos se aceleran con el flujo y se vuelven más graves y cálidos con la temperatura. Síguela hasta el núcleo de la corriente.',
      steps: ['Suelta la boya en el océano', 'Mantenla 1,5 s sobre una corriente rápida y cálida'],
      warm: 0, flow: 1, cold: 2,
    },
  },

  aerosols: {
    video: false, // el SVS solo publica imágenes fijas de este recurso
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: [0, 2, 3, 7, 8],
    fallback: 'aerosols',
    see: 'Mapa plano del mundo sobre fondo oscuro, cubierto de remolinos de aerosoles. Una gran pluma lila de polvo sale del Sahara y cruza el Atlántico; sobre África austral hay humo naranja y rojo; cintas verdes de sulfatos serpentean por las latitudes altas y remolinos gris azulado de sal marina cubren los océanos del sur. Es una imagen fija: el SVS no publica vídeo de este recurso.',
    layers: [
      { icon: '🔥', name: 'Humo de incendios (carbono negro)', role: 'bass', line: 'Naranja y rojo en la leyenda del SVS: hollín de incendios y quemas.', match: (r, g, b) => ramp(r - Math.max(g, b), 30, 120) },
      { icon: '🏜️', name: 'Polvo del desierto', role: 'melody', line: 'Lila en la leyenda del SVS: arena fina levantada por el viento.', match: (r, g, b) => ramp(Math.min(r, b) - g, 15, 80) },
      { icon: '🌊', name: 'Sal marina', role: 'pad', line: 'Gris azulado en la leyenda del SVS: gotas de mar que arrancan los temporales.', match: (r, g, b, l) => ramp(l, 70, 190) * (1 - ramp(sat(r, g, b), 35, 90)) },
      { icon: '🌋', name: 'Sulfatos (volcanes e industria)', role: 'perc', line: 'Verde en la leyenda del SVS: partículas de azufre de volcanes y combustibles.', match: (r, g, b) => ramp(g - Math.max(r, b), 30, 130) },
    ],
    chart: { kind: 'composition', title: 'Composición del aire · mapa frente a franja' },
    mission: {
      kind: 'separate',
      title: 'Separar los 4 contaminantes',
      brief: 'Una pluma enorme sale de África y cruza el Atlántico. Aísla los fenómenos uno a uno hasta descubrir de qué está hecha, y toca su núcleo.',
      steps: ['Aísla la partícula que forma la pluma del Atlántico', 'Toca el núcleo de la nube'],
      target: 1,
    },
  },

  'air-quality': {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: [0, 1, 5, 7, 8],
    fallback: 'globeSectors',
    see: 'El globo terrestre gira sobre fondo negro, dividido en gajos verticales rotulados, uno por contaminante: monóxido de carbono en dorado, partículas finas PM2.5 en crema, óxidos de nitrógeno en verde y ozono en violeta. Donde hay incendios, los gajos dorado y crema se tiñen de rojo oscuro.',
    layers: [
      { icon: '🔥', name: 'Humo de incendios', role: 'bass', line: 'Rojo oscuro dentro de los gajos de CO y PM2.5: penachos de grandes incendios.', match: (r, g, b) => ramp(r - g, 70, 160) * ramp(r, 120, 200) },
      { icon: '🚗', name: 'Óxidos de nitrógeno', role: 'melody', line: 'El gajo verde: gases del tráfico, la industria y las quemas.', match: (r, g, b) => ramp(g - Math.max(r, b), 30, 120) },
      { icon: '🌫️', name: 'CO y partículas de fondo', role: 'pad', line: 'Los gajos dorado y crema: monóxido de carbono y PM2.5 lejos de los focos.', match: (r, g, b) => ramp(Math.min(r, g) - b, 30, 110) * (1 - ramp(r - g, 50, 110)) },
      { icon: '☀️', name: 'Ozono', role: 'perc', line: 'El gajo violeta: ozono cerca de la superficie.', match: (r, g, b) => ramp(Math.min(r, b) - g, 15, 80) },
    ],
    chart: { kind: 'composition', title: 'Composición del aire · mapa frente a franja' },
    mission: {
      kind: 'separate',
      title: 'Separar los 4 contaminantes',
      brief: 'Uno de los contaminantes forma penachos intensos que el viento arrastra desde los incendios. Aísla los fenómenos hasta dar con él y toca el núcleo del penacho.',
      steps: ['Aísla el contaminante de los grandes penachos', 'Toca el núcleo del penacho'],
      target: 0,
    },
  },

  co2: {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: MINOR_PENTATONIC,
    fallback: 'globeCarbon',
    see: 'El globo terrestre gira casi a oscuras sobre fondo negro. El dióxido de carbono aparece como velos anaranjados que se concentran sobre el este y el sur de Asia y se deshilachan con el viento; los continentes se adivinan en gris.',
    layers: [
      { icon: '🏭', name: 'Pluma densa de CO₂', role: 'bass', line: 'Naranja intenso: donde la concentración simulada es más alta, sobre las grandes fuentes.', match: (r, g, b) => ramp(r - b, 60, 160) * ramp(r, 110, 220) },
      { icon: '🌍', name: 'Superficie sin pluma', role: 'melody', line: 'Continentes y nubes en gris: el fondo sobre el que se mueve el gas.', match: (r, g, b, l) => ramp(l, 60, 180) * (1 - ramp(sat(r, g, b), 20, 50)) },
      { icon: '🌬️', name: 'CO₂ en transporte', role: 'pad', line: 'Velo anaranjado tenue: gas ya diluido que el viento reparte lejos de su origen.', match: (r, g, b) => ramp(r - b, 14, 50) * (1 - ramp(r - b, 60, 110)) },
      { icon: '⚠️', name: 'Frente de saturación', role: 'perc', line: 'Los núcleos más brillantes de la pluma.', match: (r, g, b, l) => ramp(r - b, 85, 145) * ramp(l, 85, 150) },
    ],
    chart: { kind: 'series', title: 'Monitor de saturación de CO₂', key: 0 },
    mission: {
      kind: 'probe',
      title: 'Alerta de presión climática',
      brief: 'Arrastra la sonda por el globo: el pitido se acelera cuanto más densa es la pluma de carbono. Localiza donde más se concentra y márcalo.',
      steps: ['Lleva la sonda a la pluma (saturación ≥ 50 %)', 'Marca el punto crítico (saturación ≥ 85 %)'],
      target: 0,
      unit: 'pluma de CO₂',
    },
  },

  'atmospheric-river': {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: [0, 2, 5, 7, 9],
    fallback: 'river',
    see: 'El Pacífico nororiental frente a la costa oeste de Norteamérica, que aparece en verde y ocre a la derecha. Una banda azul brillante de vapor de agua, rotulada como río atmosférico, cruza el océano gris en diagonal hasta tocar tierra. Líneas blancas finas marcan el viento, una H el centro de altas presiones y un velo turquesa la humedad más tenue.',
    layers: [
      { icon: '🌬️', name: 'Humedad en tránsito', role: 'bass', line: 'Velo turquesa: humedad más tenue alrededor del río.', match: (r, g, b) => ramp(g - r, 18, 60) * ramp(b - r, 12, 50) * (1 - ramp(b - r, 60, 110)) },
      { icon: '🌧️', name: 'Lluvia y nieve', role: 'melody', line: 'Blanco sobre las montañas y puntos amarillos: donde el vapor ya cae como nieve y lluvia.', match: (r, g, b, l) => Math.max(ramp(r - b, 90, 180) * ramp(r, 180, 240), ramp(l, 200, 245) * (1 - ramp(sat(r, g, b), 20, 50))) },
      { icon: '💧', name: 'Río de vapor denso', role: 'pad', line: 'Azul intenso: el corredor de vapor de agua, el río atmosférico.', match: (r, g, b) => ramp(b - r, 60, 120) * ramp(b, 160, 225) },
      { icon: '⚠️', name: 'Frente de saturación', role: 'perc', line: 'La costa y sus montañas: el relieve que obliga al vapor a subir y descargar.', match: (r, g, b, l, e) => ramp(Math.min(r, g) - b, 25, 90) * ramp(e, 30, 120) },
    ],
    chart: { kind: 'series', title: 'Monitor de saturación de vapor', key: 2 },
    mission: {
      kind: 'probe',
      title: 'Alerta de presión climática',
      brief: 'Arrastra la sonda a lo largo del corredor de vapor: el pitido se acelera con la saturación. Localiza el punto más cargado del río y márcalo.',
      steps: ['Lleva la sonda al corredor de vapor (saturación ≥ 50 %)', 'Marca el punto crítico (saturación ≥ 85 %)'],
      target: 2,
      unit: 'vapor de agua',
    },
  },

  'gedi-forest': {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: MAJOR_PENTATONIC,
    fallback: 'globeForest',
    see: 'El globo terrestre gira sobre fondo negro con Sudamérica en el centro. El océano es azul liso y la altura del bosque se dibuja en relieve y color, según la leyenda del SVS: pardo y verde oliva oscuro para la vegetación baja, verde claro para la selva y crema casi blanco para el dosel de 50 metros.',
    layers: [
      { icon: '🌱', name: 'Sotobosque y sabana', role: 'bass', line: 'Vegetación de menos de 20 m: los tonos pardos y oliva oscuro.', match: (r, g, b, l) => gediLand(r, g, b, l) * (1 - ramp(gediHeight(r, g, b, l), 0.36, 0.44)) },
      { icon: '🌳', name: 'Dosel gigante (más de 40 m)', role: 'melody', line: 'Los tonos más claros de la leyenda: copas por encima de 40 m.', match: (r, g, b, l) => ramp(gediHeight(r, g, b, l), 0.62, 0.78) },
      { icon: '🌲', name: 'Bosque denso medio', role: 'pad', line: 'Verdes medios: bosque de entre 20 y 40 m.', match: (r, g, b, l) => ramp(gediHeight(r, g, b, l), 0.36, 0.44) * (1 - ramp(gediHeight(r, g, b, l), 0.66, 0.8)) },
      { icon: '🪵', name: 'Biomasa total', role: 'perc', line: 'Toda la vegetación, pesando más cuanto más alta es.', match: (r, g, b, l) => gediHeight(r, g, b, l) },
    ],
    chart: { kind: 'canopy', title: 'Altura del dosel a lo largo del barrido (0–50 m)', biomass: 3, land: [0, 1, 2] },
    mission: {
      kind: 'canopy',
      title: 'Perfil de elevación del Amazonas',
      brief: 'Pasa el cursor sobre la selva: abajo se dibuja el perfil de árboles bajo él, de 0 a 50 m (la escala del SVS), y la marimba sube de tono con la altura. Encuentra el dosel más alto.',
      steps: ['Barre una selva (dosel medio del perfil ≥ 20 m)', 'Encuentra el dosel más alto de la imagen'],
      biomass: 3,
    },
  },

  lightning: {
    video: true,
    scan: 'sweep',
    sweep: { seconds: 24 },
    scale: [0, 3, 5, 6, 7, 10],
    fallback: 'sparks',
    see: 'Mapa plano del mundo en grises oscuros, con las nubes en gris claro. Cada rayo detectado es un punto amarillo que aparece y desaparece: se agrupan sobre Sudamérica tropical, África central y el sudeste asiático, casi siempre sobre tierra firme.',
    layers: [
      { icon: '🌩️', name: 'Descargas continentales', role: 'bass', line: 'Rayos fuera de la franja tropical: tormentas de latitudes medias.', match: (r, g, b, l, e, u, v) => rayo(r, g, b) * (1 - tropico(v)) },
      { icon: '⚡', name: 'Superceldas tropicales', role: 'melody', line: 'Rayos dentro de la franja tropical, donde se concentra la actividad.', match: (r, g, b, l, e, u, v) => rayo(r, g, b) * tropico(v) },
      { icon: '🌧️', name: 'Frente de nubes (CPC)', role: 'pad', line: 'El compuesto de nubes del CPC, en gris claro bajo los rayos.', match: (r, g, b, l) => ramp(l, 52, 105) * (1 - ramp(sat(r, g, b), 25, 60)) },
      { icon: '💥', name: 'Ráfagas extremas (LIS)', role: 'perc', line: 'Los puntos más brillantes: cúmulos de descargas muy seguidas.', match: (r, g, b, l) => rayo(r, g, b) * ramp(l, 105, 175) },
    ],
    chart: { kind: 'series', title: 'Monitor de descargas eléctricas', key: 1, flash: [0, 1] },
    mission: {
      kind: 'stormHunter',
      title: 'Cazador de tormentas',
      brief: 'Cada destello nuevo dispara un chasquido. Observa dónde se acumulan y fija el cursor sobre el epicentro de mayor descarga del planeta.',
      steps: ['Observa los destellos durante 4 s', 'Mantén el cursor 2 s sobre el epicentro'],
      flashes: [0, 1],
    },
  },
};

export const ROLES = { bass: 'Bajo / drone', melody: 'Melodía / arpegio', pad: 'Pad envolvente', perc: 'Percusión / destellos' };
