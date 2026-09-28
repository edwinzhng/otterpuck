import {
  BackSide,
  type Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshToonMaterial,
  type Texture,
} from "three";
import { paintNoiseGLSL } from "./painted-surface";

export const createPanoramaMaterial = (
  map: Texture,
  air: Color,
  city: boolean,
): MeshBasicMaterial => {
  const material = new MeshBasicMaterial({
    map,
    side: BackSide,
    fog: false,
    depthWrite: false,
    toneMapped: false,
  });
  material.onBeforeCompile = (shader): void => {
    shader.uniforms.uHorizonAir = { value: air };
    shader.fragmentShader =
      `uniform vec3 uHorizonAir;\n${shader.fragmentShader}`.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float luminance = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
diffuseColor.rgb = mix(vec3(luminance), diffuseColor.rgb, ${city ? ".78" : ".91"});
diffuseColor.rgb = mix(diffuseColor.rgb, uHorizonAir, ${city ? ".13" : ".07"});`,
      );
  };
  material.customProgramCacheKey = (): string => `painted-panorama-1:${city}`;
  return material;
};

export const createCascadeMaterial = (
  source: MeshStandardMaterial,
  time: { value: number },
): MeshStandardMaterial => {
  const foam = /Waterfall (white ribbons|foam)/.test(source.name);
  const material = new MeshStandardMaterial({
    name: source.name,
    color: source.color,
    vertexColors: source.vertexColors,
    transparent: true,
    opacity: foam ? 0.85 : 0.88,
    roughness: foam ? 0.4 : 0.16,
    metalness: 0.05,
    side: DoubleSide,
    depthWrite: false,
    envMapIntensity: 0.8,
  });
  material.onBeforeCompile = (shader): void => {
    shader.uniforms.uCascadeTime = time;
    shader.vertexShader =
      `varying vec3 vCascade;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvCascade = (modelMatrix * vec4(transformed, 1.)).xyz;",
      );
    shader.fragmentShader =
      `uniform float uCascadeTime; varying vec3 vCascade;\n${shader.fragmentShader}`
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        float falling = vCascade.y * 1.7 + uCascadeTime * 6.;
        float streams = sin(vCascade.x * 31. + sin(vCascade.x * 7.) * 3. + sin(falling) * .16) * .5 + .5;
        float ripple = sin(falling + sin(vCascade.x * 4.) * .3) * .5 + .5;
        float foam = smoothstep(.82, .99, streams) * (.35 + .65 * ripple);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.86,.98,1.), foam * .42);
        diffuseColor.a *= .85 + .15 * ripple;
      `,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
        normal = normalize(normal + vec3(sin(vCascade.x * 16. + falling) * .09, cos(falling * 1.7) * .06, 0.));
      `,
        );
  };
  material.customProgramCacheKey = (): string => "cascade-flow-1";
  return material;
};

export const finishArenaMaterial = (
  material: MeshToonMaterial,
  wind: boolean,
  time: { value: number },
  air: Color,
  rockTexture?: Texture,
): void => {
  const name = material.name;
  const kind =
    /Palm green|Sunlit foliage|pine needles|Canopy .*green|Rock moss/.test(name)
      ? "leaf"
      : /City facade|City glazing/.test(name)
        ? "facade"
        : /Container|Station blue|Crane blue|Structural navy|Terrace metal|Rail steel/.test(
              name,
            )
          ? "painted-metal"
          : /Island stone/.test(name)
            ? "rock"
            : /bark|cedar|timber/i.test(name)
              ? "bark"
              : /snow/i.test(name)
                ? "snow"
                : /Glacier|Ice edge/i.test(name)
                  ? "ice"
                  : /stone|granite|plaster|ceramic|concrete|Mesa|Terracotta|sand/i.test(
                        name,
                      )
                    ? "stone"
                    : "plain";
  const color =
    kind === "leaf"
      ? `
    float mottling = paintNoise(vPaintPosition * .85) * .75 + paintNoise(vPaintPosition * 3.4) * .25;
    float tips = smoothstep(-.15, .85, normalize(vPaintNormal).y);
    diffuseColor.rgb *= mix(vec3(.70,.87,.90),vec3(1.19,1.12,.79),mottling * .60 + tips * .40);
  `
      : kind === "rock"
        ? `
    vec3 blend = pow(abs(normalize(vPaintNormal)), vec3(4.));
    blend /= max(.001, blend.x + blend.y + blend.z);
    vec3 painted = texture2D(uRockTexture, vPaintPosition.zy * .085).rgb * blend.x
      + texture2D(uRockTexture, vPaintPosition.xz * .085).rgb * blend.y
      + texture2D(uRockTexture, vPaintPosition.xy * .085).rgb * blend.z;
    float value = dot(painted, vec3(.2126,.7152,.0722));
    diffuseColor.rgb *= mix(vec3(.84,.88,1.04), vec3(1.13,1.06,.88), value);
  `
        : kind === "bark"
          ? `
    float rings = .5 + .5 * sin(vPaintPosition.y * 9. + paintNoise(vPaintPosition * .7) * 2.);
    diffuseColor.rgb *= mix(vec3(.88,.82,.91), vec3(1.12,1.05,.90), smoothstep(.12,.85,rings));
  `
          : kind === "snow"
            ? `
    float drift = paintNoise(vPaintPosition * .25);
    diffuseColor.rgb *= mix(vec3(.79,.85,1.),vec3(1.03,1.,.94),drift);
  `
            : kind === "ice"
              ? `
    float glacial = paintNoise(vPaintPosition * vec3(.22,.85,.22));
    diffuseColor.rgb *= mix(vec3(.72,.85,1.05),vec3(1.08,1.05,.98),glacial);
  `
              : kind === "facade"
                ? `
    vec3 facadeNormal = normalize(vPaintNormal);
    vec3 across = normalize(vec3(facadeNormal.z + .0001, 0., -facadeNormal.x));
    vec2 panel = vec2(dot(vPaintPosition, across) * .72, vPaintPosition.y * .86);
    vec2 inside = fract(panel);
    vec2 edge = smoothstep(vec2(.18,.20),vec2(.25,.28),inside)
      * (1. - smoothstep(vec2(.70,.71),vec2(.77,.79),inside));
    float lowerWindows = edge.x * edge.y * (1. - smoothstep(-10.,-7.,vPaintPosition.y));
    float lit = step(.45,paintHash(vec3(floor(panel),2.)));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.38,1.44,1.64),lowerWindows * lit * .65);
  `
                : kind === "painted-metal"
                  ? `
    float enamel = paintNoise(vPaintPosition * vec3(.7,2.2,.7));
    float upward = max(0., normalize(vPaintNormal).y);
    diffuseColor.rgb *= mix(vec3(.84,.87,1.),vec3(1.10,1.06,.93),enamel * .7 + upward * .3);
  `
                  : kind === "stone"
                    ? `
    float wash = paintNoise(vPaintPosition * vec3(.30,.60,.30)) * .8 + paintNoise(vPaintPosition * 2.2) * .2;
    diffuseColor.rgb *= mix(vec3(.84,.86,1.),vec3(1.11,1.05,.91),wash);
  `
                    : "";
  material.onBeforeCompile = (shader): void => {
    shader.uniforms.uWindTime = time;
    shader.uniforms.uSceneryAir = { value: air };
    if (rockTexture) shader.uniforms.uRockTexture = { value: rockTexture };
    shader.vertexShader =
      `varying vec3 vPaintPosition; varying vec3 vPaintNormal; uniform float uWindTime;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      ${
        wind
          ? `float height = clamp((position.y - 2.8) * .24, 0., 1.);
      float breeze = sin(position.x * .38 + position.z * .27 + uWindTime * .85);
      float flutter = sin(position.y * 2.4 + position.z * 1.8 - uWindTime * 1.4);
      transformed.x += (breeze * .11 + flutter * .018) * height;
      transformed.z += sin(position.y * .7 + uWindTime * .62) * .045 * height;`
          : ""
      }
      vPaintPosition = (modelMatrix * vec4(position,1.)).xyz;
      vPaintNormal = normalize(mat3(modelMatrix) * normal);`,
      );
    shader.fragmentShader =
      `varying vec3 vPaintPosition; varying vec3 vPaintNormal; uniform sampler2D uRockTexture; uniform vec3 uSceneryAir;
      ${paintNoiseGLSL}\n${shader.fragmentShader}`
        .replace(
          "#include <gradientmap_pars_fragment>",
          `uniform sampler2D gradientMap;
        vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
          return texture2D(gradientMap, vec2(dot(normal,lightDirection)*.5+.5,.5)).rgb;
        }`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
${color}
float paper = paintNoise(vPaintPosition * vec3(2.8, 7., 2.8));
float pigment = paintNoise(vPaintPosition * .20);
diffuseColor.rgb *= .965 + paper * .025 + pigment * .045;`,
        )
        .replace(
          "#include <opaque_fragment>",
          `float facing = max(0., dot(normal, normalize(vViewPosition)));
outgoingLight *= mix(vec3(.80,.85,.98),vec3(1.),smoothstep(.03,.55,facing));
${kind === "painted-metal" ? "outgoingLight = mix(outgoingLight, max(outgoingLight, diffuseColor.rgb * vec3(.62,.72,.94)), .36);" : ""}
float distant = smoothstep(48.,160.,length(vPaintPosition.xz));
outgoingLight = mix(outgoingLight, uSceneryAir, distant * .20);
#include <opaque_fragment>`,
        );
  };
  material.customProgramCacheKey = (): string =>
    `arena-painted-surface-8:${kind}:${wind}`;
};
