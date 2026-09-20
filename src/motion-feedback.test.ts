import { expect, test } from "bun:test";
import { createSimulation, stepSimulation } from "./simulation";
import { puckSeat } from "./stick";
import { freshControls, STEP } from "./types";

test("curl and dummy frames retain the preceding orientation for camera interpolation", (): void => {
  for (const action of [{ curl: 1 }, { dummy: 1, lateral: 1 }]) {
    const state = createSimulation("2-3-1", "2-3-1", "playground");
    const player = state.players.at(0);
    if (!player) throw new Error("Missing player");
    for (const frame of Array.from({ length: 100 })) {
      void frame;
      const yaw = player.yaw;
      const pitch = player.bodyPitch;
      stepSimulation(state, { ...freshControls(), ...action }, STEP);
      expect(player.previousYaw).toBe(yaw);
      expect(player.previousBodyPitch).toBe(pitch);
      expect(Math.abs(player.yaw - yaw)).toBeLessThan(0.03);
    }
  }
});

test("a dummy exit gives a finite sprint burst and braking overrides it", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Missing player");
  state.puck.position.copy(puckSeat(player));
  for (const frame of Array.from({ length: 50 })) {
    void frame;
    stepSimulation(state, { ...freshControls(), dummy: 1, lateral: 1 }, STEP);
  }
  expect(player.dummyBurstUntil).toBeGreaterThan(state.time);
  expect(player.sprint).toBe(true);
  stepSimulation(state, { ...freshControls(), forward: -1 }, STEP);
  expect(player.sprint).toBe(false);
  for (const frame of Array.from({ length: 300 })) {
    void frame;
    stepSimulation(state, { ...freshControls(), forward: 1 }, STEP);
  }
  expect(player.sprint).toBe(false);
});
