import { expect, test } from "bun:test";
import { createSimulation, stepSimulation } from "../src/simulation";
import { freshControls, STEP } from "../src/types";

test("both curls stop swimming while retaining rotation", (): void => {
  for (const curl of [-1, 1] as const) {
    const state = createSimulation("2-3-1", "2-3-1", "playground");
    const player = state.players.at(0);
    if (!player) throw new Error("Missing player");
    player.velocity.set(1, 0, 2);
    const origin = player.position.clone();
    const yaw = player.yaw;
    const controls = {
      ...freshControls(),
      curl,
      forward: 1,
      lateral: 1,
      sprint: true,
    };
    for (const frame of Array.from({ length: 20 })) {
      void frame;
      stepSimulation(state, controls, STEP);
    }
    expect(player.position.x).toBeCloseTo(origin.x, 5);
    expect(player.position.z).toBeCloseTo(origin.z, 5);
    expect(player.yaw).not.toBeCloseTo(yaw, 2);
    expect(player.sprint).toBe(false);
  }
});
