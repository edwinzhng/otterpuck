import type { PerspectiveCamera } from "three";
import { clamp, POOL } from "./types";

export const confineCameraToPool = (camera: PerspectiveCamera): void => {
  const halfHeight =
    (camera.near * Math.tan((camera.fov * Math.PI) / 360)) / camera.zoom;
  const clearance = Math.max(
    0.08,
    Math.hypot(camera.near, halfHeight, halfHeight * camera.aspect) + 0.02,
  );
  const halfWidth = Math.max(0, POOL.width / 2 - clearance);
  const halfLength = Math.max(0, POOL.length / 2 - clearance);
  camera.position.x = clamp(camera.position.x, -halfWidth, halfWidth);
  camera.position.z = clamp(camera.position.z, -halfLength, halfLength);
};
