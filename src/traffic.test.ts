import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { steerThroughTraffic } from "./bots";
import { bodySeparation, resolveBodies } from "./collisions";
import { canGrabPuck } from "./handling";
import { createSimulation, stepSimulation, updateStick } from "./simulation";
import { puckSeat } from "./stick";
import {
  directionYaw,
  FLOOR_HEIGHT,
  freshControls,
  PUCK_HEIGHT,
  STEP,
} from "./types";

test("side contacts never lift a grounded swimmer and intentional ascent remains free", (): void => {
  const state = createSimulation();
  const carrier = state.players.at(0),
    other = state.players.at(6);
  if (!carrier || !other) throw new Error("Missing swimmers");
  for (const height of [0, 0.025, 0.12, 0.3]) {
    carrier.position.set(0, FLOOR_HEIGHT, 0);
    carrier.mode = "playing";
    carrier.bodyPitch = 0;
    carrier.wallReady = false;
    other.position.set(-0.8, FLOOR_HEIGHT + height, 0);
    other.bodyPitch = -0.35;
    other.mode = "diving";
    const pair = [carrier, other];
    for (const unused of Array.from({ length: 90 })) {
      void unused;
      carrier.velocity.set(0, 0, -0.6);
      other.velocity.set(2, -0.1, -0.6);
      resolveBodies(pair, STEP, false);
      for (const player of pair) {
        player.position.addScaledVector(player.velocity, STEP);
        player.position.y = Math.max(FLOOR_HEIGHT, player.position.y);
      }
      resolveBodies(pair, STEP, true);
      expect(carrier.position.y).toBeCloseTo(FLOOR_HEIGHT, 7);
      expect(carrier.velocity.y).toBe(0);
    }
    expect(bodySeparation(carrier, other).length()).toBeGreaterThan(0.48);
  }
  const swimming = createSimulation("2-3-1", "2-3-1", "playground");
  const swimmer = swimming.players.at(0);
  if (!swimmer) throw new Error("Missing swimmer");
  for (const unused of Array.from({ length: 80 })) {
    void unused;
    stepSimulation(swimming, { ...freshControls(), vertical: 1 }, STEP);
  }
  expect(swimmer.position.y).toBeGreaterThan(FLOOR_HEIGHT + 0.3);
});

// A player collects the puck at the chest inside a crowd, then turns out of
// it and swims clear. A challenger, if given, faces the carrier with its
// blade on the puck's path at that frame.
const crowdEscape = (challenger?: {
  frame: number;
  point: Vector3;
  yaw: number;
}) => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const human = state.players.at(0);
  if (!human) throw new Error("Missing swimmer");
  state.puck.position
    .copy(human.position)
    .add(new Vector3(0.3, 0, -0.23))
    .setY(PUCK_HEIGHT);
  const opponents = createSimulation()
    .players.filter((p): boolean => p.team === 1)
    .slice(0, 4);
  const offsets = [
    new Vector3(-0.72, 0, -0.2),
    new Vector3(0.72, 0, 0.2),
    new Vector3(0, 0, -1.15),
  ];
  for (const [index, opponent] of opponents.entries()) {
    const offset = offsets.at(index);
    if (!offset && !challenger) break;
    opponent.mode = "playing";
    opponent.bodyPitch = 0;
    opponent.wallReady = false;
    if (offset) {
      opponent.position.copy(human.position).add(offset);
      opponent.yaw = directionYaw(offset.x, offset.z);
    } else if (challenger) {
      opponent.yaw = challenger.yaw;
      opponent.position.set(0, FLOOR_HEIGHT, 0);
      updateStick(opponent, STEP);
      opponent.position
        .add(challenger.point.clone().sub(opponent.stick))
        .setY(FLOOR_HEIGHT);
    }
    opponent.target.copy(opponent.position);
    opponent.previous.copy(opponent.position);
    updateStick(opponent, STEP);
    opponent.previousStick.copy(opponent.stick);
    state.players.push(opponent);
  }
  expect(canGrabPuck(state, human, 0.1)).toBe(true);
  stepSimulation(
    state,
    { ...freshControls(), pitch: 0.1, knockdown: true },
    STEP,
  );
  for (const unused of Array.from({ length: 6 })) {
    void unused;
    stepSimulation(state, { ...freshControls(), pitch: 0.1 }, STEP);
  }
  expect(state.puck.controlOwner).toBe(human.id);
  const origin = human.position.clone();
  const trace: { point: Vector3; yaw: number }[] = [];
  for (const frame of Array.from(
    { length: 200 },
    (_, index): number => index,
  )) {
    stepSimulation(
      state,
      { ...freshControls(), forward: 1, lateral: frame < 60 ? 1 : 0 },
      STEP,
    );
    trace.push({ point: state.puck.position.clone(), yaw: human.yaw });
    expect(human.position.y).toBeCloseTo(FLOOR_HEIGHT, 7);
  }
  return { state, human, origin, trace };
};

test("a player can collect at the chest in a crowd, steer out and swim clear with the puck", (): void => {
  const { state, human, origin } = crowdEscape();
  expect(human.position.distanceTo(origin)).toBeGreaterThan(1.6);
  expect(state.puck.controlOwner).toBe(human.id);
  expect(
    state.puck.position.distanceTo(puckSeat(human).setY(PUCK_HEIGHT)),
  ).toBeLessThan(0.05);
});

test("a real blade challenge can take the puck during a crowd escape", (): void => {
  const clear = crowdEscape().trace.at(150);
  if (!clear) throw new Error("Missing escape path");
  const { state, human } = crowdEscape({
    frame: 150,
    point: clear.point,
    yaw: clear.yaw + Math.PI,
  });
  // The challenger's blade contests the carried puck and breaks the carry.
  // The same escape without it keeps the puck.
  expect(state.puck.controlOwner).not.toBe(human.id);
});

test("traffic steering commits to an open side, shifts the held stick and avoids the wall", (): void => {
  const state = createSimulation();
  const bot = state.players.at(6),
    obstacle = state.players.at(0);
  if (!bot || !obstacle) throw new Error("Missing swimmers");
  state.players = [bot, obstacle];
  bot.position.set(6.8, FLOOR_HEIGHT, 0);
  bot.mode = "playing";
  bot.yaw = 0;
  obstacle.position.set(6.8, FLOOR_HEIGHT, -0.9);
  state.puck.controlOwner = bot.id;
  state.time = 1;
  const desired = new Vector3(0, 0, -1.5);
  steerThroughTraffic(state, bot, desired);
  expect(desired.x).toBeLessThan(-0.5);
  expect(desired.z).toBeLessThan(-0.5);
  expect(desired.length()).toBeCloseTo(1.5);
  expect(bot.dummy).toBe(-1);
  expect(bot.lateral).toBeLessThan(0);
  state.time += 0.2;
  obstacle.position.x -= 0.2;
  desired.set(0, 0, -1.5);
  steerThroughTraffic(state, bot, desired);
  expect(bot.evadeSide).toBe(-1);
});

test("bot strikes clear the centre without a timeout at every formation and difficulty", (): void => {
  for (const formation of ["3-3", "2-3-1", "1-3-2"] as const) {
    for (const difficulty of ["easy", "medium", "hard", "elite"] as const) {
      const state = createSimulation(
        formation,
        formation,
        "match",
        180,
        "right",
        { species: "otter", position: 5, difficulty },
      );
      const result = { firstTouch: Infinity, clear: Infinity, lateral: false };
      for (const unused of Array.from({ length: 1560 })) {
        void unused;
        stepSimulation(state, freshControls(), STEP);
        if (state.puck.lastTouch !== undefined)
          result.firstTouch = Math.min(result.firstTouch, state.time);
        if (Math.hypot(state.puck.position.x, state.puck.position.z) > 1)
          result.clear = Math.min(result.clear, state.time);
        if (
          state.players.some(
            (p): boolean => !p.human && Math.abs(p.lateral) > 0.1,
          )
        )
          result.lateral = true;
      }
      expect(result.firstTouch).toBeLessThan(10);
      expect(result.clear).toBeLessThan(13);
      expect(result.lateral).toBe(true);
      expect(state.contacts).toBeGreaterThan(0);
    }
  }
});
