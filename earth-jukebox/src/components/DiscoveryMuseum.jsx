import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ANOMALIES, CATEGORIES } from '../data/anomalies.js';
import { MUSEUM, LINKS, HUB, CRAFTS } from '../data/museum.js';
import { useScanner, closeMuseum, openPanel } from '../state/scanner.js';
import { symphony } from '../audio/symphony.js';
import { say } from '../state/assistant.js';
import Network from './museum/Network.jsx';

// Pilar 3 · Museo de los Descubrimientos. Los 10 nodos del SVS forman la Red
// del Sistema Terrestre: a la izquierda, la red en 3D; a la derecha, la ficha
// de lo que se seleccione (un nodo, un hilo causal o el centro), la Sinfonía
// Planetaria y las listas de nodos e hilos, que hacen lo mismo que la escena
// 3D pero con teclado.

const byId = Object.fromEntries(ANOMALIES.map((a) => [a.id, a]));

export default function DiscoveryMuseum() {
  const identified = useScanner((s) => s.identified);
  const missions = useScanner((s) => s.missions);
  const stationOpen = useScanner((s) => s.openId !== null);
  const [selected, setSelected] = useState({ type: 'hub' });
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState(true);
  const [muted, setMuted] = useState([]);
  const panel = useRef();
  const close = useRef();

  useEffect(() => {
    close.current.focus();
    return () => symphony.stop();
  }, []);

  // La sinfonía solo cuenta con los nodos que tienen su ★, y calla mientras
  // haya una estación de análisis abierta encima.
  useEffect(() => {
    symphony.setAvailable(missions);
    if (!missions.length || stationOpen) {
      symphony.stop();
      setPlaying(false);
    }
  }, [missions, stationOpen]);

  // Tab no sale del museo (salvo que haya una estación abierta encima).
  useEffect(() => {
    const key = (e) => {
      if (e.key !== 'Tab' || stationOpen) return;
      const items = panel.current.querySelectorAll('button:not(:disabled), a[href]');
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [stationOpen]);

  const toggleSymphony = () => {
    if (symphony.playing) {
      symphony.stop();
      setPlaying(false);
    } else {
      const ok = symphony.start(missions);
      setAudio(ok || !missions.length);
      setPlaying(ok);
      if (ok) say(`Sinfonía Planetaria: ${missions.length === 1 ? 'toca 1 nodo' : `tocan ${missions.length} nodos`}, todos sobre la misma progresión. Apaga y enciende instrumentos para oír qué aporta cada uno.`);
    }
  };

  const toggleMute = (id) => {
    const off = !muted.includes(id);
    symphony.setMuted(id, off);
    setMuted(off ? [...muted, id] : muted.filter((x) => x !== id));
  };

  // Un nodo sin identificar no enseña su nombre, y un hilo solo se puede leer
  // cuando sus dos extremos están identificados.
  const seen = (id) => id === 'hub' || identified.includes(id);
  const nameOf = (id) => (id === 'hub' ? 'Centro de la red' : seen(id) ? byId[id].short : '¿?');
  const revealed = (l) => seen(l.a) && seen(l.b);

  const node = selected.type === 'node' ? byId[selected.id] : null;
  const link = selected.type === 'link' ? LINKS.find((l) => l.id === selected.id) : null;
  const known = node && identified.includes(node.id);
  const starred = node && missions.includes(node.id);
  const nodeLinks = node ? LINKS.filter((l) => l.a === node.id || l.b === node.id) : [];

  return (
    <div className="station-backdrop museum-backdrop" onPointerDown={(e) => e.target === e.currentTarget && closeMuseum()}>
      <section ref={panel} className="museum" role="dialog" aria-modal="true" aria-labelledby="museum-title">
        <header className="station-head">
          <div>
            <span className="chip">Red del Sistema Terrestre</span>
            <h2 id="museum-title">Museo de los Descubrimientos</h2>
            <p className="station-id">
              ★ {missions.length} de {ANOMALIES.length} descubrimientos · {identified.length} señales identificadas
            </p>
          </div>
          <div className="station-actions">
            <button ref={close} type="button" className="btn btn-icon" onClick={closeMuseum} aria-label="Cerrar el museo">
              ✕
            </button>
          </div>
        </header>

        <div className="museum-grid">
          <figure className="museum-scene">
            <Canvas flat dpr={[1, 2]} frameloop={stationOpen ? 'never' : 'always'} camera={{ fov: 42, near: 0.1, far: 300, position: [5, 4, 11] }}>
              <Network identified={identified} missions={missions} selected={selected} onSelect={setSelected} />
            </Canvas>
            <figcaption>Arrastra para girar la red · rueda para acercar · pulsa un nodo o un hilo</figcaption>
          </figure>

          <div className="museum-side">
            <section className="symphony" aria-label="Sinfonía Planetaria">
              <h3>Sinfonía Planetaria</h3>
              <button type="button" className="btn btn-tune" aria-pressed={playing} disabled={!missions.length} onClick={toggleSymphony}>
                {playing ? '❚❚ Detener la sinfonía' : '▶ Escuchar Sinfonía Planetaria'}
              </button>
              <p className="station-note">
                {!missions.length
                  ? 'Cada misión completada ★ suma un instrumento. Todavía no hay ninguno.'
                  : !audio
                    ? 'Este navegador no tiene audio.'
                    : `${missions.length} ${missions.length === 1 ? 'instrumento toca' : 'instrumentos tocan'} la misma progresión; apaga o enciende cada uno.`}
              </p>
              <ul>
                {ANOMALIES.map((a) => {
                  const has = missions.includes(a.id);
                  const on = has && !muted.includes(a.id);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="btn"
                        style={{ '--c': CATEGORIES[a.category].color }}
                        aria-pressed={on}
                        disabled={!has}
                        onClick={() => toggleMute(a.id)}
                        title={has ? `${a.short}: ${MUSEUM[a.id].part}` : 'Completa su misión para sumar este instrumento'}
                      >
                        <i aria-hidden="true" />
                        {has ? MUSEUM[a.id].part : '—'}
                        <span className="sr-only">
                          {' '}
                          ({a.short}
                          {has ? '' : ', sin desbloquear'})
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="museum-card" aria-live="polite">
              {node && (
                <div style={{ '--c': CATEGORIES[node.category].color }}>
                  <h3>
                    Nodo {starred && <span className="mission-star">★</span>}
                  </h3>
                  {known ? (
                    <>
                      <img src={`${import.meta.env.BASE_URL}svs/${node.svsId}.jpg`} alt="" />
                      <h4>{node.title}</h4>
                      <p className="station-id">
                        NASA SVS #{node.svsId} · {CATEGORIES[node.category].label}
                      </p>
                      <dl>
                        <dt>Quién lo mide · miniatura: {CRAFTS[MUSEUM[node.id].craft]}</dt>
                        <dd>{MUSEUM[node.id].instrument}</dd>
                        <dt>Conclusión científica</dt>
                        <dd>{starred ? MUSEUM[node.id].conclusion : 'Bloqueada: completa la misión de su estación para ganar la ★ y leerla.'}</dd>
                      </dl>
                      <button type="button" className="btn station-link" onClick={() => openPanel(node.id)}>
                        Abrir su estación de análisis
                      </button>
                    </>
                  ) : (
                    <>
                      <h4>Señal sin identificar</h4>
                      <p>Este nodo de la red sigue oculto. Vuelve a la cabina, activa el escáner y encuentra su señal sobre la Tierra.</p>
                    </>
                  )}
                  {nodeLinks.length > 0 && (
                    <div className="museum-links">
                      <h3>Sus hilos</h3>
                      {nodeLinks.map((l) => (
                        <button key={l.id} type="button" className="btn" onClick={() => setSelected({ type: 'link', id: l.id })}>
                          ↔ {nameOf(l.a === node.id ? l.b : l.a)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {link && (
                <div>
                  <h3>Hilo causal</h3>
                  <h4>
                    {nameOf(link.a)} ↔ {nameOf(link.b)}
                  </h4>
                  {revealed(link) ? (
                    <>
                      <p className="museum-relation">{link.title}</p>
                      <p>{link.text}</p>
                    </>
                  ) : (
                    <p>Hilo sin descubrir: identifica con el escáner las señales de sus dos extremos para leer cómo se relacionan.</p>
                  )}
                  <div className="museum-links">
                    {[link.a, link.b].map((id) => (
                      <button key={id} type="button" className="btn" onClick={() => setSelected(id === 'hub' ? { type: 'hub' } : { type: 'node', id })}>
                        Ver {nameOf(id)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selected.type === 'hub' && (
                <div>
                  <h3>Centro</h3>
                  <h4>{HUB.title}</h4>
                  <p>{HUB.text}</p>
                  <p>Pulsa un nodo para ver quién lo mide y qué se descubrió, o un hilo para leer cómo se relacionan dos fenómenos.</p>
                </div>
              )}
            </section>

            <nav className="museum-index" aria-label="Nodos e hilos de la red">
              <h3>Nodos</h3>
              <div>
                {ANOMALIES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="btn"
                    aria-pressed={selected.type === 'node' && selected.id === a.id}
                    onClick={() => setSelected({ type: 'node', id: a.id })}
                  >
                    {identified.includes(a.id) ? a.short : 'Sin identificar'}
                    {missions.includes(a.id) && <span className="mission-star"> ★</span>}
                  </button>
                ))}
              </div>
              <h3>Hilos causales</h3>
              <div>
                {LINKS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="btn"
                    aria-pressed={selected.type === 'link' && selected.id === l.id}
                    onClick={() => setSelected({ type: 'link', id: l.id })}
                  >
                    {nameOf(l.a)} ↔ {nameOf(l.b)}
                  </button>
                ))}
              </div>
            </nav>
          </div>
        </div>
      </section>
    </div>
  );
}
