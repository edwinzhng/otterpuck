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
    material.onBeforeCompile = (shader): void => {
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
outgoingLight *= mix(vec3(.76,.81,.87), vec3(1.0), softContour);
#include <opaque_fragment>`,
        );
    };
    material.customProgramCacheKey = (): string =>
      "otterpuck-soft-color-ramp-2";
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
