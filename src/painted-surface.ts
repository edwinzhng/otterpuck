export const paintNoiseGLSL = `
float paintHash(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float paintNoise(vec3 p) {
  vec3 cell = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(
    mix(mix(paintHash(cell), paintHash(cell + vec3(1,0,0)), f.x),
        mix(paintHash(cell + vec3(0,1,0)), paintHash(cell + vec3(1,1,0)), f.x), f.y),
    mix(mix(paintHash(cell + vec3(0,0,1)), paintHash(cell + vec3(1,0,1)), f.x),
        mix(paintHash(cell + vec3(0,1,1)), paintHash(cell + vec3(1,1,1)), f.x), f.y), f.z);
}
`;
