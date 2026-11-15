import { useMemo } from 'react';

export default function Starfield({ count = 2600, radius = 400 }) {
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      positions.set([radius * s * Math.cos(t), radius * u, radius * s * Math.sin(t)], i * 3);
      const b = 0.25 + Math.pow(Math.random(), 3) * 0.75;
      const warm = Math.random();
      colors.set([b * (0.85 + 0.15 * warm), b * 0.9, b * (1.0 - 0.2 * warm)], i * 3);
    }
    return { positions, colors };
  }, [count, radius]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={1.6} sizeAttenuation={false} vertexColors />
    </points>
  );
}
