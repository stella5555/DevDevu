// Tierra procedural (sin texturas externas). En el Pilar 2 se sustituirá el
// color de superficie por Blue Marble / capas SVS, conservando la iluminación.

export const earthVertex = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNw;
  varying vec3 vPw;
  void main() {
    vObj = normalize(position);
    vNw = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPw = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const noise = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 5; i++) {
      s += a * noise(p);
      p = p * 2.03 + vec3(11.7);
      a *= 0.5;
    }
    return s;
  }
`;

export const earthFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uSun;
  varying vec3 vObj;
  varying vec3 vNw;
  varying vec3 vPw;
  ${noise}
  void main() {
    vec3 p = vObj;
    float h = fbm(p * 2.1 + vec3(3.1, 1.7, 5.3)) + 0.08 * (fbm(p * 7.0) - 0.5);
    float land = smoothstep(0.50, 0.53, h);
    float lat = abs(p.y);
    float dry = fbm(p * 4.0 + vec3(20.0));

    vec3 ocean = mix(vec3(0.01, 0.04, 0.13), vec3(0.03, 0.20, 0.34), smoothstep(0.36, 0.50, h));
    vec3 ground = mix(vec3(0.06, 0.20, 0.07), vec3(0.42, 0.34, 0.19), smoothstep(0.45, 0.60, dry));
    ground = mix(ground, vec3(0.30, 0.26, 0.22), smoothstep(0.60, 0.70, h));
    float ice = smoothstep(0.80, 0.90, lat + (dry - 0.5) * 0.2);
    vec3 surf = mix(mix(ocean, ground, land), vec3(0.90, 0.94, 1.0), ice);

    float c1 = fbm(p * 3.2 + vec3(uTime * 0.008, 0.0, uTime * 0.005));
    float c2 = fbm(p * 9.0 - vec3(uTime * 0.006));
    float cloud = smoothstep(0.50, 0.70, c1 * 0.7 + c2 * 0.3);

    float cells = noise(p * 150.0) * noise(p * 34.0 + 5.0);
    float lights = land * (1.0 - ice) * smoothstep(0.34, 0.6, cells);

    vec3 N = normalize(vNw);
    vec3 L = normalize(uSun);
    vec3 V = normalize(cameraPosition - vPw);
    float d = dot(N, L);
    float day = smoothstep(-0.12, 0.22, d);
    float lit = day * (0.2 + 0.9 * max(d, 0.0));

    vec3 col = surf * (0.015 + lit);
    col += vec3(1.0, 0.95, 0.8) * pow(max(dot(N, normalize(L + V)), 0.0), 70.0) * (1.0 - land) * day * 0.6;
    col = mix(col, vec3(1.0) * (0.02 + lit * 1.05), cloud * 0.88);
    col += vec3(1.0, 0.72, 0.38) * lights * (1.0 - day) * (1.0 - cloud * 0.8) * 1.2;

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
