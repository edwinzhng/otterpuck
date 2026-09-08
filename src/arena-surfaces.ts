import { Color, DoubleSide, ShaderMaterial } from "three";

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
      varying vec3 vWorld;
      varying vec3 vNormal;
      #include <fog_pars_fragment>
      void main() {
        vec2 plane = abs(vNormal.x) > .5 ? vWorld.zy : vWorld.xy;
        vec2 p = mix(vWorld.xz, plane, uWall);
        vec2 grid = abs(fract(p + .5) - .5);
        float edge = max(grid.x, grid.y);
        float grout = smoothstep(.491 - fwidth(edge), .497, edge);
        float variation = .5 + .5 * sin(floor(p.x) * 2.7 + floor(p.y) * 4.2);
        vec3 pale = mix(vec3(.055,.36,.52), vec3(.09,.48,.61), variation * .45);
        pale = mix(pale, vec3(.065,.31,.45) + variation * vec3(.012,.025,.035), uCity);
        pale *= mix(1., .82, uWall);
        vec3 color = mix(pale, pale * .68, grout * .72);
        vec2 q = p * 2.5;
        float wave = sin(q.x + sin(q.y * .83 + uTime * .29))
          + cos(q.y + sin(q.x * .79 - uTime * .25));
        float caustic = pow(max(0., 1. - abs(wave) * .86), 12.);
        color += vec3(.13,.25,.25) * caustic * mix(.55,.28,uCity);
        color += uCity * (vec3(.015,.12,.16) * exp(-abs(vWorld.x + 7.5) * .7)
          + vec3(.09,.015,.06) * exp(-abs(vWorld.x - 7.5) * .7));
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
