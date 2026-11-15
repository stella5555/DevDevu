import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { earthVertex, earthFragment, atmosphereFragment } from '../shaders/earth.js';
import { telemetry } from '../state/telemetry.js';
import AnomalyMarkers from './AnomalyMarkers.jsx';

export const EARTH_POSITION = new THREE.Vector3(0, -0.5, -17);
export const EARTH_RADIUS = 6.5;
export const SUN_DIRECTION = new THREE.Vector3(-1, 0.3, 0.45).normalize();
const AXIAL_TILT = THREE.MathUtils.degToRad(23.4);
const BASE_SPIN = 0.02; // rad/s
const ORBIT_SPIN = 0.55; // rad/s extra mientras el piloto ajusta la órbita

export default function Earth() {
  const globe = useRef();
  const spin = useRef(0);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uSun: { value: SUN_DIRECTION.clone() } }),
    []
  );

  useFrame((_, dt) => {
    const input = THREE.MathUtils.clamp(telemetry.orbitKeys + telemetry.orbitButton, -1, 1);
    spin.current += (input * ORBIT_SPIN - spin.current) * (1 - Math.exp(-dt * 5));
    globe.current.rotation.y += dt * (BASE_SPIN + spin.current);
    uniforms.uTime.value += dt;
  });

  return (
    <group position={EARTH_POSITION} rotation={[0, 0, AXIAL_TILT]}>
      {/* name="earth": LookControls y Scanner lo usan para pasar de mira a lat/lon */}
      <mesh ref={globe} name="earth">
        <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
        <shaderMaterial
          vertexShader={earthVertex}
          fragmentShader={earthFragment}
          uniforms={uniforms}
        />
        <AnomalyMarkers radius={EARTH_RADIUS} />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <shaderMaterial
          vertexShader={earthVertex}
          fragmentShader={atmosphereFragment}
          uniforms={uniforms}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
