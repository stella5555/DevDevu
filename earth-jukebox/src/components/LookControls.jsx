import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EARTH_POSITION, EARTH_RADIUS } from './Earth.jsx';
import { telemetry } from '../state/telemetry.js';

const YAW_LIMIT = Math.PI; // media vuelta a cada lado: la escotilla del museo está justo detrás
const PITCH_LIMIT = 0.9;
const FOV_MIN = 22;
const FOV_MAX = 70;
const DRAG_SPEED = 0.0032;
const KEY_SPEED = 1.2; // rad/s

const sphere = new THREE.Sphere(EARTH_POSITION, EARTH_RADIUS);
const ray = new THREE.Ray();
const hit = new THREE.Vector3();

// Mirada en primera persona: arrastrar (ratón o dedo), flechas/WASD y rueda
// para el zoom del visor. La cámara no se desplaza, solo rota.
export default function LookControls() {
  const { camera, gl, scene } = useThree();
  const s = useRef({ yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, tFov: 55, drag: false, x: 0, y: 0, keys: {} });

  useEffect(() => {
    const el = gl.domElement;
    const st = s.current;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';

    const down = (e) => {
      st.drag = true;
      st.x = e.clientX;
      st.y = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const move = (e) => {
      if (!st.drag) return;
      const k = DRAG_SPEED * (camera.fov / 55);
      st.tYaw += (e.clientX - st.x) * k;
      st.tPitch += (e.clientY - st.y) * k;
      st.x = e.clientX;
      st.y = e.clientY;
    };
    const up = () => {
      st.drag = false;
      el.style.cursor = 'grab';
    };
    const wheel = (e) => {
      e.preventDefault();
      st.tFov = THREE.MathUtils.clamp(st.tFov + e.deltaY * 0.03, FOV_MIN, FOV_MAX);
    };
    const key = (e) => {
      // Las flechas sobre un deslizador (volumen, umbral) no mueven la mirada.
      if (e.type === 'keydown' && e.target instanceof HTMLInputElement) return;
      st.keys[e.code] = e.type === 'keydown';
    };
    // Si la ventana pierde el foco con una tecla pulsada, no llega su keyup.
    const blur = () => {
      st.keys = {};
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('blur', blur);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
    };
  }, [gl, camera]);

  useFrame((_, dt) => {
    const st = s.current;
    const k = st.keys;
    const kx = (k.ArrowLeft || k.KeyA ? 1 : 0) - (k.ArrowRight || k.KeyD ? 1 : 0);
    const ky = (k.ArrowUp || k.KeyW ? 1 : 0) - (k.ArrowDown || k.KeyS ? 1 : 0);
    telemetry.orbitKeys = (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0);
    st.tYaw += kx * KEY_SPEED * dt;
    st.tPitch += ky * KEY_SPEED * dt;
    st.tYaw = THREE.MathUtils.clamp(st.tYaw, -YAW_LIMIT, YAW_LIMIT);
    st.tPitch = THREE.MathUtils.clamp(st.tPitch, -PITCH_LIMIT, PITCH_LIMIT);

    const ease = 1 - Math.exp(-dt * 10);
    st.yaw += (st.tYaw - st.yaw) * ease;
    st.pitch += (st.tPitch - st.pitch) * ease;
    camera.rotation.set(st.pitch, st.yaw, 0, 'YXZ');

    if (Math.abs(camera.fov - st.tFov) > 0.01) {
      camera.fov += (st.tFov - camera.fov) * ease;
      camera.updateProjectionMatrix();
    }

    // Telemetría para el HUD: hacia dónde apunta la mira y qué punto de la
    // Tierra toca.
    telemetry.az = THREE.MathUtils.radToDeg(-st.yaw);
    telemetry.el = THREE.MathUtils.radToDeg(st.pitch);
    telemetry.fov = camera.fov;
    ray.origin.copy(camera.position);
    camera.getWorldDirection(ray.direction);
    const earth = scene.getObjectByName('earth');
    telemetry.onEarth = Boolean(earth && ray.intersectSphere(sphere, hit));
    if (telemetry.onEarth) {
      earth.worldToLocal(hit);
      telemetry.lat = THREE.MathUtils.radToDeg(Math.asin(hit.y / EARTH_RADIUS));
      // Convención UV de SphereGeometry con una textura equirectangular.
      let lon = THREE.MathUtils.radToDeg(Math.atan2(hit.z, -hit.x)) - 180;
      if (lon < -180) lon += 360;
      telemetry.lon = lon;
    }
  });

  return null;
}
