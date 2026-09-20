import { expect, test } from "bun:test";
import { Vector3 } from "three";
import {
  nearOwnGoal,
  protectGoalApproach,
  safeGoalTurn,
} from "./bot-goal-safety";
import {
  createSimulation,
  requestShot,
  resetPracticePuck,
  stepSimulation,
  updateStick,
} from "./simulation";
import {
  attackDirection,
  clamp,
  directionYaw,
  FLOOR_HEIGHT,
  forwardVector,
  freshControls,
  STEP,
} from "./types";

const setup = (team: 0 | 1): ReturnType<typeof createSimulation> => {
  const state = createSimulation("3-3", "3-3", "practice");
  const bot = createSimulation().players.find(
    (p) => p.team === team && !p.human,
  );
  if (!bot) throw new Error("Missing bot");
  state.players = [bot];
  state.mode = "match";
  const dir = attackDirection(team);
  bot.position.set(0, FLOOR_HEIGHT, -dir * 11.8);
  bot.previous.copy(bot.position);
  bot.mode = "playing";
  bot.wallReady = false;
  bot.yaw = directionYaw(0, dir);
  bot.previousYaw = bot.yaw;
  bot.bodyPitch = 0;
  bot.target.copy(bot.position);
  bot.air = 100;
  updateStick(bot, STEP);
  resetPracticePuck(state);
  state.puckChasers[team] = bot.id;
  return state;
};
test("bots near either home goal turn only through the outward half-plane", (): void => {
  for (const team of [0, 1] as const)
    for (const side of [-1, 1]) {
      const state = setup(team);
      const bot = state.players.at(0);
      if (!bot) throw new Error("Missing bot");
      const dir = attackDirection(team);
      const away = directionYaw(0, dir);
      bot.yaw = away + side * 1.35;
      for (const unused of Array.from({ length: 180 })) {
        void unused;
        const desired = new Vector3(-side, 0, -dir);
        bot.yaw += clamp(
          safeGoalTurn(bot, desired, away - side * 2.5),
          -0.04,
          0.04,
        );
        expect(forwardVector(bot.yaw).z * dir).toBeGreaterThanOrEqual(0);
        expect(desired.z * dir).toBeGreaterThanOrEqual(0);
      }
    }
});
test("dangerous shots are rejected but forward clearances remain available", (): void => {
  for (const team of [0, 1] as const) {
    const state = setup(team);
    const bot = state.players.at(0);
    if (!bot) throw new Error("Missing bot");
    const dir = attackDirection(team);
    expect(nearOwnGoal(bot)).toBe(true);
    expect(requestShot(bot, 0.8, new Vector3(0, 0, -dir))).toBe(false);
    expect(requestShot(bot, 0.8, new Vector3(0, 0, dir))).toBe(true);
  }
});
test("a puck behind the defender gets a wide goal-side approach", (): void => {
  for (const team of [0, 1] as const) {
    const state = setup(team);
    const bot = state.players.at(0);
    if (!bot) throw new Error("Missing bot");
    const dir = attackDirection(team);
    state.puck.position.z = bot.position.z - dir * 0.3;
    protectGoalApproach(state, bot);
    expect(Math.abs(bot.target.x)).toBe(2.2);
    expect(bot.target.z).toBe(bot.position.z);
  }
});
test("a carrier near either home goal clears forward without scoring on itself", (): void => {
  for (const team of [0, 1] as const) {
    const state = setup(team);
    const bot = state.players.at(0);
    if (!bot) throw new Error("Missing bot");
    const dir = attackDirection(team);
    state.puck.controlOwner = bot.id;
    state.puck.controlKind = "carry";
    const start = bot.position.z;
    for (const unused of Array.from({ length: 480 })) {
      void unused;
      stepSimulation(state, freshControls(), STEP);
      expect(state.scores).toEqual([0, 0]);
      if (nearOwnGoal(bot))
        expect(forwardVector(bot.yaw).z * dir).toBeGreaterThanOrEqual(-0.00001);
    }
    expect((bot.position.z - start) * dir).toBeGreaterThan(1);
  }
});

test("a defender retrieves a puck nearer its own goal without pushing it into the trough", (): void => {
  for (const team of [0, 1] as const) {
    const state = setup(team);
    const bot = state.players.at(0);
    if (!bot) throw new Error("Missing bot");
    const direction = attackDirection(team);
    bot.position.z = -direction * 11.3;
    state.puck.position.set(0, 0.018, -direction * 12);
    state.puck.previous.copy(state.puck.position);
    for (const unused of Array.from({ length: 1440 })) {
      void unused;
      stepSimulation(state, freshControls(), STEP);
      expect(state.scores).toEqual([0, 0]);
    }
    expect(state.puck.lastTouch).toBe(bot.id);
    expect(state.puck.position.z * direction).toBeGreaterThan(-11.5);
  }
});
