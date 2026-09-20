import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { isPuckContested, pollMovement } from "./handling";
import {
  createSimulation,
  resetPracticePuck,
  stepSimulation,
  updateStick,
} from "./simulation";
import {
  bladePoint,
  HOOK_ROOT,
  puckSeat,
  SHOT_RELEASE,
  STICK_GRIP,
  STICK_TIP,
  shotProgress,
} from "./stick";
import {
  type Controls,
  FRONT_PAW,
  freshControls,
  type Player,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
} from "./types";

const setup = (): { state: Simulation; player: Player } => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  return { state, player };
};
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
const addOpponent = (state: Simulation, distance: number): Player => {
  const opponent = createSimulation().players.at(6);
  if (!opponent) throw new Error("Opponent missing");
  opponent.wallReady = false;
  opponent.bodyPitch = 0;
  opponent.mode = "playing";
  opponent.position
    .copy(state.puck.position)
    .add(new Vector3(distance, 0, 0))
    .setY(0.36);
  opponent.target.copy(opponent.position);
  opponent.previous.copy(opponent.position);
  updateStick(opponent, STEP);
  state.players.push(opponent);
  return opponent;
};

test("Q and E glance rather than curl", (): void => {
  const controls = freshControls();
  pollMovement(controls, new Set(["KeyE"]));
  expect(controls.glance).toBe(1);
  expect(controls.curl).toBe(0);
  pollMovement(controls, new Set(["KeyQ"]));
  expect(controls.glance).toBe(-1);
  expect(controls.curl).toBe(0);
  pollMovement(controls, new Set(["KeyQ", "KeyE"]));
  expect(controls.glance).toBe(0);
  pollMovement(controls, new Set());
  expect(controls.glance).toBe(0);
});

test("uncontested contact keeps a puck at the blade while accelerating and turning", (): void => {
  const { state, player } = setup();
  player.position.x = 3;
  resetPracticePuck(state);
  advance(state, 0.15);
  expect(state.puck.lastTouch).toBe(player.id);
  expect(state.puck.controlKind).toBe("carry");
  for (const unused of Array.from({ length: 480 })) {
    void unused;
    stepSimulation(
      state,
      { ...freshControls(), forward: 1, sprint: true, yawDelta: 0.004 },
      STEP,
    );
    expect(
      state.puck.position.distanceTo(puckSeat(player).setY(PUCK_HEIGHT)),
    ).toBeLessThan(0.05);
    expect(state.puck.controlOwner).toBe(player.id);
  }
});

test("opposing stick challenges disable assistance, but nearby bodies do not", (): void => {
  const { state, player } = setup();
  advance(state, 0.1);
  const opponent = addOpponent(state, 0.72);
  expect(isPuckContested(state, player)).toBe(false);
  advance(state, 0.05);
  expect(state.puck.controlOwner).toBe(player.id);
  opponent.position
    .add(state.puck.position.clone().sub(puckSeat(opponent)))
    .setY(0.36);
  opponent.target.copy(opponent.position);
  updateStick(opponent, STEP);
  opponent.previousStick.copy(opponent.stick);
  expect(isPuckContested(state, player)).toBe(true);
  advance(state, STEP);
  expect(state.puck.controlOwner).not.toBe(player.id);
  opponent.team = 0;
  expect(isPuckContested(state, player)).toBe(false);
});

test("a teammate's overlapping blade cannot accidentally steal a held puck", (): void => {
  const { state, player } = setup();
  advance(state, 0.1);
  const teammate = addOpponent(state, 0.72);
  teammate.team = player.team;
  teammate.position
    .add(state.puck.position.clone().sub(puckSeat(teammate)))
    .setY(0.36);
  teammate.target.copy(teammate.position);
  updateStick(teammate, STEP);
  teammate.previousStick.copy(teammate.stick);
  advance(state, 0.15);
  expect(state.puck.controlOwner).toBe(player.id);
  expect(player.curlBlockedUntil).toBe(0);
});

test("shooting clears carry and rolls the hook upward while the shaft sweeps forward", (): void => {
  const { state, player } = setup();
  advance(state, 0.1);
  stepSimulation(state, { ...freshControls(), shot: 1 }, STEP);
  const motion = { up: 0, forward: 0, shaftRise: 0 };
  for (const unused of Array.from({ length: 40 })) {
    void unused;
    stepSimulation(state, freshControls(), STEP);
    const tip = bladePoint(player, STICK_TIP).sub(
      bladePoint(player, STICK_GRIP),
    );
    const root = bladePoint(player, HOOK_ROOT).sub(
      bladePoint(player, STICK_GRIP),
    );
    motion.up = Math.max(motion.up, tip.y - root.y);
    motion.shaftRise = Math.max(motion.shaftRise, Math.abs(root.y));
    if (shotProgress(player) > SHOT_RELEASE && shotProgress(player) < 0.8)
      motion.forward = Math.max(motion.forward, -tip.z);
  }
  expect(motion.up).toBeGreaterThan(0.085);
  expect(motion.shaftRise).toBeLessThan(0.04);
  expect(motion.forward).toBeGreaterThan(0.15);
  expect(state.shots).toBe(1);
  expect(state.puck.controlOwner).toBeUndefined();
  expect(state.puck.velocity.z).toBeLessThan(-2);
});

test("surfacing releases the puck and swimming attaches the grip to the front paw", (): void => {
  const { state, player } = setup();
  advance(state, 0.1);
  advance(state, 0.5, { ...freshControls(), vertical: 1 });
  expect(state.puck.controlOwner).toBeUndefined();
  for (const pitch of [-0.65, 0, 0.5]) {
    player.position.set(1, 1.4, 2);
    player.yaw = 0.6;
    player.bodyPitch = pitch;
    player.bodyRoll = 0.15;
    updateStick(player, STEP);
    const paw = FRONT_PAW.clone()
      .applyAxisAngle(new Vector3(1, 0, 0), pitch)
      .applyAxisAngle(new Vector3(0, 0, 1), player.bodyRoll)
      .applyAxisAngle(new Vector3(0, 1, 0), player.yaw)
      .add(player.position);
    expect(bladePoint(player, STICK_GRIP).distanceTo(paw)).toBeLessThan(0.0001);
    expect(player.stick.y).toBeGreaterThan(1);
  }
});
