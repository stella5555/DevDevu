import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Earth, { SUN_DIRECTION } from '../components/Earth.jsx';
import Cockpit from '../components/Cockpit.jsx';
import Starfield from '../components/Starfield.jsx';
import LookControls from '../components/LookControls.jsx';
import Scanner from '../components/Scanner.jsx';
import { useScanner } from '../state/scanner.js';

export default function CockpitScene() {
  const sun = SUN_DIRECTION.clone().multiplyScalar(50).toArray();
  const live = useScanner((s) => s.phase === 'live');
  const ambient = useRef();
  const lamp = useRef();
  const alarm = useRef();
  const power = useRef(live ? 1 : 0); // 0 energía de reserva · 1 cabina encendida

  // Hasta superar el protocolo de seguridad la cabina está casi a oscuras, con
  // una luz roja de emergencia; al autorizar, la energía vuelve poco a poco.
  useFrame(({ clock }, dt) => {
    power.current += ((live ? 1 : 0) - power.current) * (1 - Math.exp(-dt * 1.5));
    const p = power.current;
    ambient.current.intensity = 0.22 + 1.38 * p;
    lamp.current.intensity = 2.2 * p;
    alarm.current.intensity = (1 - p) * (0.9 + 0.5 * Math.sin(clock.elapsedTime * 2.6));
  });

  return (
    <>
      <color attach="background" args={['#02030a']} />

      {/* Luz de cabina + luz solar que entra por la ventana */}
      <ambientLight ref={ambient} color="#2a3c55" intensity={0.22} />
      <pointLight ref={lamp} color="#ffb454" intensity={0} decay={2} position={[0, 1.0, 0.5]} />
      <pointLight ref={alarm} color="#ff3b3b" intensity={0} decay={2} position={[0, 1.05, -0.6]} />
      <directionalLight color="#dfe9ff" intensity={1.4} position={sun} />

      <Starfield />
      {/* El modelo de la Tierra se carga aparte: la cabina no espera por él. */}
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
      <Cockpit />
      {/* El orden importa: Scanner lee la mira que LookControls acaba de mover */}
      <LookControls />
      <Scanner />
    </>
  );
}
