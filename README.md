# 🌍 Earth Information Jukebox: Sinfonía Orbital

**Space Apps Challenge 2026** | **Reto:** Earth Information Jukebox

## 🚀 El Proyecto
En el año 2042, una anomalía climática ha desestabilizado la línea temporal de la Tierra. Despiertas en órbita a bordo de una nave de investigación, guiada por la IA de a bordo, ARIA. Tu misión: utilizar el Onduloscopio de la nave para escanear señales planetarias, aislar fenómenos climáticos y descifrar la "Sinfonía Planetaria" para restaurar el equilibrio del sistema terrestre.

Combinamos la ingeniería inversa de mecánicas de exploración espacial (inspiradas en *Outer Wilds*) con procesamiento de datos en tiempo real de la NASA, transformando visualizaciones científicas complejas en una experiencia gamificada, accesible y musical.

## 🎯 Público Objetivo
Diseñado para estudiantes, educadores y entusiastas del clima (12+ años). Transforma el aprendizaje de datos satelitales densos en un misterio interactivo, ideal para quienes aprenden mejor a través del sonido, la exploración visual y la gamificación.

## 📡 Recursos Oficiales de la NASA (SVS y EIC)
Integramos **10 conjuntos de datos oficiales** del *Scientific Visualization Studio* (SVS) de la NASA, procesando sus píxeles en tiempo real a través de Web Audio API para generar música dinámica:
* **SVS #13786 (Caldwell 73):** Algoritmo base de sonificación.
* **SVS #5313 (Luces Nocturnas 2012-2023):** Evolución del consumo urbano.
* **SVS #3912 y #5425 (Corrientes Oceánicas):** Termodinámica marina.
* **SVS #5669 y #5533 (Aerosoles y Calidad del Aire):** Rastreo de humo, polvo, y emisiones.
* **SVS #5196 y #4960 (CO2 y Ríos Atmosféricos):** Saturación de carbono y corredores de humedad.
* **SVS #4950 (GEDI):** Altura del dosel forestal global.
* **SVS #5011 (Rayos ISS):** Actividad eléctrica global.

## 🛠️ Tecnologías Utilizadas
* **React Three Fiber & Three.js:** Entorno 3D interactivo, shaders y cabina orbital.
* **Web Audio API & Tone.js:** Síntesis de sonido multipista generada en tiempo real a partir del análisis de píxeles (RGB y luminosidad).
* **Vite & React:** Arquitectura de interfaz de usuario y renderizado de gráficos analíticos (Mapas de Calor e Histogramas de color).

## 👥 El Equipo
* **Hilary Cruz** - Arquitectura, Diseño de Experiencia (UX) y Dirección Narrativa.
* **Niels [y otros compañeros]** - [Sus roles, ej. Análisis de Datos, Modelado 3D].

*Nota: Con amor y un agradecimiento especial al Dr. Ryland Grace (Project Hail Mary) por la inspiración a bordo.*
