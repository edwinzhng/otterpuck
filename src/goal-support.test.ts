import { expect, test } from "bun:test";
import {
  createSimulation,
  goalSurfaceHeight,
  puckFloorHeight,
  stepSimulation,
} from "./simulation";
import { freshControls, STEP } from "./types";

test("a descending puck rests on both goal troughs instead of underneath them", (): void => {
  for (const side of [-1, 1]) {
    for (const z of [12.12, 12.25, 12.4]) {
      const state = createSimulation("2-3-1", "2-3-1", "playground");
      state.puck.position.set(0, 0.65, z * side);
      state.puck.velocity.set(0, -0.5, 0);
      for (const frame of Array.from({ length: 240 })) {
        void frame;
        stepSimulation(state, freshControls(), STEP);
        expect(state.puck.position.y).toBeGreaterThanOrEqual(
          puckFloorHeight(state) - 0.00001,
        );
      }
      expect(state.puck.position.y).toBeCloseTo(puckFloorHeight(state), 4);
      expect(goalSurfaceHeight(0, z * side)).toBeGreaterThan(0);
    }
  }
  expect(goalSurfaceHeight(0, 0)).toBe(0);
  expect(goalSurfaceHeight(2, 12.3)).toBe(0);
});
