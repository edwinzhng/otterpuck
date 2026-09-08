import { expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";
import { confineCameraToPool } from "../src/camera-bounds";
import { POOL, SURFACE_HEIGHT } from "../src/types";

const expectNearPlaneInsidePool = (camera: PerspectiveCamera): void => {
  camera.updateMatrixWorld(true);
  for (const x of [-1, 1])
    for (const y of [-1, 1]) {
      const corner = new Vector3(x, y, -1).unproject(camera);
      expect(Math.abs(corner.x)).toBeLessThan(POOL.width / 2);
      expect(Math.abs(corner.z)).toBeLessThan(POOL.length / 2);
    }
};

test("camera and near-plane corners stay inside every wall through turns and wide sprint views", (): void => {
  for (const fov of [56, 77, 81])
    for (const aspect of [0.6, 16 / 9, 32 / 9]) {
      const camera = new PerspectiveCamera(fov, aspect, 0.045, 800);
      camera.rotation.order = "YXZ";
      for (const x of [-8.5, 0, 8.5])
        for (const z of [-13.5, 0, 13.5]) {
          camera.position.set(x, 0.39, z);
          confineCameraToPool(camera);
          const position = camera.position.clone();
          expect(Math.abs(position.x)).toBeLessThan(POOL.width / 2);
          expect(Math.abs(position.z)).toBeLessThan(POOL.length / 2);
          for (const yaw of [0, 0.4, Math.PI / 2, Math.PI, Math.PI * 1.5])
            for (const pitch of [-Math.PI / 2, -0.5, 0, Math.PI / 2]) {
              camera.rotation.set(pitch, yaw, 0.35);
              const orientation = camera.quaternion.clone();
              confineCameraToPool(camera);
              expect(camera.position.equals(position)).toBe(true);
              expect(camera.quaternion.equals(orientation)).toBe(true);
              expectNearPlaneInsidePool(camera);
            }
        }
    }
});

test("wall confinement preserves normal camera placement and surface head lift", (): void => {
  const camera = new PerspectiveCamera(77, 16 / 9, 0.045, 800);
  camera.position.set(7.18, 0.39, 12.1);
  const normalPosition = camera.position.clone();
  confineCameraToPool(camera);
  expect(camera.position.equals(normalPosition)).toBe(true);
  camera.position.set(8, SURFACE_HEIGHT + 0.03 + 0.36, 13);
  const liftedHeight = camera.position.y;
  confineCameraToPool(camera);
  expect(camera.position.y).toBe(liftedHeight);
  expect(camera.position.y).toBeGreaterThan(POOL.depth + 0.2);
  expectNearPlaneInsidePool(camera);
});

test("a side view at each corner remains in the pool and can still aim at the puck", (): void => {
  const camera = new PerspectiveCamera(56, 16 / 9, 0.045, 800);
  for (const sideX of [-1, 1])
    for (const sideZ of [-1, 1]) {
      const puck = new Vector3(sideX * 7.3, 0.018, sideZ * 12.3);
      camera.position
        .copy(puck)
        .add(new Vector3(sideX * 1.3, 0.65, sideZ * 0.4));
      confineCameraToPool(camera);
      camera.lookAt(puck);
      expectNearPlaneInsidePool(camera);
      const projectedPuck = puck.clone().project(camera);
      expect(projectedPuck.x).toBeCloseTo(0, 6);
      expect(projectedPuck.y).toBeCloseTo(0, 6);
      expect(projectedPuck.z).toBeGreaterThan(-1);
      expect(projectedPuck.z).toBeLessThan(1);
    }
});
