import { expect, test } from "bun:test";
import { followingAttack, safeAirReserve } from "./bots";
import {
  createSimulation,
  resetPracticePuck,
  stepSimulation,
  updateStick,
} from "./simulation";
import {
  attackDirection,
  directionYaw,
  FLOOR_HEIGHT,
  freshControls,
  PUCK_HEIGHT,
  STEP,
} from "./types";

for (const team of [0, 1] as const) {
  // A player flick cannot score from much closer than 1.2 m. Bots shoot
  // from about 1.6 m, so the nearest case starts there.
  for (const distance of [1.6, 2, 3.5]) {
    test(`team ${team} scores from ${distance}m`, (): void => {
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
  player.air = safeAirReserve(state, player);
  expect(followingAttack(state, player)).toBe(false);
  player.air = 50;
  state.time += 4;
  expect(followingAttack(state, player)).toBe(false);
});

// Too close to flick into the tray, a bot swims the loose puck in instead of
// turning back and forth for a shot it cannot make.
for (const [x, z] of [
  [0, 0.6],
  [0.6, 1],
]) {
  test(`a bot finishes a loose puck ${z}m in front of the goal`, (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    const bot = createSimulation().players.find(
      (player) => player.team === 0 && !player.human,
    );
    if (!bot) throw new Error("Missing bot");
    state.players = [bot];
    bot.position.set((x ?? 0) + 1.2, FLOOR_HEIGHT, -12.38 + (z ?? 0) + 1.5);
    bot.previous.copy(bot.position);
    bot.mode = "playing";
    bot.wallReady = false;
    bot.air = 80;
    bot.yaw = directionYaw(-1.2, -1.5);
    state.mode = "match";
    state.faceoff = undefined;
    state.puckChasers[0] = bot.id;
    state.puck.position.set(x ?? 0, PUCK_HEIGHT, -12.38 + (z ?? 0));
    state.puck.velocity.set(0, 0, 0);
    for (const frame of Array.from({ length: 360 })) {
      void frame;
      stepSimulation(state, freshControls(), STEP);
      if ((state.scores.at(0) ?? 0) > 0) break;
    }
    expect(state.scores.at(0) ?? 0).toBe(1);
  });
}
