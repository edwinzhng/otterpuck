import { expect, test } from "bun:test";
import { followingAttack, safeAirReserve } from "../src/bots";
import {
  createSimulation,
  resetPracticePuck,
  stepSimulation,
  updateStick,
} from "../src/simulation";
import {
  attackDirection,
  directionYaw,
  FLOOR_HEIGHT,
  freshControls,
  STEP,
} from "../src/types";

for (const team of [0, 1] as const) {
  for (const distance of [0.9, 2, 3.5]) {
    test(`team ${team} finishes a low goal shot from ${distance}m`, (): void => {
      const state = createSimulation("3-3", "3-3", "practice");
      const bot = createSimulation().players.find(
        (player) => player.team === team && !player.human,
      );
      if (!bot) throw new Error("Missing bot");
      state.players = [bot];
      bot.position.set(
        0,
        FLOOR_HEIGHT,
        attackDirection(team) * (12.5 - distance - 0.5),
      );
      bot.previous.copy(bot.position);
      bot.mode = "playing";
      bot.wallReady = false;
      bot.yaw = directionYaw(0, attackDirection(team));
      bot.previousYaw = bot.yaw;
      bot.air = 80;
      updateStick(bot, STEP);
      resetPracticePuck(state);
      state.mode = "match";
      state.puck.controlOwner = bot.id;
      state.puck.lastTouch = bot.id;
      state.puck.touchTime = state.time;
      state.puckChasers[team] = bot.id;
      for (const frame of Array.from({ length: 360 })) {
        void frame;
        stepSimulation(state, freshControls(), STEP);
        if ((state.scores.at(team) ?? 0) > 0) break;
      }
      expect(state.scores.at(team) ?? 0).toBe(1);
    });
  }
}

test("attack commitment keeps a recent shooter down but respects the air reserve", (): void => {
  const state = createSimulation();
  const player = state.players.at(1);
  if (!player) throw new Error("Missing bot");
  player.position.set(0, FLOOR_HEIGHT, 10);
  state.puck.position.copy(player.position);
  state.puck.lastTouch = player.id;
  state.puck.touchTime = state.time;
  player.air = 50;
  expect(followingAttack(state, player)).toBe(true);
  player.air = safeAirReserve(player);
  expect(followingAttack(state, player)).toBe(false);
  player.air = 50;
  state.time += 4;
  expect(followingAttack(state, player)).toBe(false);
});
