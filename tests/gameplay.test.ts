import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { bodySeparation, resolveBodies } from "../src/collisions";
import {
  createSimulation,
  stepSimulation,
  updateStick,
} from "../src/simulation";
import { bladePoint, puckSeat } from "../src/stick";
import {
  type Controls,
  freshControls,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
} from "../src/types";

const advance = (
  state: Simulation,
  seconds: number,
  controls: Controls = freshControls(),
): void => {
  for (const unused of Array.from({ length: Math.ceil(seconds / STEP) })) {
    void unused;
    stepSimulation(state, controls, STEP);
  }
};

test("every swimmer waits at their own wall until the strike signal", (): void => {
  const state = createSimulation();
  const positions = state.players.map(
    (player): Vector3 => player.position.clone(),
  );
  advance(state, 2.5, {
    ...freshControls(),
    forward: 1,
    sprint: true,
    dive: true,
  });
  expect(state.faceoff?.phase).toBe("ready");
  expect(state.seconds).toBe(180);
  for (const [index, player] of state.players.entries()) {
    expect(Math.abs(player.position.z)).toBe(12);
    expect(
      player.position.distanceTo(positions.at(index) ?? new Vector3()),
    ).toBe(0);
    expect(player.wallReady).toBe(true);
    expect(player.air).toBe(100);
  }
  advance(state, 0.6);
  expect(state.faceoff?.phase).toBe("strike");
  expect(state.players.every((player): boolean => !player.wallReady)).toBe(
    true,
  );
  expect(state.players.at(6)?.role).toBe("Striker");
  expect(Math.abs(state.players.at(6)?.target.z ?? 10)).toBeLessThan(1);
  expect(state.players.at(9)?.target.x).toBeCloseTo(0);
  expect(state.players.at(9)?.target.z).toBeLessThan(0);
  expect(Math.abs(state.players.at(11)?.target.z ?? 0)).toBeGreaterThan(2);
  for (const player of state.players.filter(
    (candidate): boolean => !candidate.human,
  )) {
    expect(player.sprint).toBe(true);
    expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeGreaterThan(2);
    expect(Math.abs(player.position.z)).toBeLessThan(12);
  }
});

test("goals reset both teams to the wall and restore the central puck", (): void => {
  const state = createSimulation();
  state.faceoff = undefined;
  state.puck.position.set(0, PUCK_HEIGHT, -12.385);
  advance(state, 3.1);
  expect(state.scores.at(0)).toBe(1);
  expect(state).toMatchObject({ faceoff: { phase: "ready" } });
  expect(
    state.players.every(
      (player): boolean => Math.abs(player.position.z) === 12,
    ),
  ).toBe(true);
  expect(state.puck.position.z).toBe(0);
});

test("active handling exhausts air well before cruising does", (): void => {
  const exhaust = (controls: Controls): number => {
    const state = createSimulation("3-3", "3-3", "practice");
    state.puck.position.x = 5;
    let held = 0;
    while (held < 120 && !state.players.at(0)?.emergency) {
      advance(state, STEP, controls);
      held += STEP;
    }
    return held;
  };
  const active = exhaust({ ...freshControls(), forward: 1, dummy: 1 });
  const cruise = exhaust({ ...freshControls(), forward: 1 });
  expect(active).toBeGreaterThan(5);
  expect(active).toBeLessThan(cruise * 0.8);
});

test("a nearby puck is held through a curl and settles by the front of the blade on release", (): void => {
  const state = createSimulation("3-3", "3-3", "practice");
  const player = state.players.at(0);
  if (!player) throw new Error("Player missing");
  advance(state, 0.1, { ...freshControls(), curl: 1 });
  expect(state.puck.controlOwner).toBe(player.id);
  advance(state, 3.3, { ...freshControls(), curl: 1 });
  expect(Math.abs(player.yaw)).toBeGreaterThan(Math.PI * 2);
  expect(
    state.puck.position.distanceTo(puckSeat(player).setY(PUCK_HEIGHT)),
  ).toBeLessThan(0.04);
  advance(state, STEP);
  expect(state.puck.controlKind).toBe("settling");
  advance(state, 0.4);
  expect(state.puck.controlKind).toBe("carry");
});

test("shooting during a curl releases the held puck without immediately recapturing it", (): void => {
  const state = createSimulation("3-3", "3-3", "practice");
  advance(state, 0.1, { ...freshControls(), curl: 1 });
  advance(state, STEP, { ...freshControls(), curl: 1, shot: 0.8 });
  expect(state.puck.shotOwner).toBe(0);
  advance(state, 0.23, { ...freshControls(), curl: 1 });
  expect(state.shots).toBe(1);
  expect(state.puck.controlOwner).toBeUndefined();
  expect(state.puck.velocity.length()).toBeGreaterThan(3.5);
  advance(state, 0.1, { ...freshControls(), curl: 1 });
  expect(state.puck.controlOwner).toBeUndefined();
});

test("body contact removes inward movement while allowing a smooth tangential slide", (): void => {
  const state = createSimulation();
  const first = state.players.at(0);
  const second = state.players.at(6);
  if (!first || !second) throw new Error("Players missing");
  first.bodyPitch = 0;
  second.bodyPitch = 0;
  first.position.set(-0.8, 0.36, 0);
  second.position.set(0.8, 0.36, 0);
  first.yaw = 0;
  second.yaw = 0;
  const pair = [first, second];
  const travel = { maximumCorrection: 0, minimumGap: Infinity };
  for (const unused of Array.from({ length: 360 })) {
    void unused;
    first.velocity.set(2, 0, -0.6);
    second.velocity.set(-2, 0, -0.6);
    resolveBodies(pair, STEP, false);
    for (const player of pair)
      player.position.addScaledVector(player.velocity, STEP);
    const before = first.position.clone();
    resolveBodies(pair, STEP, true);
    travel.maximumCorrection = Math.max(
      travel.maximumCorrection,
      before.distanceTo(first.position),
    );
    travel.minimumGap = Math.min(
      travel.minimumGap,
      bodySeparation(first, second).length(),
    );
  }
  expect(travel.minimumGap).toBeGreaterThan(0.49);
  expect(travel.maximumCorrection).toBeLessThan(0.002);
  expect(first.position.z).toBeLessThan(-1.5);
});

test("descending onto a swimmer blocks the descent without pushing them through the floor", (): void => {
  const state = createSimulation();
  const lower = state.players.at(0);
  const upper = state.players.at(6);
  if (!lower || !upper) throw new Error("Players missing");
  lower.position.set(0, 0.36, 0);
  upper.position.set(0, 1.4, 0);
  lower.bodyPitch = 0;
  upper.bodyPitch = 0;
  lower.yaw = 0;
  upper.yaw = 0;
  const pair = [lower, upper];
  for (const unused of Array.from({ length: 240 })) {
    void unused;
    lower.velocity.set(0, 0, 0);
    upper.velocity.set(0, -1.5, 0);
    resolveBodies(pair, STEP, false);
    for (const player of pair)
      player.position.addScaledVector(player.velocity, STEP);
    resolveBodies(pair, STEP, true);
  }
  expect(lower.position.y).toBeCloseTo(0.36);
  expect(upper.position.y).toBeGreaterThan(0.85);
});

test("an opponent's blade can break the curl hold", (): void => {
  const state = createSimulation("3-3", "3-3", "practice");
  advance(state, 0.1, { ...freshControls(), curl: 1 });
  const opponent = createSimulation().players.at(6);
  if (!opponent) throw new Error("Opponent missing");
  opponent.wallReady = false;
  opponent.bodyPitch = 0;
  opponent.mode = "playing";
  opponent.position
    .copy(state.puck.position)
    .add(new Vector3(0.11, 0, -0.9))
    .setY(0.36);
  opponent.previous.copy(opponent.position);
  opponent.target.copy(opponent.position);
  updateStick(opponent, STEP);
  opponent.position
    .add(
      state.puck.position
        .clone()
        .sub(bladePoint(opponent, new Vector3(-0.06, 0, 0.05))),
    )
    .setY(0.36);
  opponent.target.copy(opponent.position);
  updateStick(opponent, STEP);
  opponent.previousStick.copy(opponent.stick);
  state.players.push(opponent);
  advance(state, 0.04, { ...freshControls(), curl: 1 });
  expect(state.puck.controlOwner).toBeUndefined();
  expect(state.puck.lastTouch).toBe(6);
  expect(state.puck.velocity.length()).toBeGreaterThan(0);
});
