import { expect, test } from "bun:test";
import { createSimulation, stepSimulation, updateStick } from "./simulation";
import { puckSeat } from "./stick";
import {
  type Controls,
  freshControls,
  handSide,
  type Player,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
} from "./types";

const GENTLE = 0.008;
const HARD = 0.03;
const FASTER = 0.06;

const setup = (carrying: boolean): { state: Simulation; player: Player } => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  updateStick(player, STEP);
  player.previousStick.copy(player.stick);
  if (carrying) {
    state.puck.position.copy(puckSeat(player)).setY(PUCK_HEIGHT);
    state.puck.previous.copy(state.puck.position);
    state.puck.controlOwner = player.id;
    state.puck.controlKind = "carry";
  } else state.puck.position.set(6, PUCK_HEIGHT, 6);
  return { state, player };
};

const drive = (
  state: Simulation,
  steps: number,
  controls: Controls,
  yawDelta = 0,
): void => {
  for (const unused of Array.from({ length: steps })) {
    void unused;
    controls.yawDelta = yawDelta;
    stepSimulation(state, controls, STEP);
  }
};

const swimming = (): Controls => ({ ...freshControls(), forward: 1 });
const horizontalSpeed = (player: Player): number =>
  Math.hypot(player.velocity.x, player.velocity.z);

test("a gentle turn while carrying keeps the normal turn rate", (): void => {
  const { state, player } = setup(true);
  const origin = player.yaw;
  drive(state, 60, swimming(), GENTLE);
  expect(player.curl).toBe(0);
  expect(player.yaw - origin).toBeCloseTo(60 * GENTLE * 1.3 * 1.45, 6);
});

test("mouse steering uses the same stick motion as A and D", (): void => {
  const keyed = setup(true);
  drive(keyed.state, 60, { ...swimming(), lateral: 1 });
  const pointer = setup(true);
  const matchingPointerTurn = (-2.47 * STEP) / (1.3 * 1.45);
  drive(pointer.state, 60, swimming(), matchingPointerTurn);
  expect(pointer.player.lateral).toBeCloseTo(keyed.player.lateral, 1);
  expect(pointer.player.stickOffset.x).toBeCloseTo(
    keyed.player.stickOffset.x,
    2,
  );
  expect(pointer.player.bladeRotation).toBeCloseTo(
    keyed.player.bladeRotation,
    1,
  );
});

test("mouse steering settles through the stick animation after release", (): void => {
  const { state, player } = setup(true);
  drive(state, 6, swimming(), -GENTLE);
  const turnedLateral = player.lateral;
  const turnedOffset = player.stickOffset.x;
  drive(state, 1, swimming());
  expect(player.lateral).toBeGreaterThan(0);
  expect(player.lateral).toBeLessThan(turnedLateral);
  expect(player.stickOffset.x).toBeGreaterThan(turnedOffset);
  drive(state, 60, swimming());
  expect(Math.abs(player.lateral)).toBeLessThan(0.003);
  expect(player.stickOffset.x).toBeCloseTo(handSide(player) * 0.13, 2);
});

test("a gentle turn underwater costs a little forward speed", (): void => {
  const straight = setup(false);
  drive(straight.state, 180, swimming());
  const cruising = horizontalSpeed(straight.player);

  const carving = setup(false);
  drive(carving.state, 180, swimming(), GENTLE);
  const turning = horizontalSpeed(carving.player);

  expect(carving.player.curl).toBe(0);
  expect(turning).toBeLessThan(cruising);
  expect(turning).toBeGreaterThan(cruising * 0.85);
});

test("a hard turn from a stop hands over to the curl mechanic", (): void => {
  for (const direction of [-1, 1]) {
    const { state, player } = setup(true);
    drive(state, 60, freshControls(), HARD * direction);
    expect(player.curl).not.toBe(0);
    expect(Math.sign(player.turnRate)).toBe(direction);
    expect(Math.sign(player.curlTurnSpeed * -1)).toBe(direction);
    expect(horizontalSpeed(player)).toBe(0);
    expect(player.sprint).toBe(false);
    expect(state.puck.controlOwner).toBe(player.id);
  }
});

test("forward swimming with the puck stays a plain turn", (): void => {
  const { state, player } = setup(true);
  drive(state, 60, swimming(), FASTER * 4);
  expect(player.curl).toBe(0);
  expect(player.dummy).toBe(0);
  expect(horizontalSpeed(player)).toBeGreaterThan(1);
});

test("a sprint turn starts a slower automatic dummy", (): void => {
  for (const direction of [-1, 1]) {
    const { state, player } = setup(true);
    drive(state, 30, { ...swimming(), sprint: true }, HARD * direction);
    expect(player.curl).toBe(0);
    expect(Math.sign(player.dummy * -1)).toBe(direction);
    expect(state.puck.controlKind).toBe("dummy");
    expect(horizontalSpeed(player)).toBeGreaterThan(2);
    expect(player.sprint).toBe(true);
    expect(player.dummyBurstUntil).toBe(0);
  }
});

test("a sprint keeps the dummy however hard the turn", (): void => {
  for (const flick of [FASTER, FASTER * 5]) {
    const { state, player } = setup(true);
    drive(state, 30, { ...swimming(), sprint: true }, flick);
    expect(player.curl).toBe(0);
    expect(player.dummy).not.toBe(0);
    expect(player.sprint).toBe(true);
    expect(horizontalSpeed(player)).toBeGreaterThan(2);
  }
});

test("a faster turn without the puck still costs no speed", (): void => {
  const { state, player } = setup(false);
  drive(state, 60, swimming(), FASTER);
  expect(player.curl).toBe(0);
  expect(player.dummy).toBe(0);
  expect(horizontalSpeed(player)).toBeGreaterThan(1);
});

test("holding a side key alone never hands over to the curl", (): void => {
  for (const direction of [-1, 1]) {
    for (const sprint of [false, true]) {
      const { state, player } = setup(true);
      drive(state, 120, {
        ...freshControls(),
        forward: 1,
        lateral: direction,
        sprint,
      });
      expect(player.curl).toBe(0);
    }
  }
});

test("a turn without the puck keeps full mouse authority under the cap", (): void => {
  const { state, player } = setup(false);
  const origin = player.yaw;
  drive(state, 60, swimming(), GENTLE);
  expect(player.curl).toBe(0);
  expect(player.yaw - origin).toBeCloseTo(60 * GENTLE * 1.3 * 2.05, 6);
  expect(horizontalSpeed(player)).toBeGreaterThan(1);
});

const peakTurnRate = (
  state: Simulation,
  player: Player,
  steps: number,
  controls: Controls,
  yawDelta = 0,
): number => {
  let peak = 0;
  for (const unused of Array.from({ length: steps })) {
    void unused;
    controls.yawDelta = yawDelta;
    const before = player.yaw;
    stepSimulation(state, controls, STEP);
    if (player.curl !== 0)
      peak = Math.max(peak, Math.abs(player.yaw - before) / STEP);
  }
  return peak;
};

test("the auto curl never turns faster than a Q/E curl", (): void => {
  const manual = setup(true);
  const keyed = peakTurnRate(manual.state, manual.player, 120, {
    ...freshControls(),
    curl: 1,
  });

  for (const flick of [HARD, HARD * 4, HARD * 20]) {
    const auto = setup(true);
    const swung = peakTurnRate(
      auto.state,
      auto.player,
      120,
      freshControls(),
      flick,
    );
    expect(auto.player.curl).not.toBe(0);
    expect(swung).toBeLessThanOrEqual(keyed + 1e-9);
  }
});

test("free swimming turns faster than a side key under a hard pointer turn", (): void => {
  const keyed = setup(false);
  const keyedOrigin = keyed.player.yaw;
  drive(keyed.state, 120, { ...swimming(), lateral: 1 });
  const keyedTurn = Math.abs(keyed.player.yaw - keyedOrigin);

  for (const flick of [FASTER, FASTER * 20]) {
    const { state, player } = setup(false);
    const origin = player.yaw;
    drive(state, 120, swimming(), flick);
    expect(player.curl).toBe(0);
    expect(Math.abs(player.yaw - origin)).toBeGreaterThan(keyedTurn);
    expect(horizontalSpeed(player)).toBeGreaterThan(1);
  }
});

test("a lower room swim turn setting caps the free swim yaw change tighter than a higher one", (): void => {
  const tight = setup(false);
  tight.state.swimTurn = 1;
  const tightOrigin = tight.player.yaw;
  drive(tight.state, 120, swimming(), FASTER * 20);
  const tightSwing = Math.abs(tight.player.yaw - tightOrigin);

  const loose = setup(false);
  loose.state.swimTurn = 5;
  const looseOrigin = loose.player.yaw;
  drive(loose.state, 120, swimming(), FASTER * 20);
  const looseSwing = Math.abs(loose.player.yaw - looseOrigin);

  expect(tight.player.curl).toBe(0);
  expect(loose.player.curl).toBe(0);
  expect(tightSwing).toBeLessThan(looseSwing);
});

test("free swimming turns faster than swimming with the puck", (): void => {
  const carrying = setup(true);
  const carryingOrigin = carrying.player.yaw;
  drive(carrying.state, 240, swimming(), HARD * 4);
  const carryingTurn = Math.abs(carrying.player.yaw - carryingOrigin);
  const free = setup(false);
  const freeOrigin = free.player.yaw;
  drive(free.state, 240, swimming(), HARD * 4);
  const freeTurn = Math.abs(free.player.yaw - freeOrigin);
  const curling = setup(true);
  const curlOrigin = curling.player.yaw;
  drive(curling.state, 240, { ...freshControls(), curl: 1 });
  const curlTurn = Math.abs(curling.player.yaw - curlOrigin);
  expect(freeTurn).toBeGreaterThan(carryingTurn);
  expect(carryingTurn / curlTurn).toBeCloseTo(1, 1);
});

test("a sustained turn finishes one automatic dummy before it can rearm", (): void => {
  const { state, player } = setup(true);
  const sprinting = { ...swimming(), sprint: true };
  drive(state, 30, sprinting, HARD);
  expect(player.dummy).not.toBe(0);
  drive(state, 90, sprinting, HARD);
  expect(player.dummy).toBe(0);
  expect(player.autoDummyLocked).toBe(true);
  drive(state, 90, swimming());
  expect(player.autoDummyLocked).toBe(false);
  drive(state, 30, sprinting, HARD);
  expect(player.dummy).not.toBe(0);
  drive(state, 90, swimming());
  expect(player.curl).toBe(0);
  expect(player.dummy).toBe(0);
  expect(horizontalSpeed(player)).toBeGreaterThan(1);
});

test("the mouse loses most of its authority while curling", (): void => {
  const { state, player } = setup(true);
  const origin = player.yaw;
  const controls = { ...freshControls(), curl: 1 };
  drive(state, 60, controls, GENTLE);
  const curled = player.yaw - origin;

  const loose = setup(true);
  const looseOrigin = loose.player.yaw;
  drive(loose.state, 60, { ...freshControls(), curl: 1 });
  expect(curled - (loose.player.yaw - looseOrigin)).toBeCloseTo(
    60 * GENTLE * 1.3 * 1.45 * 0.3,
    6,
  );
});
