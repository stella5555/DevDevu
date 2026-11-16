import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useScanner } from '../state/scanner.js';
import { QUESTIONS, BUTTON_COLORS, BUTTON_LETTERS, useSecurity, answer } from '../state/security.js';

// Mesa de control: los tres botones de colores de la consola y el holograma
// del protocolo de seguridad que se proyecta sobre ella. Va dentro del grupo
// de la consola, en sus coordenadas (y hacia arriba de la mesa, z hacia el piloto).

const TOP = 0.25; // altura de la cara superior de la consola
const BUTTON_X = [-0.52, 0, 0.52];
const HOLO_W = 1.7;
const HOLO_H = 0.74;

// Rótulo de un botón (A, B, C) pintado en un lienzo.
function letterTexture(letter) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const g = canvas.getContext('2d');
  g.font = "700 68px 'JetBrains Mono', Consolas, monospace";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#04060d';
  g.fillText(letter, 48, 54);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function DeckButton({ index, live }) {
  const { gl } = useThree();
  const cap = useRef();
  const material = useRef();
  const [hover, setHover] = useState(false);
  const pressed = useRef(0);
  const label = useMemo(() => letterTexture(BUTTON_LETTERS[index]), [index]);
  useEffect(() => () => label.dispose(), [label]);

  useFrame((_, dt) => {
    pressed.current = Math.max(0, pressed.current - dt * 5);
    // Apagado fuera del protocolo; encendido y más vivo bajo el puntero.
    const glow = live ? (hover ? 1.6 : 0.75) : 0.08;
    material.current.emissiveIntensity += (glow - material.current.emissiveIntensity) * Math.min(1, dt * 12);
    cap.current.position.y = TOP + 0.03 + (live && hover ? 0.012 : 0) - 0.022 * pressed.current;
  });

  const over = (e) => {
    if (!live) return;
    e.stopPropagation();
    setHover(true);
    gl.domElement.style.cursor = 'pointer';
  };
  const out = () => {
    setHover(false);
    gl.domElement.style.cursor = 'grab';
  };
  const click = (e) => {
    if (!live || e.delta > 6) return; // un arrastre para mirar no es una pulsación
    e.stopPropagation();
    pressed.current = 1;
    answer(index);
  };

  return (
    <group position={[BUTTON_X[index], 0, 0.335]}>
      {/* Base */}
      <mesh position={[0, TOP + 0.008, 0]}>
        <boxGeometry args={[0.4, 0.016, 0.22]} />
        <meshStandardMaterial color="#0d1119" roughness={0.6} metalness={0.7} />
      </mesh>
      <group ref={cap} position={[0, TOP + 0.03, 0]}>
        <mesh onClick={click} onPointerOver={over} onPointerOut={out}>
          <boxGeometry args={[0.34, 0.045, 0.17]} />
          <meshStandardMaterial ref={material} color={BUTTON_COLORS[index]} emissive={BUTTON_COLORS[index]} emissiveIntensity={0.08} roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.0235, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.13, 0.13]} />
          <meshBasicMaterial map={label} transparent depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

// Reparte un texto en líneas que quepan en un ancho.
function wrap(g, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines;
}

function Hologram() {
  const security = useSecurity();
  const material = useRef();
  const { canvas, texture } = useMemo(() => {
    const el = document.createElement('canvas');
    el.width = 1024;
    el.height = 446;
    const t = new THREE.CanvasTexture(el);
    t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: el, texture: t };
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);

  // Se repinta cada vez que cambia la pregunta o el veredicto.
  useEffect(() => {
    const g = canvas.getContext('2d');
    const { index, picked, verdict, granted } = security;
    const tint = granted ? '#59ffc8' : verdict === 'wrong' ? '#ff5d5d' : '#7fe9ff';
    g.clearRect(0, 0, 1024, 446);
    g.fillStyle = 'rgba(6, 22, 34, 0.72)';
    g.fillRect(0, 0, 1024, 446);
    g.strokeStyle = tint;
    g.lineWidth = 4;
    g.strokeRect(6, 6, 1012, 434);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = tint;
    g.font = "500 26px 'JetBrains Mono', Consolas, monospace";
    g.fillText('SECURITY PROTOCOL', 34, 44);
    g.textAlign = 'right';
    g.fillText(`${granted ? QUESTIONS.length : index + 1}/${QUESTIONS.length}`, 990, 44);
    g.textAlign = 'left';

    if (granted) {
      g.font = "700 58px 'Space Grotesk', 'Segoe UI', sans-serif";
      g.fillText('AUTHORIZATION CONFIRMED', 34, 200);
      g.font = "500 34px 'JetBrains Mono', Consolas, monospace";
      g.fillText('Restoring power · onduloscope online', 34, 270);
    } else {
      const question = QUESTIONS[index];
      g.fillStyle = '#ffb454';
      g.font = "600 30px 'Space Grotesk', 'Segoe UI', sans-serif";
      g.fillText(question.topic.toUpperCase(), 34, 92);
      g.fillStyle = '#eafcff';
      g.font = "600 38px 'Space Grotesk', 'Segoe UI', sans-serif";
      const lines = wrap(g, question.text, 950);
      lines.forEach((line, i) => g.fillText(line, 34, 142 + i * 46));
      const top = 142 + lines.length * 46 + 18;
      question.options.forEach((option, k) => {
        const y = top + k * 56;
        const marked = picked === k && verdict;
        g.fillStyle = BUTTON_COLORS[k];
        g.fillRect(34, y - 21, 42, 42);
        g.fillStyle = '#04060d';
        g.font = "700 30px 'JetBrains Mono', Consolas, monospace";
        g.textAlign = 'center';
        g.fillText(BUTTON_LETTERS[k], 55, y + 2);
        g.textAlign = 'left';
        g.fillStyle = marked ? (verdict === 'right' ? '#59ffc8' : '#ff8a8a') : '#eafcff';
        g.font = "500 34px 'Space Grotesk', 'Segoe UI', sans-serif";
        g.fillText(`${option}${marked ? (verdict === 'right' ? '  ✓' : '  ✗') : ''}`, 94, y + 1);
      });
    }
    // Líneas de barrido, como una proyección.
    g.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let y = 0; y < 446; y += 6) g.fillRect(0, y, 1024, 2);
    texture.needsUpdate = true;
  }, [security, canvas, texture]);

  useFrame(({ clock }) => {
    material.current.opacity = 0.9 + 0.06 * Math.sin(clock.elapsedTime * 21) * Math.sin(clock.elapsedTime * 3.3);
  });

  return (
    // Sobre la mesa, inclinado hacia los ojos del piloto. (El grupo de la
    // consola está girado 0.5 rad: -0.83 lo deja mirando al asiento.)
    <group position={[0, 0.6, -0.1]} rotation={[-0.83, 0, 0]} scale={0.66}>
      <mesh>
        <planeGeometry args={[HOLO_W, HOLO_H]} />
        <meshBasicMaterial ref={material} map={texture} transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Haz del proyector: de la mesa al holograma.
function Beam() {
  const material = useRef();
  useFrame(({ clock }) => {
    material.current.opacity = 0.1 + 0.03 * Math.sin(clock.elapsedTime * 9);
  });
  return (
    <mesh position={[0, 0.44, -0.02]} rotation={[0, Math.PI / 4, 0]}>
      <cylinderGeometry args={[0.72, 0.06, 0.4, 4, 1, true]} />
      <meshBasicMaterial ref={material} color="#7fe9ff" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function ConsoleDeck() {
  const phase = useScanner((s) => s.phase);
  const { granted } = useSecurity();
  const live = phase === 'quiz' && !granted;
  return (
    <>
      {BUTTON_X.map((_, i) => (
        <DeckButton key={BUTTON_LETTERS[i]} index={i} live={live} />
      ))}
      {phase === 'quiz' && (
        <>
          <Hologram />
          <Beam />
        </>
      )}
    </>
  );
}
