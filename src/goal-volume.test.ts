import { expect, test } from "bun:test";
import { createSimulation, puckInsideGoal } from "./simulation";

test("scoring requires the entire puck inside the tray, including upright shots", (): void => {
  const state = createSimulation();
  for (const side of [-1, 1]) {
    state.puck.orientation.identity();
    state.puck.position.set(0, 0.026, side * 12.385);
    expect(puckInsideGoal(state)).toBe(true);
    state.puck.position.z = side * 12.23;
    expect(puckInsideGoal(state)).toBe(false);
    state.puck.position.z = side * 12.385;
    state.puck.position.x = 1.48;
    expect(puckInsideGoal(state)).toBe(false);
    state.puck.position.set(0, 0.14, side * 12.385);
    expect(puckInsideGoal(state)).toBe(false);
    state.puck.orientation.setFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    state.puck.position.y = 0.06;
    expect(puckInsideGoal(state)).toBe(true);
    state.puck.position.y = 0.12;
    expect(puckInsideGoal(state)).toBe(false);
  }
});
