import { expect, test } from "bun:test";
import {
  Group,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  Vector3,
} from "three";
import { projectPlayerLabel } from "../src/positions";
import { updateShadows } from "../src/shadows";
import { createSimulation } from "../src/simulation";
import { CAMERA_OFFSET } from "../src/types";
import { updateWorldCamera } from "../src/world-camera";

test("camera interpolation preserves simulation positions and shared offsets", (): void => {
  const state = createSimulation();
  const human = state.players.at(0);
  if (!human) throw new Error("Missing human");
  human.previous.set(0, 1, 0);
  human.position.set(2, 1, 2);
  human.previousYaw = human.yaw = 0;
  human.previousBodyPitch = human.bodyPitch = 0;
  const position = human.position.clone();
  const offset = CAMERA_OFFSET.clone();
  const world = {
    camera: new PerspectiveCamera(77, 16 / 9, 0.045, 800),
    headLift: 0,
    puck: new Group(),
  };
  for (const alpha of [0, 0.5, 1]) {
    updateWorldCamera(world, state, 1 / 60, true, 0, alpha, false);
    const expected = new Vector3()
      .lerpVectors(human.previous, human.position, alpha)
      .add(offset);
    expect(world.camera.position.distanceTo(expected)).toBeLessThan(0.000001);
  }
  expect(human.position.equals(position)).toBe(true);
  expect(CAMERA_OFFSET.equals(offset)).toBe(true);
  updateWorldCamera(world, state, 1 / 60, false, 0, 1, false);
  expect(world.camera.position.toArray()).toEqual([10.3, 7.6, 15.7]);
});

test("shadow updates follow roster order and reset puck orientation across matches", (): void => {
  const state = createSimulation();
  const shadows = new InstancedMesh(undefined, undefined, 13);
  const matrix = new Matrix4();
  state.players.reverse();
  for (const [index, player] of state.players.entries()) {
    player.position.set(index * 0.5, 1, -index * 0.5);
    player.yaw = index * 0.3;
  }
  updateShadows(shadows, state);
  for (const [index, player] of state.players.entries()) {
    shadows.getMatrixAt(index, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);
    expect(position.x).toBeCloseTo(player.position.x);
    expect(position.z).toBeCloseTo(player.position.z);
  }
  const practice = createSimulation("3-3", "3-3", "practice");
  updateShadows(shadows, practice);
  expect(shadows.count).toBe(2);
  shadows.getMatrixAt(1, matrix);
  expect(matrix.elements.at(0)).toBeCloseTo(0.057);
  expect(matrix.elements.at(2)).toBe(0);
  shadows.geometry.dispose();
  shadows.dispose();
});

test("label projection supports reusable output without changing player coordinates", (): void => {
  const player = createSimulation().players.at(0);
  if (!player) throw new Error("Missing human");
  player.previous.set(0, 0, -3);
  player.position.set(0, 0, -5);
  const camera = new PerspectiveCamera(77, 16 / 9, 0.045, 800);
  camera.updateMatrixWorld();
  const target = new Vector3();
  const point = projectPlayerLabel(player, camera, 0.5, target);
  expect(point).toBe(target);
  expect(point?.x).toBeCloseTo(0);
  expect(player.position.toArray()).toEqual([0, 0, -5]);
  player.position.z = -40;
  expect(projectPlayerLabel(player, camera, 1, target)).toBeUndefined();
});
