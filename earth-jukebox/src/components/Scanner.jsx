import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ANOMALIES } from '../data/anomalies.js';
import { latLonToVector3 } from '../lib/geo.js';
import { onduloscope } from '../audio/onduloscope.js';
import { scan, isIdentified, isPanelOpen, identify, openPanel, closeOverlay, toggleScanner, primaryAction } from '../state/scanner.js';
import { say } from '../state/assistant.js';
import { EARTH_POSITION, EARTH_RADIUS } from './Earth.jsx';

// Escáner de anomalías, al estilo del Signalscope de Outer Wilds: no hay
// marcadores que seguir, solo el ángulo entre la mira y cada señal.
const RANGE = THREE.MathUtils.degToRad(14); // a partir de aquí empieza a oírse
const LOCK_DEG = 2.2; // radio de "señal clara" con el visor a 1× (se estrecha al acercar)
const DWELL_SECONDS = 1.5;
const HORIZON = 0.02; // coseno mínimo entre la normal y la cámara para estar a la vista
const BEHIND_HORIZON = 0.18; // tras el planeta la señal llega, pero muy atenuada
const HINT_MS = 20000; // lo que dura una pista de ARIA en pantalla
const CLICK_PIXELS = 6;
const CLICK_MS = 400;

const { smoothstep, degToRad } = THREE.MathUtils;
const aim = new THREE.Vector3();
const world = new THREE.Vector3();
const normal = new THREE.Vector3();
const pointer = new THREE.Vector3();
const view = new THREE.Vector3();
const toCamera = new THREE.Quaternion();

const coordinate = (value, positive, negative) => `${Math.abs(value).toFixed(1)}°${value >= 0 ? positive : negative}`;
const SIDES = ['a la derecha', 'arriba a la derecha', 'hacia arriba', 'arriba a la izquierda', 'a la izquierda', 'abajo a la izquierda', 'hacia abajo', 'abajo a la derecha'];
function latitudeWords(lat) {
  const side = lat >= 0 ? 'norte' : 'sur';
  const size = Math.abs(lat);
  if (size < 1.5) return 'justo sobre el ecuador';
  if (size < 15) return `ligeramente al ${side} del ecuador`;
  if (size < 35) return `en los subtrópicos del ${side}`;
  return `en latitudes medias del ${side}`;
}

export default function Scanner() {
  const { camera, gl, scene } = useThree();
  const nodes = useMemo(
    () =>
      ANOMALIES.map((a) => ({
        local: latLonToVector3(a.lat, a.lon, EARTH_RADIUS),
        dir: new THREE.Vector3(), // cámara → anomalía, en mundo
        angle: Math.PI, // entre la mira y la anomalía
        facing: -1, // > HORIZON: en la cara visible del planeta
        side: 0, // > 0: a la derecha del centro del planeta, visto desde la cabina
      })),
    []
  );

  useFrame((_, rawDt) => {
    const earth = scene.getObjectByName('earth');
    if (!earth) return;
    const dt = Math.min(rawDt, 0.1); // una pestaña dormida no cuenta como mira sostenida
    const lock = degToRad((LOCK_DEG * camera.fov) / 55);
    camera.getWorldDirection(aim);

    let target = -1;
    let signal = 0;
    let focus = -1;
    let focusAngle = lock * 1.5;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      world.copy(node.local).applyMatrix4(earth.matrixWorld);
      normal.subVectors(world, EARTH_POSITION).normalize();
      node.dir.subVectors(world, camera.position).normalize();
      node.angle = aim.angleTo(node.dir);
      node.facing = -normal.dot(node.dir);
      node.side = world.x - EARTH_POSITION.x;

      let level = 0;
      if (scan.active) {
        const proximity = 1 - smoothstep(node.angle, lock, RANGE);
        const sight = smoothstep(node.facing, -0.06, 0.1);
        level = proximity * (BEHIND_HORIZON + (1 - BEHIND_HORIZON) * sight);
      }
      scan.levels[i] = level;
      if (level > signal) {
        signal = level;
        target = i;
      }
      if (node.facing > HORIZON && node.angle < focusAngle && isIdentified(ANOMALIES[i].id)) {
        focus = i;
        focusAngle = node.angle;
      }
    }

    const visible = target >= 0 && nodes[target].facing > HORIZON;
    scan.signal = signal;
    scan.target = target;
    scan.hidden = target >= 0 && !visible;
    // Con la estación de análisis abierta el escáner queda en pausa.
    const busy = isPanelOpen();
    scan.focus = busy ? -1 : focus;
    scan.pending = !busy && visible && nodes[target].angle <= lock && !isIdentified(ANOMALIES[target].id);

    // Mira centrada 1.5 s sobre la señal clara → identificada.
    if (scan.pending) {
      scan.dwell += dt / DWELL_SECONDS;
      if (scan.dwell >= 1) {
        scan.dwell = 0;
        scan.pending = false;
        identify(ANOMALIES[target].id);
      }
    } else {
      scan.dwell = Math.max(0, scan.dwell - dt * 4);
    }

    if (scan.active) onduloscope.update(scan.levels);

    // ── Pista de ARIA: la señal sin identificar más cercana ──
    const now = performance.now();
    if (scan.hintRequest) {
      scan.hintRequest = false;
      // De las visibles, la más cercana a la mira; si no hay ninguna a la
      // vista, la que antes va a asomar por el borde.
      let pick = -1;
      nodes.forEach((node, i) => {
        if (isIdentified(ANOMALIES[i].id)) return;
        const seen = node.facing > HORIZON;
        const best = pick >= 0 ? nodes[pick] : null;
        const bestSeen = best && best.facing > HORIZON;
        if (!best || (seen && !bestSeen) || (seen === bestSeen && (seen ? node.angle < best.angle : node.facing > best.facing))) pick = i;
      });
      if (pick < 0) {
        say('Ya has identificado las 10 señales. Abre sus estaciones para completar las misiones ★ o visita el museo.', 'hint');
      } else {
        const a = ANOMALIES[pick];
        const node = nodes[pick];
        scan.hint.index = pick;
        scan.hint.until = now + HINT_MS;
        const where = `${a.region}, ${latitudeWords(a.lat)} (≈ ${coordinate(a.lat, 'N', 'S')}, ${coordinate(a.lon, 'E', 'O')})`;
        if (node.facing > HORIZON) {
          view.copy(node.dir).applyQuaternion(toCamera.copy(camera.quaternion).invert());
          const sector = Math.round(Math.atan2(view.y, view.x) / (Math.PI / 4));
          const degrees = Math.round(THREE.MathUtils.radToDeg(node.angle));
          const move = degrees < 3 ? 'La tienes casi en la mira' : `Lleva la mira ${SIDES[(sector + 8) % 8]}, unos ${degrees}°`;
          say(`Pista: busca en ${where}. ${move}: sigue la flecha ámbar de la retícula y el pulso sobre el globo.${scan.active ? '' : ' Activa el escáner para oírla.'}`, 'hint');
        } else {
          const key = node.side > 0 ? 'Q' : 'E';
          say(`Pista: la señal más próxima está en ${where}, ahora en la cara oculta. Mantén ${key} para girar la órbita hasta que asome por el borde ${key === 'Q' ? 'derecho' : 'izquierdo'}; después sigue la flecha de la retícula.`, 'hint');
        }
      }
    }
    const hint = scan.hint;
    if (hint.index >= 0) {
      const node = nodes[hint.index];
      if (now > hint.until || isIdentified(ANOMALIES[hint.index].id) || busy) {
        hint.index = -1;
      } else {
        view.copy(node.dir).applyQuaternion(toCamera.copy(camera.quaternion).invert());
        hint.angle = Math.atan2(view.y, view.x);
        hint.degrees = THREE.MathUtils.radToDeg(node.angle);
        hint.hidden = node.facing > HORIZON ? null : node.side > 0 ? 'Q' : 'E';
      }
    }
  });

  useEffect(() => {
    const el = gl.domElement;
    let press = null;

    // Un clic (no un arrastre) sobre una señal: la identifica si ya es clara,
    // o abre su análisis si ya estaba identificada.
    const down = (e) => {
      press = { x: e.clientX, y: e.clientY, at: performance.now() };
    };
    const up = (e) => {
      if (!press) return;
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      const held = performance.now() - press.at;
      press = null;
      if (moved > CLICK_PIXELS || held > CLICK_MS) return;

      const rect = el.getBoundingClientRect();
      pointer
        .set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      let hit = -1;
      let nearest = degToRad((3.2 * camera.fov) / 55);
      nodes.forEach((node, i) => {
        const angle = pointer.angleTo(node.dir);
        if (node.facing > HORIZON && angle < nearest) {
          hit = i;
          nearest = angle;
        }
      });
      if (hit < 0) return;
      const id = ANOMALIES[hit].id;
      if (isIdentified(id)) openPanel(id);
      else if (scan.pending && scan.target === hit) identify(id);
    };

    const key = (e) => {
      if (e.repeat) return;
      if (e.code === 'Escape') return closeOverlay();
      if (isPanelOpen()) return; // el teclado es de la estación o del museo
      // Con el foco en un botón o enlace, Espacio y Enter son suyos.
      if (e.target instanceof Element && e.target.closest('button, a')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleScanner();
      } else if (e.code === 'Enter') {
        // Sin preventDefault, el keypress de este mismo Enter llegaría al botón
        // de cerrar que el panel enfoca al abrirse, y lo cerraría al instante.
        e.preventDefault();
        primaryAction();
      }
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    window.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', key);
    };
  }, [gl, camera, nodes]);

  return null;
}
