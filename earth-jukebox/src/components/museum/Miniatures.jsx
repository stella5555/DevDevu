// Miniaturas 3D de los satélites e instrumentos de la red, hechas con
// primitivas. No son maquetas fieles: son siluetas reconocibles (el tubo del
// Hubble, la viga con paneles de la Estación Espacial, el ala única de Suomi
// NPP y de Terra, el plato de radar de Jason). Caben en un cubo de lado ~1,6.

const HULL = { color: '#b9c2cf', roughness: 0.45, metalness: 0.75 };
const FOIL = { color: '#c9a24a', roughness: 0.5, metalness: 0.7 };
const DARK = { color: '#232a38', roughness: 0.6, metalness: 0.5 };
const CELL = { color: '#1d3f8f', roughness: 0.35, metalness: 0.5, emissive: '#0a1a44', emissiveIntensity: 0.5 };
const WHITE = { color: '#e6e9ee', roughness: 0.7, metalness: 0.2 };

function Box({ size, mat = HULL, ...props }) {
  return (
    <mesh {...props}>
      <boxGeometry args={size} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

// Cilindro tumbado a lo largo del eje X.
function Tube({ radius, length, mat = HULL, ...props }) {
  return (
    <mesh rotation={[0, 0, Math.PI / 2]} {...props}>
      <cylinderGeometry args={[radius, radius, length, 24]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

function Hubble() {
  return (
    <group rotation={[0, 0, 0.25]}>
      <Tube radius={0.2} length={0.75} position={[0.12, 0, 0]} />
      <Tube radius={0.25} length={0.4} mat={FOIL} position={[-0.44, 0, 0]} />
      <Tube radius={0.17} length={0.02} mat={DARK} position={[0.5, 0, 0]} />
      {/* Tapa de la abertura, entreabierta */}
      <Box size={[0.03, 0.4, 0.4]} position={[0.58, 0.19, 0]} rotation={[0, 0, -0.9]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box size={[0.03, 0.03, 0.2]} mat={DARK} position={[0.05, 0, side * 0.28]} />
          <Box size={[0.72, 0.02, 0.26]} mat={CELL} position={[0.05, 0, side * 0.5]} />
        </group>
      ))}
    </group>
  );
}

function Station() {
  return (
    <group>
      <Box size={[1.6, 0.05, 0.05]} mat={DARK} />
      {[-0.68, -0.42, 0.42, 0.68].map((x) => (
        <Box key={x} size={[0.18, 0.015, 0.78]} mat={FOIL} position={[x, 0, 0]} />
      ))}
      {/* Módulos presurizados, cruzados con la viga */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.72, 20]} />
        <meshStandardMaterial {...HULL} />
      </mesh>
      <Tube radius={0.07} length={0.34} position={[0, -0.12, 0.16]} />
      {[-1, 1].map((side) => (
        <Box key={side} size={[0.2, 0.015, 0.3]} mat={WHITE} position={[side * 0.18, 0.08, -0.05]} />
      ))}
    </group>
  );
}

function Suomi() {
  return (
    <group rotation={[0.2, 0, 0]}>
      <Box size={[0.5, 0.36, 0.36]} mat={FOIL} />
      <Box size={[0.2, 0.2, 0.16]} mat={DARK} position={[0.1, -0.24, 0.05]} />
      <Box size={[0.14, 0.12, 0.12]} mat={WHITE} position={[-0.16, -0.22, -0.06]} />
      {/* Un solo ala solar, a un costado */}
      <Box size={[0.03, 0.03, 0.2]} mat={DARK} position={[0, 0.05, 0.28]} />
      <Box size={[0.42, 0.02, 0.8]} mat={CELL} position={[0, 0.05, 0.78]} />
    </group>
  );
}

function Terra() {
  return (
    <group rotation={[0.15, 0, 0]}>
      <Box size={[0.9, 0.3, 0.32]} mat={FOIL} />
      <Box size={[0.22, 0.14, 0.2]} mat={WHITE} position={[-0.25, -0.2, 0]} />
      <Box size={[0.18, 0.1, 0.16]} mat={DARK} position={[0.22, -0.19, 0.04]} />
      {/* Un ala solar larga, inclinada sobre el cuerpo */}
      <Box size={[0.03, 0.2, 0.03]} mat={DARK} position={[0.1, 0.24, 0]} />
      <Box size={[1.0, 0.02, 0.44]} mat={CELL} position={[0.1, 0.36, 0]} rotation={[0.5, 0, 0]} />
      {/* Antena de alta ganancia */}
      <mesh position={[-0.5, 0.2, 0]} rotation={[0, 0, 0.6]}>
        <coneGeometry args={[0.1, 0.08, 20, 1, true]} />
        <meshStandardMaterial {...WHITE} side={2} />
      </mesh>
    </group>
  );
}

function Jason() {
  return (
    <group>
      <Box size={[0.36, 0.38, 0.44]} mat={FOIL} />
      {[-1, 1].map((side) => (
        <Box key={side} size={[0.62, 0.02, 0.34]} mat={CELL} position={[side * 0.52, 0.05, 0]} rotation={[0.35, 0, 0]} />
      ))}
      {/* Plato del altímetro radar, mirando al mar */}
      <mesh position={[0, -0.27, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.22, 0.12, 28, 1, true]} />
        <meshStandardMaterial {...WHITE} side={2} />
      </mesh>
      <Box size={[0.03, 0.14, 0.03]} mat={DARK} position={[0, -0.32, 0]} />
    </group>
  );
}

export const CRAFT = { hubble: Hubble, iss: Station, suomi: Suomi, terra: Terra, jason: Jason };
