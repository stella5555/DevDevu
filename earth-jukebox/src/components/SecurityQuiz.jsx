import { useEffect } from 'react';
import { telemetry } from '../state/telemetry.js';
import { QUESTIONS, BUTTON_COLORS, BUTTON_LETTERS, useSecurity, answer, skipProtocol } from '../state/security.js';

// Protocolo de seguridad, en pantalla. El holograma y los tres botones están
// en la consola 3D de la cabina; esta tarjeta dice lo mismo y ofrece los
// mismos botones para quien use teclado, lector de pantalla o una pantalla
// pequeña donde la consola quede lejos.

// Hacia dónde mirar: la consola y su holograma, bajo el ventanal.
const CONSOLE_VIEW = { yaw: 0, pitch: -0.52 };

export default function SecurityQuiz() {
  const { index, picked, verdict, granted } = useSecurity();
  const question = QUESTIONS[index];

  useEffect(() => {
    telemetry.look = { ...CONSOLE_VIEW };
  }, []);

  // Teclas 1, 2, 3 (o A, B, C).
  useEffect(() => {
    const key = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const option = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      const letter = ['a', 'b', 'c'].indexOf(e.key.toLowerCase());
      if (option >= 0) answer(option);
      else if (letter >= 0 && !(e.target instanceof HTMLInputElement)) answer(letter);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  let feedback = 'Answer with the colored buttons on the console, with these, or with keys 1, 2 and 3.';
  if (granted) feedback = 'Authorization confirmed. Restoring power: onduloscope online.';
  else if (verdict === 'wrong') feedback = `“${question.options[picked]}” is not it. Try again.`;
  else if (verdict === 'right') feedback = 'Correct.';

  return (
    <section className={`quiz${granted ? ' is-granted' : ''}${verdict === 'wrong' ? ' is-wrong' : ''}`} aria-label="Security protocol">
      <header>
        <h2>Security protocol</h2>
        <span>
          {granted ? QUESTIONS.length : index + 1}/{QUESTIONS.length}
        </span>
      </header>
      {!granted && (
        <>
          <p className="quiz-question">
            <b>{question.topic}:</b> {question.text}
          </p>
          <div className="quiz-options">
            {question.options.map((option, k) => (
              <button
                key={option}
                type="button"
                className={`btn${picked === k && verdict ? ` is-${verdict}` : ''}`}
                style={{ '--c': BUTTON_COLORS[k] }}
                onClick={() => answer(k)}
              >
                <i aria-hidden="true">{BUTTON_LETTERS[k]}</i>
                {option}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="quiz-feedback" role="status">
        {feedback}
      </p>
      {!granted && (
        <button type="button" className="quiz-skip" onClick={skipProtocol}>
          Jury Mode: skip the protocol
        </button>
      )}
    </section>
  );
}
