import { useState } from 'react';

// Tarjeta de "Misión activa": objetivo, pasos, ayuda viva, medidores y el
// control propio de cada mecánica (deslizador de años, botón de marcar…).
// `view` cambia cada vez que la misión avisa de que algo se ha movido.
// `guide` dice qué control toca ahora ({ target, step }) y `locked` bloquea el
// botón de la misión hasta que se haya dado el paso previo.
export default function MissionCard({ spec, mission, view, completed, guide, locked, gaugeRef }) {
  const control = mission?.control;
  const [value, setValue] = useState(control?.type === 'slider' ? control.value : 0);
  const done = view.done;
  const finished = done.length > 0 && done.every(Boolean);
  const current = done.findIndex((ok) => !ok); // el paso que toca
  const glow = (target) => (guide?.target === target ? ' is-guide' : '');

  return (
    <section className={`mission${finished ? ' is-done' : ''}`} aria-label="Active mission">
      <header>
        <h3>{finished || completed ? 'Mission complete' : 'Active mission'}</h3>
        {(finished || completed) && <span className="mission-star">★</span>}
      </header>
      <h4>{spec.title}</h4>
      <p>{spec.brief}</p>
      <ol>
        {spec.steps.map((step, i) => (
          <li key={step} className={done[i] ? 'is-done' : i === current ? 'is-current' : ''}>
            <span aria-hidden="true">{done[i] ? '✓' : i + 1}</span>
            {step}
            {done[i] && <span className="sr-only"> (done)</span>}
          </li>
        ))}
      </ol>

      {control?.type === 'slider' && (
        <label className={`mission-slider${glow('slider')}`}>
          <span>
            {control.label} <b>{control.format(value)}</b>
            {guide?.target === 'slider' && <span className="step-chip">Step {guide.step}</span>}
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
        <>
          <button type="button" className={`btn mission-action${glow('action')}${locked ? ' is-locked' : ''}`} disabled={locked} onClick={() => mission.action()}>
            {locked && <span aria-hidden="true">🔒</span>}
            {control.label}
            {(locked || guide?.target === 'action') && <span className="step-chip">Step 2</span>}
          </button>
          {locked && <p className="mission-lock">Step 1: freeze the video to unlock this button.</p>}
        </>
      )}

      <p className="mission-hint" role="status">
        {finished ? 'Discovery logged! The anomaly is now marked with ★ in the signal log.' : view.hint}
      </p>
    </section>
  );
}
