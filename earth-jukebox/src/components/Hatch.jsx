import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ANOMALIES } from '../data/anomalies.js';
import { telemetry } from '../state/telemetry.js';
import { useScanner, isPanelOpen, openMuseum } from '../state/scanner.js';

// La Escotilla del Museo de los Descubrimientos, en el mamparo trasero de la
// cabina (hay que girarse 180°). Su aro se enciende en dorado con la primera
// misión ★ y gana brillo con cada una; las 10 lámparas que lo rodean cuentan
// las misiones completadas. Se abre con un clic o con Enter al mirarla.
const POSITION = [0, -0.25, 1.97];
const TO_HATCH = new THREE.Vector3(...POSITION).normalize();
const GOLD = '#ffb454';
const aim = new THREE.Vector3();

// Rótulo sobre la escotilla, pintado en un lienzo.
function useSign(count, total) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const g = canvas.getContext('2d');
    g.fillStyle = '#0b0f18';
    g.fillRect(0, 0, 1024, 160);
    g.strokeStyle = count ? GOLD : '#3a4558';
    g.lineWidth = 4;
    g.strokeRect(6, 6, 1012, 148);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = count ? GOLD : '#7f8fa8';
    g.font = "600 54px 'Space Grotesk', 'Segoe UI', sans-serif";
    g.fillText('MUSEO DE LOS DESCUBRIMIENTOS', 512, 60);
    g.font = "40px 'JetBrains Mono', Consolas, monospace";
    g.fillText(`★ ${count}/${total}`, 512, 118);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [count, total]);
}

export default function Hatch() {
  const count = useScanner((s) => s.missions.length);
  const total = ANOMALIES.length;
  const { camera } = useThree();
  const frame = useRef();
  const light = useRef();
  const sign = useSign(count, total);

  useFrame(({ clock }) => {
    camera.getWorldDirection(aim);
    telemetry.onHatch = !isPanelOpen() && aim.angleTo(TO_HATCH) < 0.34;
    // Apagada sin misiones; dorada con la primera y más viva con cada ★.
    // Con las 10, late.
    const level = count / total;
    const beat = count === total ? 0.8 + 0.2 * Math.sin(clock.elapsedTime * 3) : 1;
    frame.current.emissiveIntensity = count ? (0.3 + 0.75 * level) * beat : 0.02;
    light.current.intensity = count ? (0.6 + 1.8 * level) * beat : 0;
  });

  const open = (e) => {
    if (e.delta > 6) return; // era un arrastre para mirar, no un clic
    e.stopPropagation();
    openMuseum();
  };

  return (
    // Girada 180°: la cara útil mira hacia el asiento del piloto.
    <group position={POSITION} rotation={[0, Math.PI, 0]}>
      <mesh onClick={open}>
        <torusGeometry args={[0.62, 0.07, 16, 72]} />
        <meshStandardMaterial ref={frame} color="#5a4520" roughness={0.45} metalness={0.8} emissive="#e89a1c" emissiveIntensity={0.02} />
      </mesh>
      <mesh position={[0, 0, 0.01]} onClick={open}>
        <circleGeometry args={[0.56, 48]} />
        <meshStandardMaterial color="#141a26" roughness={0.6} metalness={0.7} />
      </mesh>
      {/* Volante de apertura */}
      <mesh position={[0, 0, 0.06]}>
        <torusGeometry args={[0.2, 0.022, 10, 40]} />
        <meshStandardMaterial color="#6b7486" roughness={0.4} metalness={0.9} />
      </mesh>
      {[0, Math.PI / 2].map((turn) => (
        <mesh key={turn} position={[0, 0, 0.06]} rotation={[0, 0, turn]}>
          <boxGeometry args={[0.4, 0.03, 0.03]} />
          <meshStandardMaterial color="#6b7486" roughness={0.4} metalness={0.9} />
        </mesh>
      ))}
      {/* Una lámpara por misión, en el sentido de las agujas del reloj desde arriba */}
      {ANOMALIES.map((a, i) => {
        const angle = Math.PI / 2 + (i / total) * Math.PI * 2;
        return (
          <mesh key={a.id} position={[Math.cos(angle) * 0.78, Math.sin(angle) * 0.78, 0.02]}>
            <sphereGeometry args={[0.028, 12, 12]} />
            <meshBasicMaterial color={i < count ? '#ffd166' : '#273042'} />
          </mesh>
        );
      })}
      <mesh position={[0, 1.07, 0.01]}>
        <planeGeometry args={[1.5, 0.234]} />
        <meshBasicMaterial map={sign} />
      </mesh>
      <pointLight ref={light} color={GOLD} intensity={0} distance={5} decay={2} position={[0, 0, 0.7]} />
    </group>
  );
}
