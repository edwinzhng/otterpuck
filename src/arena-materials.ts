import type { MeshToonMaterial, Texture } from "three";

export const finishArenaMaterial = (
  material: MeshToonMaterial,
  wind: boolean,
  time: { value: number },
  rockTexture?: Texture,
): void => {
  const name = material.name;
  const kind = /Palm green|Sunlit foliage/.test(name)
    ? "leaf"
    : /Island stone/.test(name)
      ? "rock"
      : /Palm bark/.test(name)
        ? "bark"
        : /limestone|Canvas|ceramic/.test(name)
          ? "stone"
          : "plain";
  const color =
    kind === "leaf"
      ? `
    float mottling = paintNoise(vPaintPosition * 4.2) * .65 + paintNoise(vPaintPosition * 11.) * .35;
    diffuseColor.rgb *= mix(vec3(.80,.89,.79),vec3(1.13,1.07,.91),mottling);
  `
      : kind === "rock"
        ? `
    vec3 blend = pow(abs(normalize(vPaintNormal)), vec3(4.));
    blend /= max(.001, blend.x + blend.y + blend.z);
    vec3 painted = texture2D(uRockTexture, vPaintPosition.zy * .085).rgb * blend.x
      + texture2D(uRockTexture, vPaintPosition.xz * .085).rgb * blend.y
      + texture2D(uRockTexture, vPaintPosition.xy * .085).rgb * blend.z;
    float value = dot(painted, vec3(.2126,.7152,.0722));
    diffuseColor.rgb *= .58 + value * 1.5;
  `
        : kind === "bark"
          ? `
    float rings = .5 + .5 * sin(vPaintPosition.y * 18. + paintNoise(vPaintPosition * 3.) * 1.5);
    diffuseColor.rgb *= .89 + .19 * smoothstep(.16,.88,rings);
  `
          : kind === "stone"
            ? `
    float wash = paintNoise(vPaintPosition * 1.3) * .65 + paintNoise(vPaintPosition * 7.) * .35;
    diffuseColor.rgb *= .93 + wash * .1;
  `
            : "";
  material.onBeforeCompile = (shader): void => {
    shader.uniforms.uWindTime = time;
    if (rockTexture) shader.uniforms.uRockTexture = { value: rockTexture };
    shader.vertexShader =
      `varying vec3 vPaintPosition; varying vec3 vPaintNormal; uniform float uWindTime;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      ${
        wind
          ? `float breeze = sin(position.y * 1.2 + position.x * .4 + uWindTime * .7);
      transformed.x += breeze * .035 * clamp((position.y - 3.) * .35,0.,1.);
      transformed.z += sin(position.y + uWindTime * .55) * .018;`
          : ""
      }
      vPaintPosition = (modelMatrix * vec4(transformed,1.)).xyz;
      vPaintNormal = normalize(mat3(modelMatrix) * normal);`,
      );
    shader.fragmentShader =
      `varying vec3 vPaintPosition; varying vec3 vPaintNormal; uniform sampler2D uRockTexture;
      float paintHash(vec3 p) { p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
      float paintNoise(vec3 p) {
        vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(paintHash(i),paintHash(i+vec3(1,0,0)),f.x),mix(paintHash(i+vec3(0,1,0)),paintHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(paintHash(i+vec3(0,0,1)),paintHash(i+vec3(1,0,1)),f.x),mix(paintHash(i+vec3(0,1,1)),paintHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }\n${shader.fragmentShader}`
        .replace(
          "#include <gradientmap_pars_fragment>",
          `uniform sampler2D gradientMap;
        vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
          return texture2D(gradientMap, vec2(dot(normal,lightDirection)*.5+.5,.5)).rgb;
        }`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>\n${color}`,
        );
  };
  material.customProgramCacheKey = (): string =>
    `arena-soft-paint-3:${kind}:${wind}`;
};
