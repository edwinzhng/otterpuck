import { expect, test } from "bun:test";
import { createSimulation, stepSimulation, updateStick } from "./simulation";
import { FLOOR_HEIGHT, freshControls, PUCK_HEIGHT, STEP } from "./types";

const setup = () => {
  const state = createSimulation("2-3-1", "2-3-1", "match");
  state.faceoff = undefined;
  state.restartTime = 0;
  state.decisionTime = 10;
  const bot = state.players.at(1);
  if (!bot) throw new Error("Missing bot");
  for (const player of state.players) {
    player.position.set(player.id - 6, FLOOR_HEIGHT, 8);
    player.target.copy(player.position);
    player.wallReady = false;
    player.mode = "playing";
    player.bodyPitch = 0;
    player.velocity.set(0, 0, 0);
  }
  bot.position.set(0, FLOOR_HEIGHT, 0);
  bot.target.set(0, FLOOR_HEIGHT, -0.5);
  bot.yaw = 0;
  state.puck.position.set(0, PUCK_HEIGHT, 0);
  state.puck.velocity.set(0, 0, 0);
  state.puckChasers[0] = bot.id;
  updateStick(bot, STEP);
  return { state, bot };
};

test("bot retrieves a loose puck directly beneath its chest", (): void => {
  const { state, bot } = setup();
  for (const frame of Array.from({ length: 28 })) {
    void frame;
    stepSimulation(state, freshControls(), STEP);
  }
  expect(state.puck.lastTouch).toBe(bot.id);
  expect(state.puck.controlOwner).toBe(bot.id);
});

test("nearby puck chaser turns promptly toward a puck behind it", (): void => {
  const { state, bot } = setup();
  state.puck.position.z = 1;
  bot.target.z = 1;
  stepSimulation(state, freshControls(), STEP);
  expect(Math.abs(bot.yaw)).toBeGreaterThan(4 * STEP);
});

test("non-chaser leaves the under-chest puck for its teammate", (): void => {
  const { state, bot } = setup();
  state.puckChasers[0] = 2;
  stepSimulation(state, freshControls(), STEP);
  expect(bot.grab).toBeUndefined();
  expect(state.puck.controlOwner).not.toBe(bot.id);
});
