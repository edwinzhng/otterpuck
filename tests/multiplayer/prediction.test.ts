import { expect, test } from "bun:test";
import {
  createFrameSends,
  FRAME_SEND_LIMIT,
} from "../../src/multiplayer/client";
import { createNetworkMatch } from "../../src/multiplayer/match";
import { createMovementPrediction } from "../../src/multiplayer/prediction";
import {
  createSimulation,
  predictPlayerMovement,
  probeTurnCap,
  readTurnCap,
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

const degrees = (radians: number): number => (radians * 180) / Math.PI;
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
  expect(view.players[0]?.yaw).toBeCloseTo(yaw + 0.026);
  const snapshot = state();
  prediction.reconcile(snapshot, 9);
  expect(snapshot.players[0]?.yaw).toBeCloseTo(yaw + 0.026);
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

test("a snapshot reports the room's disagreement, not the replay's", () => {
  // The readout is only worth reading if a hard turn does not inflate it: an
  // unacknowledged input is replayed on every snapshot, and the cap counted
  // each replay as fresh mouse movement.
  const view = state();
  const prediction = createMovementPrediction();
  prediction.reconcile(view, -1);
  probeTurnCap(true);
  readTurnCap();
  const fast = { ...freshControls(), yawDelta: 0.5 };
  for (let sequence = 1; sequence <= 6; sequence += 1)
    prediction.advance(view, { ...fast }, 1 / 60, sequence);
  const live = readTurnCap();
  expect(live.clipped).toBeGreaterThan(0);

  const agreeing = state();
  const player = agreeing.players.at(0);
  if (!player) throw new Error("Missing player");
  player.yaw = view.players.at(0)?.yaw ?? 0;
  const settled = prediction.reconcile(agreeing, 6, view);
  expect(degrees(settled.missed)).toBeLessThan(0.01);
  expect(readTurnCap().clipped).toBe(0);
  probeTurnCap(false);
});

test("a room that turned less than the prediction shows up as a miss", () => {
  const view = state();
  const prediction = createMovementPrediction();
  prediction.reconcile(view, -1);
  prediction.advance(view, { ...freshControls(), yawDelta: 0.5 }, 1 / 60, 1);
  const short = state();
  const player = short.players.at(0);
  if (!player) throw new Error("Missing player");
  player.yaw = (view.players.at(0)?.yaw ?? 0) - 0.1;
  expect(degrees(prediction.reconcile(short, 1, view).missed)).toBeCloseTo(
    degrees(0.1),
    4,
  );
});

test("a room that keeps turning less than the prediction reads as short", () => {
  // A wobble averages to nothing; the room systematically under-delivering a
  // turn does not, and only the second is worth chasing.
  const shortfall = (direction: number, roomYaw: (yaw: number) => number) => {
    const view = state();
    const prediction = createMovementPrediction();
    prediction.reconcile(view, -1);
    prediction.advance(
      view,
      { ...freshControls(), yawDelta: 0.5 * direction },
      1 / 60,
      1,
    );
    const room = state();
    const player = room.players.at(0);
    if (!player) throw new Error("Missing player");
    player.yaw = roomYaw(view.players.at(0)?.yaw ?? 0);
    return prediction.reconcile(room, 1, view).short;
  };
  for (const direction of [-1, 1]) {
    const behind = shortfall(direction, (yaw) => yaw - 0.1 * direction);
    expect(degrees(behind)).toBeCloseTo(degrees(0.1), 4);
    const ahead = shortfall(direction, (yaw) => yaw + 0.1 * direction);
    expect(degrees(ahead)).toBeCloseTo(degrees(-0.1), 4);
  }
});

test("per-frame input stays inside the room's message budget", () => {
  // A high refresh screen renders far past the hundred messages a second the
  // room accepts, and sending one per frame closed the socket. Frames coalesce
  // instead, and must still report the interval they were made over.
  for (const refresh of [60, 120, 144, 240]) {
    const sends = createFrameSends();
    const frame = 1 / refresh;
    const windows: number[] = [];
    for (let i = 0; i < refresh; i += 1) {
      const window = sends.add(frame);
      if (window !== undefined) windows.push(window);
    }
    expect(windows.length).toBeLessThanOrEqual(90);
    expect(windows.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1, 6);
    for (const window of windows)
      expect(window).toBeGreaterThanOrEqual(Math.min(frame, FRAME_SEND_LIMIT));
  }
});
