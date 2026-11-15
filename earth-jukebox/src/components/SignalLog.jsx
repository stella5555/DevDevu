import { useEffect, useState } from 'react';
import { ANOMALIES, CATEGORIES } from '../data/anomalies.js';
import { useScanner, openPanel, resetProgress, unlockAll } from '../state/scanner.js';

// Registro de señales: una ranura por anomalía del catálogo. Las identificadas
// muestran su nombre y abren la estación de análisis; el resto sigue en blanco.
export default function SignalLog() {
  const identified = useScanner((s) => s.identified);
  const missions = useScanner((s) => s.missions);
  const [confirming, setConfirming] = useState(false);

  // El reinicio pide un segundo clic; si no llega en 4 s, se desarma.
  useEffect(() => {
    if (!confirming) return undefined;
    const id = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(id);
  }, [confirming]);

  const reset = () => {
    if (confirming) resetProgress();
    setConfirming(!confirming);
  };

  return (
    <section className="signals" aria-label="Registro de señales">
      <h2>
        Señales <span>{identified.length}/{ANOMALIES.length}</span>
      </h2>
      <ol>
        {ANOMALIES.map((a) =>
          identified.includes(a.id) ? (
            <li key={a.id} style={{ '--c': CATEGORIES[a.category].color }}>
              <button
                type="button"
                onClick={() => openPanel(a.id)}
                title={`Abrir análisis: ${a.title}${missions.includes(a.id) ? ' · misión completada' : ''}`}
              >
                <i aria-hidden="true" />
                <span>{a.short}</span>
                {missions.includes(a.id) && <b aria-label="misión completada">★</b>}
              </button>
            </li>
          ) : (
            <li key={a.id} className="is-unknown">
              <i aria-hidden="true" />
              <span>Sin identificar</span>
            </li>
          )
        )}
      </ol>
      {identified.length > 0 && (
        <button type="button" className={`signals-reset${confirming ? ' is-armed' : ''}`} onClick={reset}>
          {confirming ? '¿Borrar el progreso? Confirmar' : 'Reiniciar exploración'}
        </button>
      )}
      {/* Atajo para la evaluación: todo identificado y con ★ de un clic. */}
      {missions.length < ANOMALIES.length && (
        <button type="button" className="signals-reset" onClick={unlockAll}>
          Modo Jurado (Desbloquear todo)
        </button>
      )}
    </section>
  );
}
