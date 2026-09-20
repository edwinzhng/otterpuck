import { expect, test } from "bun:test";
import { Vector3 } from "three";
import {
  coordinatePuckPursuit,
  teamPuckCarrier,
  yieldToPuckChaser,
} from "./bots";
import { bodySeparation, resolveBodies } from "./collisions";
import { createSimulation, stepSimulation, updateStick } from "./simulation";
import { puckSeat } from "./stick";
import {
  FLOOR_HEIGHT,
  freshControls,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
} from "./types";

const teamAtBottom = (): Simulation => {
  const state = createSimulation();
  state.faceoff = undefined;
  state.players = state.players.filter((player): boolean => player.team === 0);
  for (const player of state.players) {
    player.position.set((player.slot - 2) * 1.5, FLOOR_HEIGHT, 1.5);
    player.previous.copy(player.position);
    player.mode = "playing";
    player.bodyPitch = 0;
    player.wallReady = false;
    player.wantDown = true;
    player.velocity.set(0, 0, 0);
    updateStick(player, STEP);
  }
  state.puck.position.set(0, PUCK_HEIGHT, 0);
  state.puck.previous.copy(state.puck.position);
  return state;
};

test("one teammate pursues a loose puck and small distance changes do not switch the assignment", (): void => {
  const state = teamAtBottom();
  const first = state.players.at(2),
    second = state.players.at(3);
  if (!first || !second) throw new Error("Missing teammates");
  first.position.set(-0.5, FLOOR_HEIGHT, 0.8);
  second.position.set(0.5, FLOOR_HEIGHT, 0.9);
  coordinatePuckPursuit(state, 0);
  expect(state.puckChasers[0]).toBe(first.id);
  second.position.z = 0.7;
  coordinatePuckPursuit(state, 0);
  expect(state.puckChasers[0]).toBe(first.id);
  first.mode = "ascending";
  coordinatePuckPursuit(state, 0);
  expect(state.puckChasers[0]).toBe(second.id);
  stepSimulation(state, freshControls(), STEP);
  const pressure = state.players.filter(
    (player): boolean => !player.human && player.duty === "pressure",
  );
  expect(pressure).toHaveLength(1);
  expect(pressure.at(0)?.id).toBe(state.puckChasers[0]);
});

test("the actual carrier wins over stale touches and nearby teammates support without reaching for its puck", (): void => {
  const state = teamAtBottom();
  const human = state.players.at(0),
    staleTouch = state.players.at(2);
  if (!human || !staleTouch) throw new Error("Missing teammates");
  human.position.set(0, FLOOR_HEIGHT, 0);
  human.previous.copy(human.position);
  updateStick(human, STEP);
  state.puck.position.copy(puckSeat(human)).setY(PUCK_HEIGHT);
  state.puck.previous.copy(state.puck.position);
  state.puck.controlOwner = human.id;
  state.puck.controlKind = "carry";
  state.puck.lastTouch = staleTouch.id;
  state.puck.touchTime = state.time;
  expect(teamPuckCarrier(state, 0)).toBe(human);
  for (const unused of Array.from({ length: 240 })) {
    void unused;
    stepSimulation(state, freshControls(), STEP);
    expect(state.puck.controlOwner).toBe(human.id);
    expect(state.puckChasers[0]).toBe(human.id);
    expect(human.position.y).toBe(FLOOR_HEIGHT);
    for (const teammate of state.players.filter(
      (player): boolean => !player.human,
    )) {
      expect(teammate.duty).not.toBe("pressure");
      expect(teammate.shotTime).toBe(0);
      expect(teammate.target.distanceTo(teammate.formationTarget)).toBeLessThan(
        0.01,
      );
      expect(teammate.position.distanceTo(human.position)).toBeGreaterThan(
        0.65,
      );
    }
  }
  expect(human.position.length()).toBeCloseTo(FLOOR_HEIGHT, 5);
});

test("support swimmers actively clear the carrier's path rather than trying to swim through it", (): void => {
  const state = teamAtBottom();
  const human = state.players.at(0),
    teammate = state.players.at(1);
  if (!human || !teammate) throw new Error("Missing teammates");
  human.position.set(0, FLOOR_HEIGHT, 0);
  teammate.position.set(0.6, FLOOR_HEIGHT, -0.3);
  state.puck.controlOwner = human.id;
  const desired = new Vector3(-1, 0, 0.5);
  yieldToPuckChaser(state, teammate, desired);
  expect(
    desired.dot(teammate.position.clone().sub(human.position)),
  ).toBeGreaterThan(0.5);
  expect(desired.y).toBe(0);
  expect(desired.length()).toBeLessThanOrEqual(1.21);
});

test("repeated body pressure stops at a grounded player without pushing or bouncing them", (): void => {
  const state = createSimulation();
  const human = state.players.at(0),
    bot = state.players.at(6);
  if (!human || !bot) throw new Error("Missing swimmers");
  for (const player of [human, bot]) {
    player.bodyPitch = 0;
    player.yaw = 0;
    player.mode = "playing";
  }
  human.position.set(0, FLOOR_HEIGHT, 0);
  bot.position.set(-1.2, FLOOR_HEIGHT, 0);
  for (const unused of Array.from({ length: 360 })) {
    void unused;
    human.velocity.set(0, 0, 0);
    bot.velocity.set(2.9, 0, -0.25);
    resolveBodies([human, bot], STEP, false);
    for (const player of [human, bot])
      player.position.addScaledVector(player.velocity, STEP);
    resolveBodies([human, bot], STEP, true);
    expect(human.position.x).toBeCloseTo(0, 7);
    expect(human.position.z).toBeCloseTo(0, 7);
    expect(human.velocity.length()).toBe(0);
    expect(bodySeparation(human, bot).length()).toBeGreaterThan(0.57);
    expect(bot.velocity.x).toBeGreaterThanOrEqual(-0.00001);
  }
  expect(bot.position.z).toBeLessThan(-0.7);
});
