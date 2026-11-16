# 🌍 Earth Information Jukebox: Sinfonía Orbital

[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-R3F-black.svg)](https://threejs.org/)
[![Tone.js](https://img.shields.io/badge/Tone.js-Web_Audio-ff69b4.svg)](https://tonejs.github.io/)
[![NASA SVS](https://img.shields.io/badge/NASA-SVS_Data-0b3d91.svg)](https://svs.gsfc.nasa.gov/)

> **NASA Space Apps Challenge 2026** | **Reto:** Earth Information Jukebox
> 
> *Transformando volúmenes masivos de datos satelitales densos en un misterio interactivo, musical y gamificado.*

![Pantalla de Carga](docs/boot-screen.png) 
*Pantalla de inicialización de sistemas y precarga de texturas satelitales.*

## Resumen del Proyecto
El sistema terrestre es complejo y sus datos son incomprensibles para el público general. **Earth Information Jukebox** es una experiencia web interactiva en 3D que traduce la ciencia satelital del *Scientific Visualization Studio* (SVS) de la NASA a un idioma universal: **el sonido**. 

A bordo de una cabina orbital y guiados por la inteligencia artificial ARIA, los jugadores escanean la Tierra para triangular firmas climáticas. Procesamos los píxeles de videos `.mp4` de la NASA en tiempo real mediante *Computer Vision* y *Web Audio API*, separando los datos científicos en pistas musicales (Bajo, Melodía, Arpegio y Percusión). No solo lees el cambio climático, lo juegas y lo escuchas.

---

## 🎮 Experiencia de Usuario (Los 3 Pilares)

### 1. La Cabina Orbital y el Onduloscopio
Los jugadores inician en una cabina 3D inmersiva. Usando controles geométricos y un osciloscopio central interactivo, deben girar la órbita y rastrear señales escondidas sobre la superficie de la Tierra (desde incendios en Norteamérica hasta superceldas eléctricas en el Congo).

### 2. Estación Analítica ("Analytics Jukebox")
Al atrapar una señal, se despliega una interfaz de análisis científico profundo.
* **Procesamiento de Video en Vivo:** Leemos el color y luminosidad de los datos del SVS en tiempo real.
* **Consola Multipista:** Aísla variables como "Humo de Incendios" o "Polvo del Sahara" silenciando o aumentando su volumen.
* **Gráficas Específicas:** Histogramas logarítmicos, perfiles térmicos latitudinales y curvas temporales generadas dinámicamente con `<canvas>`.
* **Micro-Misiones:** Pequeños retos (ej. lanzar una boya sonora en la corriente del Golfo) para ganar estrellas (★) de descubrimiento.

![Estación Analítica](docs/analytics-panel.png)
*Estación analítica analizando simulaciones del modelo GEOS-CF (Calidad del Aire), con la asistente ARIA activa y la consola multipista aislando 4 tipos de contaminantes.*

### 3. Museo de los Descubrimientos (Red Terrestre)
Al reunir descubrimientos, se desbloquea una red 3D causal. Los jugadores descubren cómo la expansión urbana (Luces Nocturnas) impacta las emisiones (CO2) y altera el transporte de calor (Corrientes). Culmina en una **Sinfonía Planetaria**, donde todas las señales actúan como instrumentos en una misma progresión musical armónica.

---

## 🛰️ Uso de Datos de la NASA (Scientific Visualization Studio)

Hemos procesado e integrado **10 conjuntos de datos obligatorios** de la NASA. Para evitar problemas de CORS y garantizar una experiencia fluida de cero latencia, extrajimos los fotogramas y videos ligeros directamente de la API del SVS:

| ID del SVS | Fenómeno | Traducción Sonora y Gráfica |
| :--- | :--- | :--- |
| **#13786** | **Caldwell 73** | Algoritmo base de calibración: Distancia al centro (Tono) y Brillo (Volumen). |
| **#5313** | **Luces Nocturnas** | Pulsos rítmicos que se aceleran con la expansión urbana (2012-2023). |
| **#3912 / #5425** | **Corrientes Marinas (ECCO2)** | Termodinámica mapeada a un arpegio fluido; el calor del agua dicta la calidez del sintetizador. |
| **#5669 / #5533** | **Aerosoles y Calidad del Aire (GEOS)** | Texturas de audio separadas (Polvo, Humo, Sulfatos) que el usuario puede mezclar en vivo. |
| **#5196 / #4960** | **CO2 Global y Ríos Atmosféricos** | Sismógrafos de tensión sonora que alertan al llegar al punto crítico de saturación. |
| **#4950** | **Altura del Dosel Forestal (GEDI)** | Notas escalonadas estilo marimba que dibujan el perfil topográfico de la Amazonía. |
| **#5011** | **Eventos de Rayos (Sensor LIS - ISS)** | Percusión intensa mapeada a los destellos amarillos en tiempo real sobre los continentes. |

---

## 💻 Arquitectura Técnica

El proyecto se construyó íntegramente con tecnologías web modernas, sin motores de juego pesados, garantizando accesibilidad global directamente en el navegador:
* **React 18 & Vite:** Arquitectura basada en componentes de alto rendimiento y gestión del estado del juego (Zustand/Context).
* **Three.js & React Three Fiber (R3F):** Renderizado WebGL, shaders de la atmósfera terrestre y la geometría del entorno de la cabina y el museo.
* **Tone.js & Web Audio API:** Motor de síntesis procedural. No usamos pistas pregrabadas (salvo la voz de la IA); toda la música es generada matemáticamente por la lectura de la matriz de píxeles (`getImageData`).
* **HTML5 Canvas API:** Barrido de datos y renderizado estadístico de alta velocidad para los mapas de calor y perfiles latitudinales.

---

## ⚙️ Despliegue y Ejecución Local

Puedes probar nuestra aplicación en vivo aquí: **https://stella5555.github.io/DevDevu/**

Para correr el proyecto en entorno de desarrollo:
```bash
# 1. Clonar el repositorio
git clone [https://github.com/stella5555/DevDevu.git](https://github.com/stella5555/DevDevu.git)

# 2. Entrar al directorio
cd DevDevu/earth-jukebox

# 3. Instalar dependencias
npm install

# 4. Iniciar el servidor local de desarrollo
npm run dev
