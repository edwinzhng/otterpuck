import {
  DataTexture,
  type InstancedMesh,
  LinearFilter,
  Matrix4,
  Quaternion,
  RGBAFormat,
  Vector3,
} from "three";
import type { Simulation } from "./types";

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

const matrix = new Matrix4();
const quaternion = new Quaternion();
const shadowScale = new Vector3();
const position = new Vector3();
const axisY = new Vector3(0, 1, 0);

export const updateShadows = (
  shadows: InstancedMesh,
  state: Simulation,
): void => {
  for (const [index, player] of state.players.entries()) {
    shadowScale
      .set(0.26, 0.002, 0.7)
      .multiplyScalar(1 + player.position.y * 0.08);
    quaternion.setFromAxisAngle(axisY, player.yaw);
    matrix.compose(
      position.set(player.position.x, 0.007, player.position.z),
      quaternion,
      shadowScale,
    );
    shadows.setMatrixAt(index, matrix);
  }
  matrix.compose(
    position.set(state.puck.position.x, 0.007, state.puck.position.z),
    quaternion.identity(),
    shadowScale.set(0.057, 0.002, 0.057),
  );
  shadows.setMatrixAt(state.players.length, matrix);
  shadows.count = state.players.length + 1;
  shadows.instanceMatrix.needsUpdate = true;
};
