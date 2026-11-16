import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ANOMALIES, CATEGORIES } from '../../data/anomalies.js';
import { MUSEUM, LINKS, nodePosition } from '../../data/museum.js';
import { symphony } from '../../audio/symphony.js';
import EarthGlobe from '../EarthGlobe.jsx';
import Starfield from '../Starfield.jsx';
import { CRAFT } from './Miniatures.jsx';

// Escena 3D del museo: la Red del Sistema Terrestre. La Tierra en el centro,
// los 10 nodos alrededor (miniatura del instrumento, póster y nombre) y los
// hilos causales entre ellos. Nodos e hilos se pueden pulsar; la cámara
// orbita sola y se puede arrastrar. Al elegir un hilo, la cámara se acerca a
// él y unos pulsos de energía lo recorren del fenómeno origen al destino.

const GOLD = '#ffd166';
const AMBER = '#ffb454';
const SCOPE = '#59ffc8';
const LOCKED = '#56627a';
const SUN = new THREE.Vector3(-0.6, 0.5, 0.7).normalize();

const REST = new THREE.Vector3(0, 0.7, 0); // a dónde mira la cámara sin nada elegido

// Curva de un hilo: de su nodo origen (a) a su destino (b), combada hacia el centro.
function linkCurve(link) {
  const a = new THREE.Vector3(...nodePosition(link.a));
  const b = new THREE.Vector3(...nodePosition(link.b));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  if (link.b !== 'hub') {
    mid.multiplyScalar(0.62);
    mid.y += 0.5;
  }
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

// Brillo de cada nodo (0..1) al compás de la Sinfonía Planetaria.
const pulses = {};

function Conductor() {
  useFrame((_, dt) => {
    const now = symphony.now();
    while (symphony.events.length && symphony.events[0].time <= now) {
      const event = symphony.events.shift();
      pulses[event.id] = Math.max(pulses[event.id] ?? 0, Math.min(1, event.level));
    }
    const fade = Math.exp(-dt * 4.5);
    for (const id in pulses) pulses[id] *= fade;
  });
  return null;
}

// Cámara en órbita alrededor de la red: gira despacio sola y se arrastra.
// Con `focus` ({ point, radius }) se coloca delante de ese punto y se acerca.
function OrbitRig({ focus }) {
  const { camera, gl, size } = useThree();
  const state = useRef({ yaw: 0.45, pitch: 0.56, radius: 14, drag: false, x: 0, y: 0, idle: 3, aim: null, goal: null });
  const look = useRef(REST.clone());

  // Nuevo enfoque: hacia qué lado girar y cuánto acercarse.
  useEffect(() => {
    const st = state.current;
    st.aim = focus ? Math.atan2(focus.point.x, focus.point.z) : null;
    st.goal = focus ? focus.radius : 14;
    if (focus) st.idle = 0;
  }, [focus]);

  useEffect(() => {
    const el = gl.domElement;
    const s = state.current;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    const down = (e) => {
      s.drag = true;
      s.x = e.clientX;
      s.y = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!s.drag) return;
      s.yaw -= (e.clientX - s.x) * 0.006;
      s.pitch = THREE.MathUtils.clamp(s.pitch + (e.clientY - s.y) * 0.004, -0.15, 0.9);
      s.x = e.clientX;
      s.y = e.clientY;
      s.idle = 0;
      s.aim = null; // quien arrastra manda sobre el enfoque automático
    };
    const up = () => {
      s.drag = false;
    };
    const wheel = (e) => {
      e.preventDefault();
      s.radius = THREE.MathUtils.clamp(s.radius + e.deltaY * 0.008, 8, 19);
      s.goal = null;
      s.idle = 0;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const s = state.current;
    s.idle += dt;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ease = 1 - Math.exp(-dt * 3);
    if (s.aim !== null) {
      const turn = Math.atan2(Math.sin(s.aim - s.yaw), Math.cos(s.aim - s.yaw)); // por el lado corto
      s.yaw += turn * ease;
    } else if (!s.drag && s.idle > 2.5 && !still && !focus) {
      s.yaw += dt * 0.05;
    }
    if (s.goal !== null) s.radius += (s.goal - s.radius) * ease;
    look.current.lerp(focus ? focus.point : REST, ease);
    // En lienzos estrechos (móvil) la cámara se aleja para que quepa el anillo.
    const radius = s.radius * Math.max(1, 1.3 / (size.width / size.height));
    const flat = Math.cos(s.pitch) * radius;
    camera.position.set(Math.sin(s.yaw) * flat, 0.7 + Math.sin(s.pitch) * radius, Math.cos(s.yaw) * flat);
    camera.lookAt(look.current);
  });
  return null;
}

// Póster del nodo: su .jpg del SVS, recortado al centro en 16:9.
function usePoster(svsId) {
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    let alive = true;
    let loaded;
    new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}svs/${svsId}.jpg`, (t) => {
      if (!alive) return t.dispose();
      t.colorSpace = THREE.SRGBColorSpace;
      const aspect = t.image.width / t.image.height;
      const frame = 16 / 9;
      if (aspect > frame) {
        t.repeat.set(frame / aspect, 1);
        t.offset.set((1 - frame / aspect) / 2, 0);
      } else {
        t.repeat.set(1, aspect / frame);
        t.offset.set(0, (1 - aspect / frame) / 2);
      }
      loaded = t;
      setTexture(t);
    });
    return () => {
      alive = false;
      loaded?.dispose();
    };
  }, [svsId]);
  return texture;
}

// Rótulo pintado en un lienzo y usado como sprite (siempre mira a la cámara).
function useLabel(text, color) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const g = canvas.getContext('2d');
    g.font = "600 40px 'Space Grotesk', 'Segoe UI', sans-serif";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(2, 3, 10, 0.9)';
    g.strokeText(text, 256, 50, 500);
    g.fillStyle = color;
    g.fillText(text, 256, 50, 500);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function usePointerCursor() {
  const { gl } = useThree();
  const [hover, setHover] = useState(false);
  return {
    hover,
    handlers: {
      onPointerOver: (e) => {
        e.stopPropagation();
        setHover(true);
        gl.domElement.style.cursor = 'pointer';
      },
      onPointerOut: () => {
        setHover(false);
        gl.domElement.style.cursor = 'grab';
      },
    },
  };
}

// Solo cuenta como clic si el puntero casi no se ha movido (si no, era un giro).
const clicked = (action) => (e) => {
  if (e.delta > 6) return;
  e.stopPropagation();
  action();
};

function Node({ anomaly, known, starred, selected, onSelect }) {
  const info = MUSEUM[anomaly.id];
  const Craft = CRAFT[info.craft];
  const poster = usePoster(anomaly.svsId);
  const color = starred ? GOLD : known ? CATEGORIES[anomaly.category].color : LOCKED;
  const label = useLabel(known ? `${anomaly.short}${starred ? ' ★' : ''}` : 'Unidentified', known ? '#eafff8' : '#7f8fa8');
  const craft = useRef();
  const halo = useRef();
  const { hover, handlers } = usePointerCursor();

  useFrame((_, dt) => {
    craft.current.rotation.y += dt * 0.45;
    const pulse = pulses[anomaly.id] ?? 0;
    halo.current.scale.setScalar(1 + 0.45 * pulse + (selected ? 0.1 : 0));
    halo.current.material.opacity = Math.min(1, 0.4 + 0.6 * Math.max(pulse, selected ? 1 : 0, hover ? 0.7 : 0));
    craft.current.position.y = 0.98 + 0.18 * pulse;
  });

  return (
    <group position={nodePosition(anomaly.id)}>
      <group ref={craft} position={[0, 0.98, 0]} scale={0.6}>
        {known ? (
          <Craft />
        ) : (
          <mesh>
            <icosahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial color={LOCKED} wireframe />
          </mesh>
        )}
      </group>
      <sprite scale={[1.34, 0.754, 1]}>
        {/* La clave recrea el material cuando llega la textura: pasar de no
            tener mapa a tenerlo cambia su shader. */}
        <spriteMaterial key={known && poster ? 'poster' : 'empty'} map={known ? poster : null} color={known && poster ? '#ffffff' : '#10141c'} />
      </sprite>
      <mesh ref={halo} position={[0, -0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.84, selected ? 0.04 : 0.026, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
      <sprite position={[0, -0.82, 0]} scale={[2, 0.375, 1]}>
        <spriteMaterial map={label} transparent depthWrite={false} />
      </sprite>
      {/* Zona de clic, más generosa que el dibujo */}
      <mesh position={[0, 0.2, 0]} onClick={clicked(() => onSelect({ type: 'node', id: anomaly.id }))} {...handlers}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Hub({ selected, onSelect }) {
  const globe = useRef();
  const label = useLabel('Center of the network', '#eafff8');
  const { hover, handlers } = usePointerCursor();
  useFrame((_, dt) => {
    globe.current.rotation.y += dt * 0.12;
  });
  return (
    <group>
      <group ref={globe} onClick={clicked(() => onSelect({ type: 'hub' }))} {...handlers}>
        <EarthGlobe radius={0.95} sun={SUN} />
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.25, selected || hover ? 0.03 : 0.015, 8, 72]} />
        <meshBasicMaterial color={selected ? AMBER : SCOPE} transparent opacity={selected || hover ? 0.9 : 0.4} />
      </mesh>
      <sprite position={[0, -1.25, 0]} scale={[2, 0.375, 1]}>
        <spriteMaterial map={label} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

// Pulsos de energía que recorren un hilo del nodo origen al destino: la
// relación causal se ve, además de leerse.
const PULSES = 7;
function EnergyPulses({ curve }) {
  const group = useRef();
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    group.current.children.forEach((pulse, i) => {
      const t = (clock.elapsedTime * 0.85 + i / PULSES) % 1;
      curve.getPoint(t, point);
      pulse.position.copy(point);
      // Nacen pequeños en el origen, crecen por el camino y se apagan al llegar.
      const swell = Math.sin(t * Math.PI);
      pulse.scale.setScalar(0.5 + 1.1 * swell);
      pulse.material.opacity = 0.25 + 0.75 * swell;
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: PULSES }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshBasicMaterial color="#ffe2a8" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

// Hilo causal entre dos nodos: un tubo fino curvado hacia el centro.
function Thread({ link, revealed, selected, onSelect }) {
  const { curve, line, zone } = useMemo(() => {
    const curve = linkCurve(link);
    return { curve, line: new THREE.TubeGeometry(curve, 48, 0.03, 8), zone: new THREE.TubeGeometry(curve, 24, 0.15, 6) };
  }, [link]);
  useEffect(() => () => {
    line.dispose();
    zone.dispose();
  }, [line, zone]);
  const material = useRef();
  const { hover, handlers } = usePointerCursor();
  const lit = selected || hover;

  useFrame(() => {
    const pulse = Math.max(pulses[link.a] ?? 0, pulses[link.b] ?? 0);
    material.current.opacity = lit ? 1 : revealed ? 0.45 + 0.55 * pulse : 0.16;
  });

  return (
    <group>
      {selected && revealed && <EnergyPulses curve={curve} />}
      <mesh geometry={line}>
        <meshBasicMaterial ref={material} color={lit ? AMBER : !revealed ? LOCKED : link.bridge ? '#8fa3c8' : SCOPE} transparent opacity={0.3} />
      </mesh>
      <mesh geometry={zone} onClick={clicked(() => onSelect({ type: 'link', id: link.id }))} {...handlers}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function Network({ identified, missions, selected, onSelect }) {
  // Un hilo se enfoca en su punto medio, de cerca; un nodo, algo más lejos.
  const focus = useMemo(() => {
    if (selected.type === 'link') return { point: linkCurve(LINKS.find((link) => link.id === selected.id)).getPoint(0.5), radius: 9.5 };
    if (selected.type === 'node') return { point: new THREE.Vector3(...nodePosition(selected.id)), radius: 11 };
    return null;
  }, [selected]);

  return (
    <>
      <color attach="background" args={['#04060d']} />
      <ambientLight color="#9fb4d8" intensity={1.5} />
      <directionalLight color="#ffffff" intensity={2.2} position={[4, 6, 8]} />
      <directionalLight color="#ffb454" intensity={0.8} position={[-6, -2, -4]} />
      <Starfield count={900} radius={80} />
      <OrbitRig focus={focus} />
      <Conductor />
      <Suspense fallback={null}>
        <Hub selected={selected.type === 'hub'} onSelect={onSelect} />
      </Suspense>
      {LINKS.map((link) => (
        <Thread
          key={link.id}
          link={link}
          revealed={[link.a, link.b].every((id) => id === 'hub' || identified.includes(id))}
          selected={selected.type === 'link' && selected.id === link.id}
          onSelect={onSelect}
        />
      ))}
      {ANOMALIES.map((anomaly) => (
        <Node
          key={anomaly.id}
          anomaly={anomaly}
          known={identified.includes(anomaly.id)}
          starred={missions.includes(anomaly.id)}
          selected={selected.type === 'node' && selected.id === anomaly.id}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
