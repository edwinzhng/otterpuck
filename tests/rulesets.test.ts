import { expect, test } from "bun:test";
import {
  createSimulation,
  stepSimulation,
  updateStick,
} from "../src/simulation";
import { puckSeat } from "../src/stick";
import {
  type Controls,
  FLOOR_HEIGHT,
  freshControls,
  MAX_STAMINA,
  type Player,
  PUCK_HEIGHT,
  type Ruleset,
  type Simulation,
  STEP,
  SURFACE_HEIGHT,
} from "../src/types";

const setup = (
  ruleset: Ruleset,
  mode: "practice" | "playground" = "practice",
): { state: Simulation; player: Player } => {
  const state = createSimulation("2-3-1", "2-3-1", mode, 180, "right", {
    species: "otter",
    position: 0,
    difficulty: "medium",
    ruleset,
  });
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  player.position.set(-7, FLOOR_HEIGHT, 0);
  player.yaw = -Math.PI / 2;
  return { state, player };
};

const carry = (state: Simulation, player: Player): void => {
  updateStick(player, STEP);
  player.previousStick.copy(player.stick);
  state.puck.position.copy(puckSeat(player)).setY(PUCK_HEIGHT);
  state.puck.previous.copy(state.puck.position);
  state.puck.controlOwner = player.id;
  state.puck.controlKind = "carry";
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
const sprinting = (): Controls => ({ ...swimming(), sprint: true });
const horizontalSpeed = (player: Player): number =>
  Math.hypot(player.velocity.x, player.velocity.z);

test("the ruleset defaults to alternative and is carried on the simulation", (): void => {
  expect(createSimulation().ruleset).toBe("alternative");
  expect(setup("original").state.ruleset).toBe("original");
});

test("original keeps sprinting available indefinitely", (): void => {
  const { state, player } = setup("original");
  for (const unused of Array.from({ length: 30 * 120 })) {
    void unused;
    player.air = 100;
    const controls = sprinting();
    controls.yawDelta = 0;
    stepSimulation(state, controls, STEP);
  }
  expect(player.sprint).toBe(true);
  expect(player.stamina).toBeGreaterThan(MAX_STAMINA * 0.4);
});

test("original refills air at the pre-stamina rate", (): void => {
  const { state, player } = setup("original");
  player.air = 40;
  player.position.y = SURFACE_HEIGHT;
  drive(state, 120, freshControls());
  expect(player.air - 40).toBeCloseTo(13, 1);
});

test("original turns underwater at no cost to speed", (): void => {
  const straight = setup("original");
  drive(straight.state, 180, swimming());
  const cruising = horizontalSpeed(straight.player);

  const kept = setup("original");
  drive(kept.state, 180, swimming(), 0.008);
  expect(horizontalSpeed(kept.player) / cruising).toBeGreaterThan(0.998);

  const dragged = setup("alternative");
  drive(dragged.state, 180, swimming(), 0.008);
  expect(horizontalSpeed(dragged.player) / cruising).toBeLessThan(0.96);
});

test("original never hands a hard turn over to the curl", (): void => {
  const { state, player } = setup("original", "playground");
  carry(state, player);
  const origin = player.yaw;
  drive(state, 60, swimming(), 0.03);
  expect(player.curl).toBe(0);
  expect(player.yaw - origin).toBeCloseTo(60 * 0.03 * 1.3 * 1.45, 6);
  expect(horizontalSpeed(player)).toBeGreaterThan(1);
});

test("original leaves the mouse at full authority during a Q/E curl", (): void => {
  const { state, player } = setup("original", "playground");
  carry(state, player);
  const origin = player.yaw;
  drive(state, 60, { ...freshControls(), curl: 1 }, 0.008);

  const loose = setup("original", "playground");
  carry(loose.state, loose.player);
  const looseOrigin = loose.player.yaw;
  drive(loose.state, 60, { ...freshControls(), curl: 1 });

  expect(player.yaw - origin - (loose.player.yaw - looseOrigin)).toBeCloseTo(
    60 * 0.008 * 1.3 * 1.45,
    6,
  );
});

const breathHold = (
  ruleset: Ruleset,
  controls: Controls,
  pinStamina = false,
  stamina = MAX_STAMINA,
): number => {
  const { state, player } = setup(ruleset);
  let held = 0;
  while (player.air > 0 && held < 300) {
    player.position.y = FLOOR_HEIGHT;
    if (pinStamina) player.stamina = stamina;
    controls.yawDelta = 0;
    stepSimulation(state, controls, STEP);
    held += STEP;
  }
  return held;
};

test("alternative spends a full breath on the tuned schedule", (): void => {
  expect(breathHold("alternative", freshControls())).toBeCloseTo(30, 1);
  expect(breathHold("alternative", swimming())).toBeCloseTo(20, 1);
  expect(breathHold("alternative", sprinting(), true)).toBeCloseTo(20, 1);
});

test("original keeps its own longer breath schedule", (): void => {
  expect(breathHold("original", freshControls())).toBeGreaterThan(45);
  expect(breathHold("original", swimming())).toBeGreaterThan(25);
  expect(breathHold("original", sprinting(), true)).toBeGreaterThan(11);
});

test("an empty stamina bar does not shorten the breath", (): void => {
  const fresh = breathHold("alternative", swimming(), true);
  const spent = breathHold("alternative", swimming(), true, 0);
  expect(spent).toBeCloseTo(fresh, 6);
});

test("a smaller air supply also refills in proportion", (): void => {
  const refill = (ruleset: Ruleset): number => {
    const { state, player } = setup(ruleset);
    player.air = 0;
    let taken = 0;
    while (player.air < 100 && taken < 300) {
      player.position.y = SURFACE_HEIGHT;
      stepSimulation(state, freshControls(), STEP);
      taken += STEP;
    }
    return taken;
  };
  expect(refill("alternative") / refill("original")).toBeCloseTo(0.6, 2);
});

test("alternative and original diverge on a sustained sprint", (): void => {
  const spent = (["alternative", "original"] as const).map(
    (ruleset): number => {
      const { state, player } = setup(ruleset);
      for (const unused of Array.from({ length: 5 * 120 })) {
        void unused;
        player.air = 100;
        const controls = sprinting();
        controls.yawDelta = 0;
        stepSimulation(state, controls, STEP);
      }
      return player.stamina;
    },
  );
  const [alternative, original] = spent;
  if (alternative === undefined || original === undefined)
    throw new Error("Missing samples");
  expect(alternative).toBeLessThan(40);
  expect(original).toBeGreaterThan(90);
});
