import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Toques personales de la cabina: la foto del equipo y la de la mascota,
// enmarcadas en los mamparos laterales, y el logo del reto en la consola.
// Las imágenes están en public/ (team.jpeg, plushie.jpeg, nasa-logo.jpg).

const BASE = import.meta.env.BASE_URL;
const TRIM = { color: '#2a3243', roughness: 0.5, metalness: 0.7 };

// Plaquita con texto, pintada en un lienzo.
function usePlate(text) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const g = canvas.getContext('2d');
    g.fillStyle = '#0b0f18';
    g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#ffb454';
    g.font = "500 30px 'JetBrains Mono', Consolas, monospace";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 34);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

// Marco con foto. La foto emite un poco de luz propia para que se vea
// también con la cabina a oscuras.
function Photo({ map, width, height, caption, ...props }) {
  const plate = usePlate(caption);
  return (
    <group {...props}>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[width + 0.09, height + 0.09, 0.03]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0, -height / 2 - 0.1, 0]}>
        <planeGeometry args={[Math.min(width, 0.8), 0.09]} />
        <meshBasicMaterial map={plate} />
      </mesh>
    </group>
  );
}

// En los mamparos laterales, a la altura de los ojos: se ven al girar la cabeza.
export function WallFrames() {
  const [team, plushie] = useTexture([`${BASE}team.jpeg`, `${BASE}plushie.jpeg`]);
  return (
    <>
      <Photo map={team} width={1.15} height={0.647} caption="TRIPULACIÓN" position={[-1.93, 0.28, 0.45]} rotation={[0, Math.PI / 2, 0]} />
      <Photo map={plushie} width={0.52} height={0.924} caption="MASCOTA DE A BORDO" position={[1.93, 0.24, 0.45]} rotation={[0, -Math.PI / 2, 0]} />
    </>
  );
}

// Placa del reto sobre la consola (en coordenadas de la consola).
export function ConsoleLogo() {
  const logo = useTexture(`${BASE}nasa-logo.jpg`);
  return (
    <group position={[-1.68, 0.253, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh position={[0, 0, -0.004]}>
        <planeGeometry args={[0.4, 0.4]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      <mesh>
        <planeGeometry args={[0.36, 0.36]} />
        <meshStandardMaterial map={logo} emissiveMap={logo} emissive="#ffffff" emissiveIntensity={0.4} roughness={0.8} metalness={0} />
      </mesh>
    </group>
  );
}
