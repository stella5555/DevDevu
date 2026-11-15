import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ANOMALIES, CATEGORIES } from '../data/anomalies.js';
import { latLonToVector3 } from '../lib/geo.js';
import { scan, useScanner } from '../state/scanner.js';

// Los nodos del catálogo sobre el globo (hijos de la malla de la Tierra: giran con ella).
// Sin identificar son invisibles; con el escáner activo asoma un eco tenue
// cuando la señal ya es fuerte, para que el oído no sea la única pista.
// Una vez identificados quedan como baliza del color de su categoría.
const UNKNOWN = '#d7e3f4';
const OUTWARD = new THREE.Vector3(0, 0, 1);
const { smoothstep } = THREE.MathUtils;

function Marker({ anomaly, radius, known, groupRef }) {
  const { position, quaternion } = useMemo(() => {
    const up = latLonToVector3(anomaly.lat, anomaly.lon, 1);
    return {
      position: up.clone().multiplyScalar(radius * 1.004),
      quaternion: new THREE.Quaternion().setFromUnitVectors(OUTWARD, up),
    };
  }, [anomaly, radius]);
  const color = known ? CATEGORIES[anomaly.category].color : UNKNOWN;
  const material = <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />;

  return (
    <group ref={groupRef} position={position} quaternion={quaternion} visible={false}>
      <mesh>
        <ringGeometry args={[0.145, 0.175, 48]} />
        {material}
      </mesh>
      <mesh>
        <circleGeometry args={[0.05, 24]} />
        {material}
      </mesh>
      {/* Onda que se expande */}
      <mesh>
        <ringGeometry args={[0.16, 0.175, 48]} />
        {material}
      </mesh>
    </group>
  );
}

// Pulso guía de una pista de ARIA: dos anillos ámbar que se abren sobre la
// señal señalada (aunque aún no esté identificada).
function HintPulse({ radius }) {
  const group = useRef();
  const shown = useRef(-1);
  useFrame(({ clock }) => {
    const index = scan.hint.index;
    group.current.visible = index >= 0;
    if (index < 0) return;
    if (index !== shown.current) {
      shown.current = index;
      const up = latLonToVector3(ANOMALIES[index].lat, ANOMALIES[index].lon, 1);
      group.current.position.copy(up).multiplyScalar(radius * 1.006);
      group.current.quaternion.setFromUnitVectors(OUTWARD, up);
    }
    group.current.children.forEach((ring, i) => {
      const phase = (clock.elapsedTime * 0.8 + i * 0.5) % 1;
      ring.scale.setScalar(1 + phase * 3.4);
      ring.material.opacity = (1 - phase) * 0.9;
    });
  });
  return (
    <group ref={group} visible={false}>
      {[0, 1].map((i) => (
        <mesh key={i}>
          <ringGeometry args={[0.2, 0.235, 48]} />
          <meshBasicMaterial color="#ffb454" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function AnomalyMarkers({ radius }) {
  const identified = useScanner((s) => s.identified);
  const groups = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ANOMALIES.forEach((anomaly, i) => {
      const group = groups.current[i];
      if (!group) return;
      const known = identified.includes(anomaly.id);
      const alpha = known ? 1 : scan.active ? smoothstep(scan.levels[i], 0.5, 1) * 0.75 : 0;
      group.visible = alpha > 0.01;
      if (!group.visible) return;
      const [ring, dot, wave] = group.children;
      const phase = (t * 0.55 + i * 0.37) % 1;
      ring.material.opacity = alpha * 0.9;
      dot.material.opacity = alpha;
      wave.material.opacity = alpha * (1 - phase) * 0.6;
      wave.scale.setScalar(1 + phase * 2.4);
    });
  });

  return (
    <>
      {ANOMALIES.map((anomaly, i) => (
        <Marker
          key={anomaly.id}
          anomaly={anomaly}
          radius={radius}
          known={identified.includes(anomaly.id)}
          groupRef={(el) => (groups.current[i] = el)}
        />
      ))}
      <HintPulse radius={radius} />
    </>
  );
}
