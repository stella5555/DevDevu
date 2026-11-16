import { useEffect, useRef, useState } from 'react';
import { ANOMALIES } from '../data/anomalies.js';
import { telemetry } from '../state/telemetry.js';
import { useScanner, openMuseum, finishHatch } from '../state/scanner.js';

// Apertura de la escotilla del museo. La cámara gira sola hacia el mamparo
// trasero; con las 10 misiones completadas se reproduce public/escotilla.mp4
// a pantalla completa y, al final, un fundido a blanco da paso al museo. Si
// el vídeo no existe (o aún faltan misiones), basta con la luz blanca.

const VIDEO_URL = `${import.meta.env.BASE_URL}escotilla.mp4`;
const TURN_MS = 1400; // giro de 180° hacia la escotilla
const LIGHT_MS = 1500; // fundido a blanco
const REVEAL_MS = 700; // el blanco se retira y aparece el museo

export default function HatchCinematic() {
  const complete = useScanner((s) => s.missions.length === ANOMALIES.length);
  // turn: girando · video: reproduciendo · light: fundido a blanco · reveal: se abre el museo
  const [stage, setStage] = useState('turn');
  const video = useRef();

  useEffect(() => {
    telemetry.look = { yaw: 'back', pitch: -0.1, slow: true };
    const id = setTimeout(() => setStage(complete ? 'video' : 'light'), TURN_MS);
    return () => clearTimeout(id);
  }, []); // solo al montar

  useEffect(() => {
    if (stage === 'light') {
      const id = setTimeout(() => {
        openMuseum();
        setStage('reveal');
      }, LIGHT_MS);
      return () => clearTimeout(id);
    }
    if (stage === 'reveal') {
      const id = setTimeout(finishHatch, REVEAL_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [stage]);

  // El blanco empieza a entrar un poco antes de que acabe el vídeo.
  const watch = () => {
    const el = video.current;
    if (el && el.duration && el.duration - el.currentTime < LIGHT_MS / 1000) setStage('light');
  };
  const toLight = () => setStage((now) => (now === 'video' ? 'light' : now));

  return (
    <div className={`hatch-cinematic is-${stage}`} onClick={toLight} role="presentation">
      {(stage === 'video' || stage === 'light') && complete && (
        <video ref={video} src={VIDEO_URL} autoPlay playsInline onTimeUpdate={watch} onEnded={toLight} onError={toLight} />
      )}
      <div className="hatch-light" />
      <p className="sr-only" role="status">
        Abriendo la escotilla del Museo de los Descubrimientos…
      </p>
    </div>
  );
}
