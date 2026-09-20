import { expect, test } from "bun:test";
import { createFrameSends } from "../../src/multiplayer/client";
import { createNetworkMatch } from "../../src/multiplayer/match";
import { createMovementPrediction } from "../../src/multiplayer/prediction";
import {
  createSimulation,
  predictPlayerMovement,
  stepSimulation,
  updateStick,
} from "../../src/simulation";
import { puckSeat } from "../../src/stick";
import {
  FLOOR_HEIGHT,
  freshControls,
  PUCK_HEIGHT,
  STEP,
} from "../../src/types";

const state = () => {
  const simulation = createSimulation();
  simulation.faceoff = undefined;
  simulation.players = simulation.players.slice(0, 1);
  return simulation;
};
test("local charge and body animation advance between network snapshots", () => {
  const predicted = state();
  const actual = state();
  const player = predicted.players.at(0);
  const authoritative = actual.players.at(0);
  if (!player || !authoritative) throw new Error("Missing player");
  player.position.y = FLOOR_HEIGHT;
  authoritative.position.y = FLOOR_HEIGHT;
  player.mode = "playing";
  authoritative.mode = "playing";
  const controls = { ...freshControls(), charging: true, charge: 0.8 };
  predictPlayerMovement(predicted, player, controls, STEP);
  stepSimulation(actual, { ...controls }, STEP);
  expect(player.charging).toBe(true);
  expect(player.shotDraw).toBeCloseTo(authoritative.shotDraw);
  expect(player.kickPhase).toBeCloseTo(authoritative.kickPhase);
});
test("prediction uses the authoritative swimming controller without moving the puck", () => {
  const predicted = state();
  const actual = state();
  const player = predicted.players[0];
  const other = actual.players[0];
  if (!player || !other) throw new Error("Missing player");
  const puck = predicted.puck.position.clone();
  for (let i = 0; i < 60; i++) {
    const controls = {
      ...freshControls(),
      forward: 1,
      lateral: 0.3,
      sprint: true,
    };
    predictPlayerMovement(predicted, player, controls, STEP);
    stepSimulation(actual, { ...controls }, STEP);
  }
  expect(player.position.distanceTo(other.position)).toBeLessThan(0.00001);
  expect(predicted.puck.position.equals(puck)).toBe(true);
});
test("unacknowledged turning is replayed and acknowledged turning is not repeated", () => {
  const prediction = createMovementPrediction();
  const view = state();
  prediction.reconcile(view, -1);
  const yaw = view.players[0]?.yaw ?? 0;
  prediction.advance(view, { ...freshControls(), yawDelta: 0.02 }, STEP, 10);
  const predictedYaw = view.players[0]?.yaw;
  expect(predictedYaw).toBeGreaterThan(yaw);
  expect(predictedYaw).toBeLessThan(yaw + 0.02 * 1.3 * 1.45);
  const snapshot = state();
  prediction.reconcile(snapshot, 9);
  expect(snapshot.players[0]?.yaw).toBe(predictedYaw);
  const acknowledged = state();
  prediction.reconcile(acknowledged, 10);
  expect(acknowledged.players[0]?.yaw).toBe(yaw);
});
test("prediction respects countdown and bounds disconnected input history", () => {
  const prediction = createMovementPrediction();
  const view = createSimulation();
  prediction.reconcile(view, -1);
  const start = view.players[0]?.position.clone();
  if (!start) throw new Error("Missing player");
  for (let i = 0; i < 100; i++)
    prediction.advance(view, { ...freshControls(), forward: 1 }, 0.1, i);
  expect(view.players[0]?.position.equals(start)).toBe(true);
});
test("server acknowledges inputs only after a simulation step", () => {
  const match = createNetworkMatch();
  match.roster([{ id: "self", playerId: 0, connected: true, name: "Me" }]);
  match.input(0, 7, freshControls());
  expect(match.acknowledged[0]).toBeUndefined();
  match.advance(STEP);
  expect(match.acknowledged[0]).toBe(7);
});

const carryingState = () => {
  const simulation = state();
  const player = simulation.players.at(0);
  if (!player) throw new Error("Missing player");
  player.position.set(0, FLOOR_HEIGHT, 0);
  player.previous.copy(player.position);
  player.velocity.set(0, 0, 0);
  player.yaw = 0;
  player.bodyPitch = 0;
  player.mode = "playing";
  updateStick(player, STEP);
  simulation.puck.position.copy(puckSeat(player)).setY(PUCK_HEIGHT);
  simulation.puck.previous.copy(simulation.puck.position);
  simulation.puck.controlOwner = player.id;
  simulation.puck.controlKind = "carry";
  return simulation;
};
test("owned puck follows predicted swimming between server updates", () => {
  const view = carryingState();
  const prediction = createMovementPrediction();
  prediction.reconcile(view, -1);
  const player = view.players.at(0);
  if (!player) throw new Error("Missing player");
  const offset = view.puck.position.clone().sub(player.position);
  const controls = { ...freshControls(), forward: 1 };
  for (let frame = 0; frame < 25; frame++) {
    const before = view.puck.position.clone();
    prediction.advance(view, controls, 1 / 60, frame);
    expect(view.puck.position.distanceTo(before)).toBeLessThan(0.04);
    expect(
      view.puck.position.clone().sub(player.position).distanceTo(offset),
    ).toBeLessThan(0.01);
    expect(view.puck.previous.equals(view.puck.position)).toBe(true);
  }
  expect(player.position.z).toBeLessThan(-0.2);
});
test("carry correction follows the player and a new owner immediately wins", () => {
  const prediction = createMovementPrediction();
  const old = carryingState();
  prediction.reconcile(old, -1);
  prediction.advance(old, { ...freshControls(), forward: 1 }, 0.1, 1);
  const authoritative = carryingState();
  prediction.reconcile(authoritative, 1, old);
  const player = authoritative.players.at(0);
  if (!player) throw new Error("Missing player");
  expect(
    authoritative.puck.position.distanceTo(puckSeat(player).setY(PUCK_HEIGHT)),
  ).toBeLessThan(0.02);
  const takeover = carryingState();
  takeover.puck.controlOwner = 6;
  takeover.puck.position.set(2, PUCK_HEIGHT, 3);
  const position = takeover.puck.position.clone();
  prediction.reconcile(takeover, 1, authoritative);
  prediction.advance(takeover, { ...freshControls(), forward: 1 }, 1 / 60, 2);
  expect(takeover.puck.position.equals(position)).toBe(true);
});

test("input coalesces to the room's message budget without losing time", () => {
  // Preserve each input interval when the frame rate exceeds the message limit.
  // A window always covers whole room steps, so the room can acknowledge it on
  // the step it finishes spending it. The part-step remainder waits for the
  // next window instead of being dropped, so the shortfall stays below a single
  // window no matter how long the match runs.
  for (const refresh of [55, 60, 120, 144, 240]) {
    const sends = createFrameSends();
    const frame = 1 / refresh;
    let reported = 0;
    let elapsed = 0;
    for (const seconds of [1, 10, 120]) {
      const windows: number[] = [];
      for (let i = 0; i < refresh * seconds; i += 1) {
        const window = sends.add(frame);
        elapsed += frame;
        if (window !== undefined) windows.push(window);
      }
      reported += windows.reduce((sum, w) => sum + w, 0);
      // Never report more time than passed, and never fall a window behind.
      expect(reported).toBeLessThanOrEqual(elapsed + 1e-9);
      expect(elapsed - reported).toBeLessThanOrEqual(2 * STEP + 1e-9);
      expect(windows.length).toBeLessThanOrEqual(90 * seconds);
      for (const window of windows) {
        expect(window).toBeGreaterThanOrEqual(2 * STEP - 1e-9);
        expect(window / STEP).toBeCloseTo(Math.round(window / STEP), 6);
      }
    }
  }
});
