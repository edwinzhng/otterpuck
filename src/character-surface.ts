import type { CharacterSpecies } from "./characters";
import { paintNoiseGLSL } from "./painted-surface";

export const characterSurface = (species: CharacterSpecies): string => {
  if (species === "dolphin") return "return .5;";
  if (species === "crocodile")
    return `
  vec3 weights = pow(abs(normalize(vCoatNormal)), vec3(4.));
  weights /= max(.001, weights.x + weights.y + weights.z);
  return coatScale(p.yz) * weights.x + coatScale(p.xz) * weights.y + coatScale(p.xy) * weights.z;`;
  if (species === "walrus")
    return `
  float folds = sin(p.y * 175. + sin(p.x * 36.) * 1.4);
  return .5 + .18 * folds + .12 * sin(dot(p, vec3(510., 340., 410.)));`;
  return `
  vec3 grain = p * vec3(240., 105., 240.);
  return mix(paintNoise(grain), paintNoise(grain * 1.87 + 17.), .3);`;
};

// Rest-space coordinates keep surface detail attached to the animated skin.
export const characterSurfaceVertex = `
varying vec3 vCoatPosition;
varying vec3 vCoatNormal;
`;

export const characterSurfaceFragment = (species: CharacterSpecies): string => `
varying vec3 vCoatPosition;
varying vec3 vCoatNormal;
${paintNoiseGLSL}
float coatScale(vec2 p) {
  vec2 tile = p * 100.;
  tile.x += mod(floor(tile.y), 2.) * .5;
  vec2 cell = abs(fract(tile) - .5);
  float edge = pow(pow(cell.x, 4.) + pow(cell.y, 4.), .25);
  return 1. - smoothstep(.30, .47, edge);
}
float coatRelief(vec3 p) { ${characterSurface(species)} }
`;
