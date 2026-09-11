import { expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";
import { projectPuckDirection } from "../src/puck-indicator";

const camera = new PerspectiveCamera(70, 16 / 9, 0.05, 100);
camera.updateMatrixWorld();

test("puck indicator hides in view and points correctly beyond each screen edge", (): void => {
  expect(
    projectPuckDirection(new Vector3(0, 0, -5), camera, 1280, 720),
  ).toBeUndefined();
  for (const [x, y] of [
    [20, 0],
    [-20, 0],
    [0, 20],
    [0, -20],
  ]) {
    const point = projectPuckDirection(
      new Vector3(x, y, -2),
      camera,
      1280,
      720,
    );
    expect(point).toBeDefined();
    if (!point) throw new Error("Missing direction");
    expect(point.x).toBeGreaterThan(24);
    expect(point.x).toBeLessThan(1256);
    expect(point.y).toBeGreaterThan(24);
    expect(point.y).toBeLessThan(696);
    if (x) expect(Math.sign(point.x - 640)).toBe(Math.sign(x));
    if (y) expect(Math.sign(point.y - 360)).toBe(-Math.sign(y));
  }
});

test("behind-camera pucks do not mirror left and right and directly behind remains finite", (): void => {
  expect(
    projectPuckDirection(new Vector3(2, 0, 5), camera, 1280, 720)?.x,
  ).toBeGreaterThan(640);
  expect(
    projectPuckDirection(new Vector3(-2, 0, 5), camera, 1280, 720)?.x,
  ).toBeLessThan(640);
  const behind = projectPuckDirection(new Vector3(0, 0, 5), camera, 390, 844);
  expect(behind?.y).toBeGreaterThan(422);
  expect(Number.isFinite(behind?.angle)).toBe(true);
});
