import * as THREE from 'three';

// Latitud/longitud → punto sobre una esfera, con la convención UV de
// SphereGeometry y una textura equirectangular. Es la inversa exacta de la
// lectura "Bajo la mira" que hace LookControls.
export function latLonToVector3(lat, lon, radius = 1, target = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(lon + 180);
  const theta = THREE.MathUtils.degToRad(lat);
  const ring = radius * Math.cos(theta);
  return target.set(-ring * Math.cos(phi), radius * Math.sin(theta), ring * Math.sin(phi));
}
