import { useState } from 'react';

// Tarjeta de "Misión activa": objetivo, pasos, ayuda viva, medidores y el
// control propio de cada mecánica (deslizador de años, botón de marcar…).
// `view` cambia cada vez que la misión avisa de que algo se ha movido.
export default function MissionCard({ spec, mission, view, completed, gaugeRef }) {
  const control = mission?.control;
  const [value, setValue] = useState(control?.type === 'slider' ? control.value : 0);
  const done = view.done;
  const finished = done.length > 0 && done.every(Boolean);

  return (
    <section className={`mission${finished ? ' is-done' : ''}`} aria-label="Misión activa">
      <header>
        <h3>{finished || completed ? 'Misión completada' : 'Misión activa'}</h3>
        {(finished || completed) && <span className="mission-star">★</span>}
      </header>
      <h4>{spec.title}</h4>
      <p>{spec.brief}</p>
      <ol>
        {spec.steps.map((step, i) => (
          <li key={step} className={done[i] ? 'is-done' : ''}>
            <span aria-hidden="true">{done[i] ? '✓' : i + 1}</span>
            {step}
            {done[i] && <span className="sr-only"> (hecho)</span>}
          </li>
        ))}
      </ol>

      {control?.type === 'slider' && (
        <label className="mission-slider">
          <span>
            {control.label} <b>{control.format(value)}</b>
          </span>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={value}
            onChange={(e) => {
              const next = Number(e.target.value);
              setValue(next);
              mission.setControl(next);
            }}
          />
          <span className="mission-range" aria-hidden="true">
            <i>{control.min}</i>
            <i>{control.max}</i>
          </span>
        </label>
      )}

      {mission?.gauges.map((gauge, i) => (
        <div key={gauge.label} className="mission-gauge">
          <span>{gauge.label}</span>
          <div className="meter" aria-hidden="true">
            <i ref={(el) => gaugeRef(i, el)} />
          </div>
        </div>
      ))}

      {control?.type === 'button' && (
        <button type="button" className="btn mission-action" onClick={() => mission.action()}>
          {control.label}
        </button>
      )}

      <p className="mission-hint" role="status">
        {finished ? '¡Descubrimiento registrado! La anomalía queda marcada con ★ en el registro de señales.' : view.hint}
      </p>
    </section>
  );
}
