import { type PerspectiveCamera, Vector3 } from "three";

export type PuckDirection = { x: number; y: number; angle: number };

const cameraPoint = new Vector3();
const projectedPoint = new Vector3();

export const projectPuckDirection = (
  position: Vector3,
  camera: PerspectiveCamera,
  width: number,
  height: number,
): PuckDirection | undefined => {
  cameraPoint.copy(position).applyMatrix4(camera.matrixWorldInverse);
  projectedPoint.copy(position).project(camera);
  if (
    cameraPoint.z < 0 &&
    projectedPoint.z >= -1 &&
    projectedPoint.z <= 1 &&
    Math.abs(projectedPoint.x) <= 1 &&
    Math.abs(projectedPoint.y) <= 1
  )
    return undefined;
  if (width <= 0 || height <= 0) return undefined;
  const dx =
    cameraPoint.x * (camera.projectionMatrix.elements.at(0) ?? 1) * width;
  const dy =
    -cameraPoint.y * (camera.projectionMatrix.elements.at(5) ?? 1) * height;
  const directionY = Math.abs(dx) + Math.abs(dy) < 0.001 ? 1 : dy;
  const angle = Math.atan2(directionY, dx);
  const horizontalRadius = Math.max(12, width / 2 - 46);
  const verticalRadius = Math.max(12, height / 2 - 82);
  const radius =
    1 /
    Math.sqrt(
      (Math.cos(angle) / horizontalRadius) ** 2 +
        (Math.sin(angle) / verticalRadius) ** 2,
    );
  return {
    x: width / 2 + Math.cos(angle) * radius,
    y: height / 2 + Math.sin(angle) * radius,
    angle,
  };
};
