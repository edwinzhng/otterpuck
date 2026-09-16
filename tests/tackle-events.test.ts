import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { createSimulation } from "../src/simulation";
import { createTackleTracker } from "../src/tackle-events";
import { turnoverOutcome } from "../src/turnover-banner";
import { FLOOR_HEIGHT, type Player, type Simulation } from "../src/types";

const RIGHT = Math.PI / 2;
const LEFT = -Math.PI / 2;
const AHEAD = 0;
const BEHIND = Math.PI;

const stage = (): { state: Simulation; carrier: Player; taker: Player } => {
  const state = createSimulation();
  const carrier = state.players.at(0);
  const taker = state.players.at(6);
  if (!carrier || !taker) throw new Error("Players missing");
  state.faceoff = undefined;
  for (const player of state.players) {
    player.wallReady = false;
    player.emergency = false;
    player.position.set(50, FLOOR_HEIGHT, 50);
  }
  carrier.position.set(0, FLOOR_HEIGHT, 0);
  carrier.yaw = 0;
  state.puck.controlOwner = carrier.id;
  return { state, carrier, taker };
};

const steal = (
  bearing: number,
  curl = 0,
  second?: number,
): { label: string; detail: string } => {
  const { state, carrier, taker } = stage();
  const tracker = createTackleTracker();
  carrier.curl = curl;
  tracker.reset(state);
  taker.position
    .copy(carrier.position)
    .add(new Vector3(Math.sin(bearing) * 0.9, 0, -Math.cos(bearing) * 0.9));
  taker.yaw = carrier.yaw;
  if (second !== undefined) {
    const other = state.players.at(7);
    if (!other) throw new Error("Second challenger missing");
    other.position
      .copy(carrier.position)
      .add(new Vector3(Math.sin(second) * 0.9, 0, -Math.cos(second) * 0.9));
    other.yaw = carrier.yaw;
  }
  state.time = 1;
  tracker.sample(state);
  state.time = 2;
  state.puck.controlOwner = taker.id;
  tracker.sample(state);
  const event = tracker.events().at(0);
  if (!event) throw new Error("No event logged");
  return { label: event.label, detail: event.detail };
};

test("a steal is labelled by the side the taker came from", (): void => {
  expect(steal(RIGHT).label).toBe("RIGHT TACKLE");
  expect(steal(LEFT).label).toBe("LEFT TACKLE");
  expect(steal(AHEAD).label).toBe("FRONT TACKLE");
  expect(steal(BEHIND).label).toBe("BACK TACKLE");
});

test("losing it while sandwiched is reported as a sandwich", (): void => {
  expect(steal(RIGHT, -1, LEFT).label).toBe("SANDWICH");
  expect(steal(RIGHT, -1).label).toBe("RIGHT TACKLE");
});

test("the entry names the carry the puck was lost from", (): void => {
  expect(steal(LEFT, -1).detail).toContain("reverse curl");
  expect(steal(LEFT, 1).detail).toContain("regular curl");
  expect(steal(LEFT, 0).detail).toContain("carrying");
});

test("the entry reports cover against the player who took it", (): void => {
  expect(steal(RIGHT, -1).detail).toContain("cover 0.9");
  expect(steal(LEFT, -1).detail).toContain("cover 0.00");
});

test("no cover is reported when the carrier was not curling", (): void => {
  expect(steal(RIGHT, 0).detail).not.toContain("cover");
  expect(steal(LEFT, 0).detail).not.toContain("cover");
});

test("a teammate taking over is not a tackle", (): void => {
  const { state, carrier } = stage();
  const mate = state.players.at(1);
  if (!mate) throw new Error("Teammate missing");
  const tracker = createTackleTracker();
  tracker.reset(state);
  mate.position.copy(carrier.position).add(new Vector3(0.9, 0, 0));
  state.time = 1;
  tracker.sample(state);
  state.time = 2;
  state.puck.controlOwner = mate.id;
  tracker.sample(state);
  expect(tracker.events()).toHaveLength(0);
});

test("a touch too brief to be possession is not a tackle", (): void => {
  const { state, carrier, taker } = stage();
  const tracker = createTackleTracker();
  tracker.reset(state);
  taker.position.copy(carrier.position).add(new Vector3(0.9, 0, 0));
  state.time = 0.05;
  tracker.sample(state);
  state.puck.controlOwner = taker.id;
  tracker.sample(state);
  expect(tracker.events()).toHaveLength(0);
});

test("the log keeps the most recent entries first and stays bounded", (): void => {
  const { state, carrier, taker } = stage();
  const tracker = createTackleTracker();
  tracker.reset(state);
  for (const [index, bearing] of [
    RIGHT,
    LEFT,
    RIGHT,
    LEFT,
    RIGHT,
    LEFT,
    RIGHT,
  ].entries()) {
    const holder = index % 2 === 0 ? carrier : taker;
    const next = index % 2 === 0 ? taker : carrier;
    next.position
      .copy(holder.position)
      .add(new Vector3(Math.sin(bearing) * 0.9, 0, -Math.cos(bearing) * 0.9));
    state.time = index * 2 + 1;
    state.puck.controlOwner = holder.id;
    tracker.sample(state);
    state.time = index * 2 + 2;
    state.puck.controlOwner = next.id;
    tracker.sample(state);
  }
  expect(tracker.events().length).toBeLessThanOrEqual(6);
  const [newest, older] = tracker.events();
  if (!newest || !older) throw new Error("Missing entries");
  expect(newest.time).toBeGreaterThan(older.time);
});

test("an entry records who lost it, who took it and any pincer", (): void => {
  const { state, carrier, taker } = stage();
  const tracker = createTackleTracker();
  tracker.reset(state);
  taker.position.copy(carrier.position).add(new Vector3(0.9, 0, 0));
  state.time = 1;
  tracker.sample(state);
  state.time = 2;
  state.puck.controlOwner = taker.id;
  tracker.sample(state);
  const event = tracker.events().at(0);
  if (!event) throw new Error("No event logged");
  expect(event.carrierId).toBe(carrier.id);
  expect(event.takerId).toBe(taker.id);
  expect(event.takerTeam).toBe(taker.team);
  expect(event.sandwichIds).toHaveLength(0);
});

test("a sandwich records both opponents who closed on the carrier", (): void => {
  const { state, carrier, taker } = stage();
  const other = state.players.at(7);
  if (!other) throw new Error("Second challenger missing");
  const tracker = createTackleTracker();
  carrier.curl = -1;
  tracker.reset(state);
  taker.position.copy(carrier.position).add(new Vector3(0.9, 0, 0));
  taker.yaw = carrier.yaw;
  other.position.copy(carrier.position).add(new Vector3(-0.9, 0, 0));
  other.yaw = carrier.yaw;
  state.time = 1;
  tracker.sample(state);
  state.time = 2;
  state.puck.controlOwner = taker.id;
  tracker.sample(state);
  const event = tracker.events().at(0);
  if (!event) throw new Error("No event logged");
  expect(event.label).toBe("SANDWICH");
  expect([...event.sandwichIds].sort()).toEqual([taker.id, other.id].sort());
});

test("the banner speaks only for the local player's own turnovers", (): void => {
  const { state, carrier, taker } = stage();
  const mate = state.players.at(1);
  const opponent = state.players.at(7);
  if (!mate || !opponent) throw new Error("Players missing");
  const base = {
    label: "RIGHT TACKLE",
    detail: "carrying",
    sandwichIds: [],
    time: 0,
  };
  expect(
    turnoverOutcome(state, {
      ...base,
      carrierId: carrier.id,
      takerId: taker.id,
      takerTeam: taker.team,
    }),
  ).toBe("lost");
  expect(
    turnoverOutcome(state, {
      ...base,
      carrierId: taker.id,
      takerId: carrier.id,
      takerTeam: carrier.team,
    }),
  ).toBe("won");
  expect(
    turnoverOutcome(state, {
      ...base,
      carrierId: mate.id,
      takerId: taker.id,
      takerTeam: taker.team,
    }),
  ).toBeUndefined();
  expect(
    turnoverOutcome(state, {
      ...base,
      carrierId: opponent.id,
      takerId: mate.id,
      takerTeam: mate.team,
    }),
  ).toBeUndefined();
  expect(
    turnoverOutcome(state, {
      ...base,
      carrierId: opponent.id,
      takerId: mate.id,
      sandwichIds: [mate.id, carrier.id],
      takerTeam: mate.team,
    }),
  ).toBe("won");
});
