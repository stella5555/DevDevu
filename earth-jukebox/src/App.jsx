import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import CockpitScene from './scenes/CockpitScene.jsx';
import Hud from './components/Hud.jsx';
import Assistant from './components/Assistant.jsx';
import BootScreen from './components/BootScreen.jsx';
import { useScanner } from './state/scanner.js';

const BOOT_EXIT_MS = 1100; // lo que tarda en desvanecerse la pantalla de arranque

// La cabina orbital (Pilar 1) es la escena base. Encima van la pantalla de
// arranque, el HUD —desde el que se abren la estación de análisis (Pilar 2) y
// el museo (Pilar 3)— y ARIA, la guía, por encima de todo.
export default function App() {
  const booted = useScanner((s) => s.booted);
  // Con la estación o el museo abiertos la cabina queda tapada: se deja de
  // redibujar para dejar la GPU a lo que está delante.
  const covered = useScanner((s) => s.openId !== null || s.museum);
  const [bootGone, setBootGone] = useState(false);

  useEffect(() => {
    if (!booted) return undefined;
    const id = setTimeout(() => setBootGone(true), BOOT_EXIT_MS);
    return () => clearTimeout(id);
  }, [booted]);

  return (
    // is-live dispara la entrada a la cabina y el encendido del HUD (styles.css).
    <div className={`stage${booted ? ' is-live' : ''}`}>
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
      {!bootGone && <BootScreen leaving={booted} />}
    </div>
  );
}
