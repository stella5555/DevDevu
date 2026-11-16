// Iluminación de la Tierra. La superficie es la textura del modelo
// public/earth.glb (Blue Marble real); este shader pone encima lo que el
// modelo no trae: el día y la noche según la posición del Sol, el reflejo del
// Sol en el mar y el halo azul de la atmósfera en los bordes.

export const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNw;
  varying vec3 vPw;
  void main() {
    vUv = uv;
    vNw = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPw = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

export const earthFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vNw;
  varying vec3 vPw;
  void main() {
    vec3 surf = texture2D(uMap, vUv).rgb;
    // Mar: donde el azul manda sobre el rojo y el verde.
    float water = smoothstep(0.0, 0.08, surf.b - max(surf.r, surf.g));

    vec3 N = normalize(vNw);
    vec3 L = normalize(uSun);
    vec3 V = normalize(cameraPosition - vPw);
    float d = dot(N, L);
    float day = smoothstep(-0.12, 0.22, d); // terminador suave
    float lit = day * (0.3 + 1.0 * max(d, 0.0));

    // Lado nocturno casi a oscuras: queda un rastro para adivinar los continentes.
    vec3 col = surf * (0.025 + lit);
    // Reflejo del Sol sobre el mar.
    col += vec3(1.0, 0.95, 0.8) * pow(max(dot(N, normalize(L + V)), 0.0), 70.0) * water * day * 0.5;

    // Atmósfera: borde azul, más vivo en el lado de día, y franja anaranjada
    // en el terminador.
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    col += vec3(0.20, 0.45, 1.0) * fres * (0.08 + day * 0.7);
    col += vec3(0.90, 0.35, 0.10) * fres * smoothstep(0.35, 0.0, abs(d)) * 0.25;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Halo atmosférico: esfera exterior, caras traseras, mezcla aditiva.
export const atmosphereFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uSun;
  varying vec3 vNw;
  varying vec3 vPw;
  void main() {
    vec3 N = normalize(vNw);
    vec3 V = normalize(cameraPosition - vPw);
    float rim = clamp(-dot(N, V) / 0.38, 0.0, 1.0);
    float day = 0.15 + 0.85 * smoothstep(-0.3, 0.3, dot(N, normalize(uSun)));
    gl_FragColor = vec4(vec3(0.25, 0.55, 1.0) * rim * rim * day * 0.9, 1.0);
  }
`;

// Pantalla del onduloscopio en la consola. Repite en pequeño lo que marca el
// HUD: línea plana en espera, estática al escanear y una onda limpia que
// emerge con la intensidad de la señal más cercana (uSignal).
export const scopeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const scopeFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uActive;
  uniform float uSignal;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    float grid = step(0.96, fract(uv.x * 10.0)) + step(0.94, fract(uv.y * 5.0));
    float idle = 0.012 * sin(uv.x * 40.0 + uTime * 3.0);
    float grain = fract(sin(dot(vec2(floor(uv.x * 120.0), floor(uTime * 24.0)), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    float clean = 0.2 * sin(uv.x * 18.0 + uTime * 2.0) * sin(uv.x * 3.0 - uTime * 0.7);
    float y = 0.5 + mix(idle, mix(grain * 0.36, clean, uSignal), uActive);
    float line = smoothstep(0.035, 0.0, abs(uv.y - y));
    vec3 col = vec3(0.01, 0.04, 0.04) + vec3(0.10, 0.50, 0.45) * grid * 0.15 + vec3(0.35, 1.0, 0.8) * line * (0.55 + 0.45 * uActive);
    gl_FragColor = vec4(col, 1.0);
  }
`;
