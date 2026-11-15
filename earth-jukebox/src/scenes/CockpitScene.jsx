import Earth, { SUN_DIRECTION } from '../components/Earth.jsx';
import Cockpit from '../components/Cockpit.jsx';
import Starfield from '../components/Starfield.jsx';
import LookControls from '../components/LookControls.jsx';
import Scanner from '../components/Scanner.jsx';

export default function CockpitScene() {
  const sun = SUN_DIRECTION.clone().multiplyScalar(50).toArray();
  return (
    <>
      <color attach="background" args={['#02030a']} />

      {/* Luz tenue de cabina + luz solar que entra por la ventana */}
      <ambientLight color="#2a3c55" intensity={1.6} />
      <pointLight color="#ffb454" intensity={2.2} decay={2} position={[0, 1.0, 0.5]} />
      <directionalLight color="#dfe9ff" intensity={1.4} position={sun} />

      <Starfield />
      <Earth />
      <Cockpit />
      {/* El orden importa: Scanner lee la mira que LookControls acaba de mover */}
      <LookControls />
      <Scanner />
    </>
  );
}
