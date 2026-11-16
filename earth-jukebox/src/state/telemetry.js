// Estado mutable que el bucle de render escribe y el HUD lee cada frame,
// sin provocar re-renders de React.
export const telemetry = {
  az: 0, // grados, + a la derecha
  el: 0, // grados, + arriba
  fov: 55,
  onEarth: false,
  lat: 0,
  lon: 0,
  // Ajuste de órbita (-1 izquierda, +1 derecha): lo escriben el teclado (Q/E)
  // y los botones del HUD; la Tierra lo lee para girar más deprisa.
  orbitKeys: 0,
  orbitButton: 0,
  onHatch: false, // la mira está sobre la escotilla del museo
  // Petición de mirada: { yaw, pitch, slow }. yaw en radianes o 'back' (media
  // vuelta, hacia la escotilla). LookControls la atiende y la borra.
  look: null,
};
