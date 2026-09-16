import { expect, test } from "bun:test";
import {
  createSimulation,
  stepSimulation,
  updateStick,
} from "../src/simulation";
import { puckSeat } from "../src/stick";
import {
  type Controls,
  freshControls,
  type Player,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
} from "../src/types";

const GENTLE = 0.008;
const HARD = 0.03;

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
  expect(player.yaw - origin).toBeCloseTo(60 * GENTLE * 1.3, 6);
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

test("a hard turn while carrying hands over to the curl mechanic", (): void => {
  for (const direction of [-1, 1]) {
    const { state, player } = setup(true);
    drive(state, 60, swimming(), HARD * direction);
    expect(player.curl).not.toBe(0);
    expect(Math.sign(player.turnRate)).toBe(direction);
    expect(Math.sign(player.curlTurnSpeed * -1)).toBe(direction);
    expect(horizontalSpeed(player)).toBe(0);
    expect(player.sprint).toBe(false);
    expect(state.puck.controlOwner).toBe(player.id);
  }
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

test("a hard turn without the puck keeps full mouse authority", (): void => {
  const { state, player } = setup(false);
  const origin = player.yaw;
  drive(state, 60, swimming(), HARD);
  expect(player.curl).toBe(0);
  expect(player.yaw - origin).toBeCloseTo(60 * HARD * 1.3, 6);
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
    const swung = peakTurnRate(auto.state, auto.player, 120, swimming(), flick);
    expect(auto.player.curl).not.toBe(0);
    expect(swung).toBeLessThanOrEqual(keyed + 1e-9);
  }
});

test("no puck action unlocks a faster turn than a curl while carrying", (): void => {
  const manual = setup(true);
  const keyed = peakTurnRate(manual.state, manual.player, 120, {
    ...freshControls(),
    curl: 1,
  });
  const actions: readonly Partial<Controls>[] = [
    {},
    { charging: true, charge: 0.5 },
    { dummyMode: true, dummy: 1 },
    { knockdown: true },
    { backhand: true },
  ];
  for (const action of actions) {
    const { state, player } = setup(true);
    const controls = { ...swimming(), ...action };
    let peak = 0;
    for (const unused of Array.from({ length: 120 })) {
      void unused;
      controls.yawDelta = HARD * 4;
      const before = player.yaw;
      stepSimulation(state, controls, STEP);
      if (state.puck.controlOwner === player.id)
        peak = Math.max(peak, Math.abs(player.yaw - before) / STEP);
    }
    expect(peak).toBeLessThanOrEqual(keyed + 1e-9);
  }
});

test("easing off the turn releases the auto curl and swimming resumes", (): void => {
  const { state, player } = setup(true);
  drive(state, 60, swimming(), HARD);
  expect(player.curl).not.toBe(0);
  drive(state, 90, swimming());
  expect(player.curl).toBe(0);
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
    60 * GENTLE * 1.3 * 0.3,
    6,
  );
});
