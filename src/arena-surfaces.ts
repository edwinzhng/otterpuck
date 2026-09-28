import { Color, DoubleSide, ShaderMaterial, Vector2 } from "three";
import { paintNoiseGLSL } from "./painted-surface";
import { POOL } from "./types";

export const createPoolSurface = (
  city: boolean,
  wall: boolean,
): ShaderMaterial =>
  new ShaderMaterial({
    side: DoubleSide,
    fog: true,
    uniforms: {
      uTime: { value: 0 },
      uCity: { value: city ? 1 : 0 },
      uWall: { value: wall ? 1 : 0 },
      uHalfSize: { value: new Vector2(POOL.width / 2, POOL.length / 2) },
      fogColor: { value: new Color() },
      fogDensity: { value: 0.026 },
    },
    vertexShader: `
      varying vec3 vWorld;
      varying vec3 vNormal;
      #include <fog_pars_vertex>
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uCity;
      uniform float uWall;
      uniform vec2 uHalfSize;
      varying vec3 vWorld;
      varying vec3 vNormal;
      #include <fog_pars_fragment>
      ${paintNoiseGLSL}
      void main() {
        vec2 plane = abs(vNormal.x) > .5 ? vWorld.zy : vWorld.xy;
        vec2 p = mix(vWorld.xz, plane, uWall);
        vec2 tile = p + vec2(sin(p.y * 2.7), sin(p.x * 3.1)) * .007;
        vec2 local = fract(tile + .5) - .5;
        vec2 rounded = abs(local) - .405;
        float edge = length(max(rounded,0.)) + min(max(rounded.x,rounded.y),0.) - .078;
        float pixel = max(.001, fwidth(edge));
        float grout = smoothstep(-pixel, pixel, edge);
        float bevel = 1. - smoothstep(-.026, -.004, edge);
        float variation = paintHash(vec3(floor(tile + .5), 4.));
        float glaze = paintNoise(vWorld * vec3(6., 9., 6.));
        vec3 pale = mix(vec3(.075,.39,.43), vec3(.13,.52,.53), variation);
        pale = mix(pale, vec3(.065,.28,.39) + variation * vec3(.025,.045,.05), uCity);
        pale *= mix(1., .9, uWall) * (.95 + glaze * .10);
        pale *= .94 + bevel * .06;
        vec3 color = mix(pale, pale * vec3(.79,.85,.88), grout * .6);
        float edgeDistance = min(uHalfSize.x - abs(vWorld.x), uHalfSize.y - abs(vWorld.z));
        float contact = mix(smoothstep(0., .75, edgeDistance), smoothstep(0., .6, vWorld.y), uWall);
        color *= .88 + contact * .12;
        vec2 q = p * 1.85;
        float wave = sin(q.x + sin(q.y * .83 + uTime * .29))
          + cos(q.y + sin(q.x * .79 - uTime * .25));
        float caustic = pow(max(0., 1. - abs(wave) * .9), 7.);
        color += vec3(.09,.17,.14) * caustic * mix(.30,.17,uCity);
        color += uCity * (vec3(.015,.12,.16) * exp(-abs(vWorld.x + 7.5) * .7)
          + vec3(.09,.015,.06) * exp(-abs(vWorld.x - 7.5) * .7));
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
