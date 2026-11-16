import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import CockpitScene from './scenes/CockpitScene.jsx';
import Hud from './components/Hud.jsx';
import Assistant from './components/Assistant.jsx';
import BootScreen from './components/BootScreen.jsx';
import Cinematic from './components/Cinematic.jsx';
import SecurityQuiz from './components/SecurityQuiz.jsx';
import HatchCinematic from './components/HatchCinematic.jsx';
import { useScanner } from './state/scanner.js';
import { ambient } from './audio/ambient.js';
import * as retro from './audio/retro.js';

const BOOT_EXIT_MS = 1100; // lo que tarda en desvanecerse la pantalla de arranque

// La cabina orbital (Pilar 1) es la escena base. Encima va lo que toque en
// cada fase: la pantalla de arranque, el despertar de ARIA, el protocolo de
// seguridad y, ya con la cabina operativa, el HUD —desde el que se abren la
// estación de análisis (Pilar 2) y el museo (Pilar 3)— y ARIA, la guía.
export default function App() {
  const phase = useScanner((s) => s.phase);
  const hatch = useScanner((s) => s.hatch);
  // Con la estación o el museo abiertos la cabina queda tapada: se deja de
  // redibujar para dejar la GPU a lo que está delante.
  const covered = useScanner((s) => s.openId !== null || s.museum);
  const [bootGone, setBootGone] = useState(false);

  useEffect(() => {
    if (phase === 'boot') return undefined;
    const id = setTimeout(() => setBootGone(true), BOOT_EXIT_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // El audio solo puede arrancar tras un gesto. Si la pantalla de arranque
  // terminó sin ninguno, se desbloquea con el primer clic o tecla.
  useEffect(() => {
    const unlock = () => {
      ambient.start();
      retro.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return (
    // is-<fase> decide cómo se ve la cabina; is-live (cabina operativa) dispara
    // el encendido del HUD.
    <div className={`stage is-${phase}`}>
      <Canvas
        className="cabin"
        flat
        frameloop={covered ? 'never' : 'always'}
        dpr={[1, 2]}
        camera={{ fov: 55, near: 0.05, far: 1000, position: [0, 0, 0] }}
      >
        <CockpitScene />
      </Canvas>
      <Hud />
      <Assistant />
      {phase === 'intro' && <Cinematic />}
      {phase === 'quiz' && <SecurityQuiz />}
      {hatch && <HatchCinematic />}
      {!bootGone && <BootScreen leaving={phase !== 'boot'} />}
    </div>
  );
}
