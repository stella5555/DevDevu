import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { scopeVertex, scopeFragment } from '../shaders/earth.js';
import { scan } from '../state/scanner.js';
import Hatch from './Hatch.jsx';

// La cámara vive en el origen mirando hacia -Z. La ventana frontal está en z = -2.
const HULL = { color: '#161b26', roughness: 0.7, metalness: 0.4 };
const TRIM = { color: '#232a38', roughness: 0.55, metalness: 0.6 };

function Panel({ size, mat = HULL, ...props }) {
  return (
    <mesh {...props}>
      <boxGeometry args={size} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

const INDICATOR_COLORS = ['#ffb454', '#59ffc8', '#ffb454', '#ff5d5d', '#59ffc8'];

function Indicators() {
  const lamps = [];
  for (const side of [-1, 1]) {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        lamps.push({
          key: `${side}-${r}-${c}`,
          position: [side * (0.75 + c * 0.17), 0.26, -0.15 + r * 0.22],
          color: INDICATOR_COLORS[(c + r * 2) % INDICATOR_COLORS.length],
        });
      }
    }
  }
  return lamps.map((l) => (
    <mesh key={l.key} position={l.position}>
      <boxGeometry args={[0.05, 0.015, 0.05]} />
      <meshBasicMaterial color={l.color} />
    </mesh>
  ));
}

function Scope() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uActive: { value: 0 }, uSignal: { value: 0 } }), []);
  useFrame((_, dt) => {
    const ease = 1 - Math.exp(-dt * 8);
    uniforms.uTime.value += dt;
    uniforms.uActive.value += ((scan.active ? 1 : 0) - uniforms.uActive.value) * ease;
    uniforms.uSignal.value += (scan.signal - uniforms.uSignal.value) * ease;
  });
  return (
    <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.9, 0.42]} />
      <shaderMaterial vertexShader={scopeVertex} fragmentShader={scopeFragment} uniforms={uniforms} />
    </mesh>
  );
}

export default function Cockpit() {
  return (
    <group>
      {/* Casco */}
      <Panel size={[4, 0.1, 4.2]} position={[0, -1.35, 0]} />
      <Panel size={[4, 0.1, 4.2]} position={[0, 1.3, 0]} />
      <Panel size={[4, 2.7, 0.1]} position={[0, 0, 2.05]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Panel size={[0.1, 2.7, 2.65]} position={[s * 2, 0, 0.75]} />
          <Panel size={[0.1, 0.6, 1.5]} position={[s * 2, -1.05, -1.3]} />
          {/* Montantes de la ventana */}
          <Panel size={[0.2, 2.5, 0.2]} position={[s * 1.95, 0.1, -2]} mat={TRIM} />
          <Panel size={[0.1, 2.0, 0.1]} position={[s * 1.25, 0.2, -2]} rotation={[0, 0, -s * 0.12]} mat={TRIM} />
        </group>
      ))}
      <Panel size={[4, 0.2, 0.2]} position={[0, 1.2, -2]} mat={TRIM} />
      <Panel size={[4, 0.6, 0.1]} position={[0, -1.05, -2]} />

      {/* Consola inclinada hacia el piloto */}
      <group position={[0, -1.15, -1.45]} rotation={[0.5, 0, 0]}>
        <Panel size={[3.9, 0.5, 1.0]} mat={TRIM} />
        <Scope />
        <Indicators />
      </group>

      <Hatch />

      {/* Tira de luz ámbar a la espalda */}
      <mesh position={[0, 0.6, 1.99]}>
        <boxGeometry args={[1.4, 0.03, 0.02]} />
        <meshBasicMaterial color="#ffb454" />
      </mesh>
    </group>
  );
}
