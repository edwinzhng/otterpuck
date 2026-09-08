import { expect, test } from "bun:test";
import { atPlayingDepth, depthGuidance } from "../src/depth";
import { createSimulation, stepSimulation } from "../src/simulation";
import {
  FLOOR_HEIGHT,
  freshControls,
  STEP,
  SURFACE_HEIGHT,
} from "../src/types";

test("depth guidance shows Ctrl above the bottom and disappears when the swimmer settles", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  expect(atPlayingDepth(player)).toBe(true);
  expect(depthGuidance(player)).toBeUndefined();
  player.position.y = FLOOR_HEIGHT + 1;
  expect(depthGuidance(player)).toEqual({
    title: "OFF THE BOTTOM",
    detail: "1.0 m above the bottom",
    descend: true,
  });
  player.position.y = SURFACE_HEIGHT;
  player.mode = "recovering";
  expect(depthGuidance(player)?.title).toBe("AT THE SURFACE");
  expect(depthGuidance(player)?.descend).toBe(true);
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

test("the guidance does not offer descent during a wall start or forced air recovery", (): void => {
  const state = createSimulation();
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  expect(depthGuidance(player)).toEqual({
    title: "AT THE WALL",
    detail: "Waiting for the strike",
    descend: false,
  });
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
  expect(depthGuidance(player)?.title).toBe("SETTLING ON THE BOTTOM");
  expect(depthGuidance(player)?.descend).toBe(false);
});
