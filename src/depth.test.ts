import { expect, test } from "bun:test";
import { atPlayingDepth, depthGuidance } from "./depth";
import { createSimulation, stepSimulation } from "./simulation";
import { FLOOR_HEIGHT, freshControls, STEP, SURFACE_HEIGHT } from "./types";

test("depth guidance shows Ctrl above the bottom and disappears when the swimmer settles", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  expect(atPlayingDepth(player)).toBe(true);
  expect(depthGuidance(player)).toBeUndefined();
  player.position.y = FLOOR_HEIGHT + 1;
  expect(depthGuidance(player)).toBeUndefined();
  player.position.y = FLOOR_HEIGHT + 0.9;
  expect(depthGuidance(player)).toEqual({
    title: "OFF THE BOTTOM",
    detail: "0.9 m above bottom",
    descend: true,
  });
  player.position.y = SURFACE_HEIGHT;
  player.mode = "recovering";
  expect(depthGuidance(player)).toBeUndefined();
  player.air = 5;
  expect(depthGuidance(player)?.descend).toBe(false);
  player.air = 100;
  for (const unused of Array.from({ length: 360 })) {
    void unused;
    stepSimulation(state, { ...freshControls(), vertical: -1 }, STEP);
  }
  expect(atPlayingDepth(player)).toBe(true);
  expect(depthGuidance(player)).toBeUndefined();
});

test("guidance stays hidden at the wall and blocks descent during forced air recovery", (): void => {
  const state = createSimulation();
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  expect(depthGuidance(player)).toBeUndefined();
  player.wallReady = false;
  player.emergency = true;
  player.mode = "ascending";
  expect(depthGuidance(player)?.descend).toBe(false);
  expect(depthGuidance(player)?.detail).toBe("Surfacing for air");
  player.position.y = SURFACE_HEIGHT;
  expect(depthGuidance(player)?.detail).toBe(
    "Catch your breath before diving again",
  );
  player.emergency = false;
  player.position.y = FLOOR_HEIGHT;
  player.mode = "diving";
  player.bodyPitch = -0.5;
  expect(depthGuidance(player)).toBeUndefined();
});
