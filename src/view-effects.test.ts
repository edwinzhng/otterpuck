import { expect, test } from "bun:test";
import { createSimulation, stepSimulation } from "./simulation";
import {
  CAMERA_OFFSET,
  freshControls,
  POOL,
  STEP,
  SURFACE_HEIGHT,
} from "./types";
import {
  approachGlance,
  approachHeadLift,
  GLANCE_YAW,
  glanceYaw,
  headLiftTarget,
  speedLineIntensity,
} from "./view-effects";

test("head lift clears the waves at the surface without lifting the player collider", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Player missing");
  expect(headLiftTarget(player, true)).toBe(0);
  player.position.y = SURFACE_HEIGHT;
  const height = { lift: 0 };
  for (const unused of Array.from({ length: 120 })) {
    void unused;
    stepSimulation(state, { ...freshControls(), vertical: 1 }, STEP);
    height.lift = approachHeadLift(
      height.lift,
      headLiftTarget(player, true),
      STEP,
    );
  }
  expect(player.position.y).toBe(SURFACE_HEIGHT);
  expect(player.position.y + CAMERA_OFFSET.y + height.lift).toBeGreaterThan(
    POOL.depth + 0.2,
  );
  expect(headLiftTarget(player, false)).toBe(0);
  expect(approachHeadLift(height.lift, 0, 0.1)).toBeGreaterThan(0);
  expect(approachHeadLift(height.lift, 0, 0.6)).toBeLessThan(0.002);
  player.position.y -= 0.1;
  expect(headLiftTarget(player, true)).toBe(0);
});

test("the reduced sprint stays athletic and speed cues remain quiet below sprint pace", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Player missing");
  state.puck.position.set(5, 0.016, 0);
  for (const unused of Array.from({ length: 180 })) {
    void unused;
    stepSimulation(
      state,
      { ...freshControls(), forward: 1, sprint: true },
      STEP,
    );
  }
  expect(player.velocity.length()).toBeGreaterThan(2.8);
  expect(player.velocity.length()).toBeLessThanOrEqual(2.91);
  expect(speedLineIntensity(1.55)).toBe(0);
  expect(speedLineIntensity(2.9)).toBeCloseTo(0.5);
  expect(speedLineIntensity(8)).toBe(0.5);
});

test("a glance turns the head the way the key points, and no further", (): void => {
  expect(glanceYaw(0)).toBeCloseTo(0, 12);
  expect(glanceYaw(1)).toBeCloseTo(-GLANCE_YAW, 12);
  expect(glanceYaw(-1)).toBeCloseTo(GLANCE_YAW, 12);
  expect(glanceYaw(4)).toBe(glanceYaw(1));
  expect(GLANCE_YAW).toBeGreaterThan(Math.PI / 4);
  expect(GLANCE_YAW).toBeLessThanOrEqual(Math.PI / 2);
});

test("a glance swings out and settles back within a moment", (): void => {
  const turn = { yaw: 0 };
  for (const unused of Array.from({ length: 30 })) {
    void unused;
    turn.yaw = approachGlance(turn.yaw, glanceYaw(1), STEP);
  }
  expect(turn.yaw).toBeLessThan(glanceYaw(1) * 0.9);
  expect(turn.yaw).toBeGreaterThanOrEqual(glanceYaw(1));

  for (const unused of Array.from({ length: 60 })) {
    void unused;
    turn.yaw = approachGlance(turn.yaw, 0, STEP);
  }
  expect(Math.abs(turn.yaw)).toBeLessThan(0.01);
  expect(approachGlance(0.4, 0, 0)).toBe(0.4);
});
