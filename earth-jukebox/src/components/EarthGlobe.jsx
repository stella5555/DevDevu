import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { earthVertex, earthFragment } from '../shaders/earth.js';

// La Tierra: la malla y la textura de public/earth.glb con nuestro shader de
// día, noche y atmósfera encima (shaders/earth.js). La usan la cabina y el
// centro de la red del museo.
//
// El modelo es un cubo-esfera con el mapa desplegado en cruz. En sus ejes,
// Greenwich (lat 0, lon 0) mira a −Z y 90°O a +X; girándolo −90° en Y queda
// en la convención de src/lib/geo.js, así que las coordenadas de las señales
// caen sobre la geografía real.
export const EARTH_MODEL = `${import.meta.env.BASE_URL}earth.glb`;
const ALIGN = [0, -Math.PI / 2, 0];

export default function EarthGlobe({ radius, sun }) {
  const { scene } = useGLTF(EARTH_MODEL);

  const { geometry, map, scale } = useMemo(() => {
    let mesh;
    scene.traverse((child) => {
      if (child.isMesh && !mesh) mesh = child;
    });
    const texture = mesh.material.map;
    // El shader trabaja con los colores tal cual se ven, sin conversión.
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
    return { geometry: mesh.geometry, map: texture, scale: radius / mesh.geometry.boundingSphere.radius };
  }, [scene, radius]);

  const uniforms = useMemo(() => ({ uMap: { value: map }, uSun: { value: sun.clone() } }), [map, sun]);

  return (
    <mesh geometry={geometry} rotation={ALIGN} scale={scale}>
      <shaderMaterial vertexShader={earthVertex} fragmentShader={earthFragment} uniforms={uniforms} />
    </mesh>
  );
}

useGLTF.preload(EARTH_MODEL);
