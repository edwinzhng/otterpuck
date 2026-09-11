import { expect, test } from "bun:test";
import { canGrabPuck } from "../src/handling";
import { createSimulation, stepSimulation } from "../src/simulation";
import { freshControls, STEP } from "../src/types";

test("goal celebration allows looking while locking the puck until the restart", (): void => {
  const state = createSimulation();
  const player = state.players.at(0);
  if (!player) throw new Error("Missing player");
  state.restartTime = 3;
  state.scores = [1, 0];
  const puckPosition = state.puck.position.clone();
  const playerPosition = player.position.clone();
  const yaw = player.yaw;
  const seconds = state.seconds;
  const controls = freshControls();
  controls.yawDelta = 0.4;
  controls.pitch = 0.5;
  controls.forward = 1;
  controls.knockdown = true;
  controls.shot = 1;
  stepSimulation(state, controls, STEP);
  expect(player.yaw).toBeCloseTo(yaw + 0.52);
  expect(player.previousYaw).toBe(player.yaw);
  expect(controls.pitch).toBe(0.5);
  expect(player.position.equals(playerPosition)).toBe(true);
  expect(state.puck.position.equals(puckPosition)).toBe(true);
  expect(state.puck.controlOwner).toBeUndefined();
  expect(canGrabPuck(state, player, 0)).toBe(false);
  expect(state.scores).toEqual([1, 0]);
  expect(state.seconds).toBe(seconds);
  expect(controls.shot).toBe(0);
  expect(controls.knockdown).toBe(false);
  for (const _ of Array.from({ length: 370 }))
    stepSimulation(state, controls, STEP);
  expect(state.restartTime).toBe(0);
  expect(state.faceoff?.phase).toBe("ready");
  expect(state.scores).toEqual([1, 0]);
});
