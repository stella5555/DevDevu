import { SLOT_COLORS } from '../../audio/jukebox.js';
import { ROLES } from '../../data/datasets.js';

// Consola multipista: una tira por fenómeno del dataset, con silencio (M),
// solo (S), volumen y un medidor de su intensidad en la franja que suena.
// Poner una pista en solo también la aísla en el visor.
export default function Mixer({ layers, mix, onChange, meterRef }) {
  const soloing = mix.some((m) => m.solo);

  return (
    <section className="mixer" aria-label="Consola multipista">
      <h3>Consola multipista</h3>
      <ul>
        {layers.map((layer, i) => {
          const m = mix[i];
          const silent = m.mute || (soloing && !m.solo);
          return (
            <li key={layer.name} className={silent ? 'is-silent' : ''} style={{ '--c': SLOT_COLORS[i] }}>
              <div className="track-name">
                <i aria-hidden="true" />
                <strong>
                  <span aria-hidden="true">{layer.icon}</span> {layer.name}
                </strong>
                <span>{ROLES[layer.role]}</span>
              </div>
              <div className="track-meter" aria-hidden="true">
                <i ref={(el) => meterRef(i, el)} />
              </div>
              <div className="track-controls">
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-pressed={m.mute}
                  aria-label={`Silenciar ${layer.name}`}
                  title="Silenciar"
                  onClick={() => onChange(i, { mute: !m.mute })}
                >
                  M
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-pressed={m.solo}
                  aria-label={`Solo ${layer.name}`}
                  title="Solo: suena y se ve solo este fenómeno"
                  onClick={() => onChange(i, { solo: !m.solo })}
                >
                  S
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(m.volume * 100)}
                  aria-label={`Volumen de ${layer.name}`}
                  onChange={(e) => onChange(i, { volume: e.target.value / 100 })}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
