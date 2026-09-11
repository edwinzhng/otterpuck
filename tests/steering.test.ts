import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { botProfiles } from "../src/bots";
import {
  createSimulation,
  stepSimulation,
  updateStick,
} from "../src/simulation";
import {
  angleDifference,
  FLOOR_HEIGHT,
  forwardVector,
  freshControls,
  STEP,
} from "../src/types";

test("player propulsion follows the body through left/right swimming, sprinting and swerves", (): void => {
  for (const direction of [-1, 1])
    for (const sprint of [false, true])
      for (const dummy of [0, direction]) {
        const state = createSimulation("2-3-1", "2-3-1", "playground");
        const player = state.players.at(0);
        if (!player) throw new Error("Player missing");
        const origin = player.position.clone();
        for (const frame of Array.from(
          { length: 120 },
          (_, index): number => index,
        )) {
          const previousYaw = player.yaw;
          stepSimulation(
            state,
            {
              ...freshControls(),
              forward: sprint ? 1 : 0,
              lateral: direction,
              sprint,
              dummy,
            },
            STEP,
          );
          const turn = angleDifference(player.yaw, previousYaw);
          expect(turn * direction).toBeLessThan(0);
          expect(Math.abs(turn)).toBeLessThanOrEqual(1.91 * 1.3 * STEP);
          const right = new Vector3(
            Math.cos(player.yaw),
            0,
            -Math.sin(player.yaw),
          );
          expect(Math.abs(player.velocity.dot(right))).toBeLessThan(0.000001);
          expect(
            player.velocity.dot(forwardVector(player.yaw)),
          ).toBeGreaterThan(0);
          if (frame === 0)
            expect(Math.abs(player.velocity.x)).toBeLessThan(0.005);
        }
        expect((player.position.x - origin.x) * direction).toBeGreaterThan(0.7);
      }
});

test("bots turn toward travel rather than watching a different target while sliding into position", (): void => {
  for (const difficulty of ["easy", "medium", "hard", "elite"] as const) {
    const state = createSimulation("2-3-1", "2-3-1", "match", 180, "right", {
      species: "otter",
      position: 0,
      difficulty,
    });
    const bot = state.players.at(6);
    if (!bot) throw new Error("Bot missing");
    state.players = [bot];
    state.faceoff = undefined;
    state.decisionTime = 10;
    state.puck.position.set(-6, 0.018, 8);
    bot.position.set(0, FLOOR_HEIGHT, 0);
    bot.previous.copy(bot.position);
    bot.target.set(3, FLOOR_HEIGHT, 0);
    bot.formationTarget.copy(bot.target);
    bot.yaw = 0;
    bot.aimYaw = 0;
    bot.mode = "playing";
    bot.wallReady = false;
    bot.bodyPitch = 0;
    updateStick(bot, STEP);
    for (const frame of Array.from(
      { length: 600 },
      (_, index): number => index,
    )) {
      const previousYaw = bot.yaw;
      stepSimulation(state, freshControls(), STEP);
      const right = new Vector3(Math.cos(bot.yaw), 0, -Math.sin(bot.yaw));
      expect(Math.abs(bot.velocity.dot(right))).toBeLessThan(0.000001);
      expect(
        Math.abs(angleDifference(bot.yaw, previousYaw)),
      ).toBeLessThanOrEqual(
        botProfiles[difficulty].turnSpeed * 1.2 * STEP + 0.000001,
      );
      if (frame < 10) expect(bot.position.x).toBeLessThan(0.01);
      if (frame === 150) expect(bot.position.x).toBeGreaterThan(0.6);
    }
    expect(bot.position.distanceTo(bot.target)).toBeLessThan(0.15);
  }
});

test("a bot physically turns into its traffic detour before moving sideways", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "match");
  const bot = state.players.at(6),
    obstacle = state.players.at(0);
  if (!bot || !obstacle) throw new Error("Players missing");
  state.players = [obstacle, bot];
  state.faceoff = undefined;
  state.decisionTime = 10;
  bot.position.set(0, FLOOR_HEIGHT, 0);
  obstacle.position.set(0, FLOOR_HEIGHT, -1.1);
  for (const player of state.players) {
    player.previous.copy(player.position);
    player.mode = "playing";
    player.wallReady = false;
    player.bodyPitch = 0;
    player.yaw = 0;
    updateStick(player, STEP);
  }
  bot.target.set(0, FLOOR_HEIGHT, -4);
  for (const unused of Array.from({ length: 40 })) {
    void unused;
    stepSimulation(state, freshControls(), STEP);
    expect(
      Math.abs(
        bot.velocity.x * Math.cos(bot.yaw) - bot.velocity.z * Math.sin(bot.yaw),
      ),
    ).toBeLessThan(0.000001);
  }
  expect(Math.abs(bot.yaw)).toBeGreaterThan(0.5);
  expect(Math.abs(bot.position.x)).toBeGreaterThan(0.03);
});
