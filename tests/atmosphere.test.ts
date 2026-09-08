import { expect, test } from "bun:test";
import { InstancedMesh, Scene, Vector3 } from "three";
import { addNightArchitecture } from "../src/atmosphere";
import { createBubbles, updateBubbles } from "../src/bubbles";
import { createSimulation } from "../src/simulation";
import { createWater } from "../src/water";

test("bubble trails appear immediately and stay within a fixed particle budget", (): void => {
  const field = createBubbles();
  const state = createSimulation("3-3", "3-3", "practice");
  updateBubbles(field, state.players, 0.25, 0.25);
  expect(field.bubbles.length).toBe(288);
  expect(
    field.bubbles.filter(
      (bubble): boolean => bubble.position.y > 0 && bubble.age > 0,
    ).length,
  ).toBeGreaterThan(200);
  for (const index of Array.from(
    { length: 300 },
    (_: unknown, index: number): number => index,
  ))
    updateBubbles(field, state.players, 1 / 60, index / 60);
  expect([...field.positions].every(Number.isFinite)).toBe(true);
  expect(
    [...field.opacity].some((opacity: number): boolean => opacity > 0.5),
  ).toBe(true);
  expect(field.points.frustumCulled).toBe(false);
});

test("surface geometry lies horizontally across the playing pool", (): void => {
  const water = createWater();
  water.mesh.geometry.computeBoundingBox();
  const box = water.mesh.geometry.boundingBox;
  if (!box) throw new Error("Water bounds missing");
  const size = box.getSize(new Vector3());
  expect(size.x).toBeCloseTo(15);
  expect(size.y).toBeLessThan(0.001);
  expect(size.z).toBeCloseTo(25);
  expect(water.reflection.width).toBe(256);
  water.reflection.dispose();
});

test("the surrounding skyline batches buildings and windows", (): void => {
  const scene = new Scene();
  addNightArchitecture(scene);
  const batches = scene.children.filter(
    (object): boolean => object instanceof InstancedMesh,
  );
  expect(batches.length).toBe(2);
  expect(scene.children.length).toBeLessThan(65);
});
