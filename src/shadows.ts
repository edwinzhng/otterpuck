import { DataTexture, LinearFilter, RGBAFormat } from "three";

export const createShadowTexture = (): DataTexture => {
  const size = 64;
  const texture = new DataTexture(
    Uint8Array.from(
      Array.from({ length: size * size }, (_, index): number[] => {
        const x = (((index % size) + 0.5) / size) * 2 - 1,
          y = ((Math.floor(index / size) + 0.5) / size) * 2 - 1;
        const radius = Math.sqrt(x * x + y * y);
        const fade = Math.max(0, 1 - radius);
        return [255, 255, 255, Math.round(fade * fade * (3 - 2 * fade) * 255)];
      }).flat(),
    ),
    size,
    size,
    RGBAFormat,
  );
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
};
