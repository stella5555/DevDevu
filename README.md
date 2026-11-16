

[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-R3F-black.svg)](https://threejs.org/)
[![Tone.js](https://img.shields.io/badge/Tone.js-Web_Audio-ff69b4.svg)](https://tonejs.github.io/)
[![NASA SVS](https://img.shields.io/badge/NASA-SVS_Data-0b3d91.svg)](https://svs.gsfc.nasa.gov/)

> **NASA Space Apps Challenge 2026** | Earth Information Jukebox
> 
> *Transforming massive volumes of dense satellite data into an interactive, musical, and gamified mystery.*
> 
## Summary
The Earth system is complex, and its data can be incomprehensible to the general public. **Earth Information Jukebox** is an interactive 3D web experience that translates satellite science from NASA’s *Scientific Visualization Studio* (SVS) into a universal language: **sound**.
With a orbital cockpit-guided by an AI named ARIA, players scan the earth to traingulate climate signatures. We process pixels from NASA videos in real time using computer vision and the web audio API, breaking down scientific data into musical tracks (bass, melody, arpeggio, and percussion). You don't just read about climate change, you play and hear it.

---

## User experience

*The Orbital Cabin and the Unduloscope*

Players begin inside an immersive 3D cockpit. Using geometric controls and an interactive central oscilloscope, they must rotate the orbit and track signals hidden across the Earth’s surface—ranging from fires in North America to electrical supercells in the Congo.

 *Analytics Station ("Analytics Jukebox")*
 
Upon capturing a signal, an interface for in-depth scientific analysis is displayed.
* **Live Video Processing:** We read color and luminosity data from the SVS in real time.
* **Multi-track Console:** Isolate variables—such as "wildfire smoke" or "Saharan dust"—by muting them or adjusting their intensity.
* **Specialized Graphs:** Logarithmic histograms, latitudinal thermal profiles, and temporal curves, all generated dynamically using `<canvas>`.
* **Micro-Missions:** Small challenges (e.g., deploying a sonar buoy in the Gulf Stream) to earn discovery stars (★).


### Discoverings musseum (Earth red)
As discoveries are gathered, a 3D causal network is unlocked. Players uncover how urban expansion (Night lights) impacts emissiones (C02) and alters heat transports (Currents) It culminates in a **Planetary symphony**, where all the signals act as instruments within  single, harmonious musical progression
---

## 🛰️ Use of NASA Data (Scientific Visualization Studio)

We have processed and integrated **10 essential NASA datasets**. To avoid CORS issues and ensure a seamless, zero-latency experience, we extracted lightweight frames and videos directly from the SVS API:

| SVS ID | Phenomenon | Sonic and Graphic Translation |
| :--- | :--- | :--- |
| **#13786** | **Caldwell 73** | Base calibration algorithm: Distance from the center (pitch) and brightness (volume). |
| **#5313** | **Night Lights** | Rhythmic pulses that accelerate in line with urban expansion (2012–2023). |
| **#3912 / #5425** | **Ocean Currents (ECCO2)** | Thermodynamics mapped to a fluid arpeggio; water temperature dictates the warmth of the synthesizer. |
| **#5669 / #5533** | **Aerosols and Air Quality (GEOS)** | Distinct audio textures (dust, smoke, sulfates) that the user can mix in real time. |
| **#5196 / #4960** | **Global CO2 and Atmospheric Rivers** | Sonic-tension "seismographs" that trigger alerts upon reaching critical saturation points. |
| **#4950** | **Forest Canopy Height (GEDI)** | Marimba-style, stepped notes that trace the topographic profile of the Amazon. |
| **#5011** | **Lightning Events (LIS Sensor – ISS)** | Intense percussion mapped to yellow flashes occurring in real time across the continents. |

---

## Deployment and Local Execution

You can try our game here: **https://stella5555.github.io/DevDevu/**

To run the project in a development environment:
```bash
# 1. Clone the repository
git clone [https://github.com/stella5555/DevDevu.git](https://github.com/stella5555/DevDevu.git)

# 2. Enter the directory
cd DevDevu/earth-jukebox

# 3. Instale dependencies
npm install

# 4. Start the local development server
npm run dev
