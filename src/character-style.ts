import {
  DataTexture,
  LinearFilter,
  type Material,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  type Object3D,
  RGBAFormat,
} from "three";
import { sampleCharacterRamp } from "./character-look";
import {
  characterSurfaceFragment,
  characterSurfaceVertex,
} from "./character-surface";
import type { CharacterSpecies } from "./characters";

const rampSize = 128;
const gradient = new DataTexture(
  Uint8Array.from(
    Array.from({ length: rampSize }, (_, index): number[] => [
      ...sampleCharacterRamp(index / (rampSize - 1)).map((channel): number =>
        Math.round(channel * 255),
      ),
      255,
    ]).flat(),
  ),
  rampSize,
  1,
  RGBAFormat,
);
gradient.minFilter = LinearFilter;
gradient.magFilter = LinearFilter;
gradient.needsUpdate = true;

export const applyCharacterStyle = (
  model: Object3D,
  look: "soft" | "standard" = "soft",
  species: CharacterSpecies = "otter",
): Material[] => {
  const converted = new Map<Material, Material>();
  const convert = (source: Material): Material => {
    const existing = converted.get(source);
    if (existing) return existing;
    if (
      look === "standard" ||
      !(source instanceof MeshStandardMaterial) ||
      source.userData.otterpuck_shading !== "soft-toon" ||
      /^(Eyes|Pupils|Nose)$/.test(source.name)
    )
      return source;
    const material = new MeshToonMaterial({
      color: source.color,
      vertexColors: source.vertexColors,
      map: source.map,
      gradientMap: gradient,
      emissive: 0x000000,
      emissiveIntensity: 0,
      side: source.side,
      transparent: source.transparent,
      opacity: source.opacity,
    });
    const coat = /^(Fur|Paw fur|Ear inner)$/.test(source.name);
    const satin = /^(Cap|Team|Team seam|Mitten|Beak|Ivory)$/.test(source.name);
    material.onBeforeCompile = (shader): void => {
      if (coat) {
        shader.vertexShader =
          `${characterSurfaceVertex}\n${shader.vertexShader}`.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvCoatPosition = position; vCoatNormal = normal;",
          );
        shader.fragmentShader =
          `${characterSurfaceFragment(species)}\n${shader.fragmentShader}`
            .replace(
              "#include <color_fragment>",
              `#include <color_fragment>
float detailFade = 1. - smoothstep(.001, .003, length(fwidth(vCoatPosition)));
float relief = coatRelief(vCoatPosition);
float wash = .5 + .5 * sin(vCoatPosition.y * 19. + sin(vCoatPosition.x * 23.));
diffuseColor.rgb *= .98 + wash * .04 + (relief - .5) * .07 * detailFade;`,
            )
            .replace(
              "#include <normal_fragment_maps>",
              `#include <normal_fragment_maps>
vec3 surfaceX = dFdx(-vViewPosition), surfaceY = dFdy(-vViewPosition);
vec3 crossX = cross(surfaceY, normal), crossY = cross(normal, surfaceX);
float determinant = dot(surfaceX, crossX);
vec3 reliefGradient = sign(determinant) * (dFdx(relief) * crossX + dFdy(relief) * crossY);
normal = normalize(max(abs(determinant), 1e-10) * normal - reliefGradient * .00008 * detailFade);`,
            );
      }
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <gradientmap_pars_fragment>",
          `uniform sampler2D gradientMap;
vec3 getGradientIrradiance(vec3 surfaceNormal, vec3 lightDirection) {
  float coordinate = dot(surfaceNormal, lightDirection) * 0.5 + 0.5;
  return texture2D(gradientMap, vec2(coordinate, 0.5)).rgb;
}`,
        )
        .replace(
          "#include <opaque_fragment>",
          `float softContour = smoothstep(0.0, 0.85, max(0.0, dot(normal, normalize(vViewPosition))));
outgoingLight *= mix(vec3(.84,.88,.94), vec3(1.0), softContour);
${coat ? "outgoingLight += diffuseColor.rgb * pow(1. - max(0., dot(normal, normalize(vViewPosition))), 3.) * .10;" : ""}
${
  satin
    ? `
#if NUM_DIR_LIGHTS > 0
vec3 sheenHalf = normalize(directionalLights[0].direction + normalize(vViewPosition));
outgoingLight += vec3(1.,.97,.90) * pow(max(0., dot(normal, sheenHalf)), 24.) * .14;
#endif
`
    : ""
}
#include <opaque_fragment>`,
        );
    };
    material.customProgramCacheKey = (): string =>
      `otterpuck-soft-surface-4:${coat ? species : "plain"}:${satin}`;
    material.name = source.name;
    material.userData = { ...source.userData };
    converted.set(source, material);
    return material;
  };
  model.traverse((object: Object3D): void => {
    if (!(object instanceof Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map(convert)
      : convert(object.material);
  });
  return [...converted.values()];
};

export const configureCharacterEquipment = (
  model: Object3D,
  hand: "right" | "left" = "right",
): void => {
  const side = hand === "right" ? "R" : "L";
  model.traverse((object): void => {
    const match = /^GripPaw([LR])(?:Mitten|Cuff)$/.exec(object.name);
    if (match) object.visible = match.at(1) === side;
  });
};
