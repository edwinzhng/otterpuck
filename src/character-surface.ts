import type { CharacterSpecies } from "./characters";

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
  vec3 grain = p * vec3(380., 170., 380.);
  return mix(coatNoise(grain), coatNoise(grain * 1.87 + 17.), .3);`;
};

// Rest-space coordinates keep surface detail attached to the animated skin.
export const characterSurfaceVertex = `
varying vec3 vCoatPosition;
varying vec3 vCoatNormal;
`;

export const characterSurfaceFragment = (species: CharacterSpecies): string => `
varying vec3 vCoatPosition;
varying vec3 vCoatNormal;
float coatHash(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float coatNoise(vec3 p) {
  vec3 cell = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(
    mix(mix(coatHash(cell), coatHash(cell + vec3(1,0,0)), f.x),
        mix(coatHash(cell + vec3(0,1,0)), coatHash(cell + vec3(1,1,0)), f.x), f.y),
    mix(mix(coatHash(cell + vec3(0,0,1)), coatHash(cell + vec3(1,0,1)), f.x),
        mix(coatHash(cell + vec3(0,1,1)), coatHash(cell + vec3(1,1,1)), f.x), f.y), f.z);
}
float coatScale(vec2 p) {
  vec2 tile = p * 100.;
  tile.x += mod(floor(tile.y), 2.) * .5;
  vec2 cell = abs(fract(tile) - .5);
  float edge = pow(pow(cell.x, 4.) + pow(cell.y, 4.), .25);
  return 1. - smoothstep(.30, .47, edge);
}
float coatRelief(vec3 p) { ${characterSurface(species)} }
`;
