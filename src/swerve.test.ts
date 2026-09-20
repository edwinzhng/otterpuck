import { expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";
import { isPuckContested } from "./handling";
import { createSimulation, stepSimulation, updateStick } from "./simulation";
import { bladePoint, puckSeat, STICK_GRIP } from "./stick";
import {
  CAMERA_OFFSET,
  type Controls,
  FLOOR_HEIGHT,
  freshControls,
  type Handedness,
  type Player,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
} from "./types";

const setup = (
  hand: Handedness = "right",
  yaw = 0,
): { state: Simulation; player: Player } => {
  const state = createSimulation("2-3-1", "2-3-1", "playground", 180, hand);
  const player = state.players.at(0);
  if (!player) throw new Error("Swimmer missing");
  player.yaw = yaw;
  updateStick(player, STEP);
  player.previousStick.copy(player.stick);
  state.puck.position.copy(puckSeat(player)).setY(PUCK_HEIGHT);
  state.puck.previous.copy(state.puck.position);
  state.puck.controlOwner = player.id;
  state.puck.controlKind = "carry";
  return { state, player };
};

const localPuck = (state: Simulation, player: Player): Vector3 =>
  state.puck.position
    .clone()
    .sub(player.position)
    .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);

const advance = (
  state: Simulation,
  player: Player,
  seconds: number,
  controls: Controls = freshControls(),
): void => {
  for (const unused of Array.from({ length: Math.ceil(seconds / STEP) })) {
    void unused;
    const previousPuck = state.puck.position.clone();
    const previousGrip = bladePoint(player, STICK_GRIP);
    const previousBody = player.position.clone();
    stepSimulation(state, controls, STEP);
    const translation = player.position.clone().sub(previousBody);
    expect(
      state.puck.position.distanceTo(previousPuck.add(translation)),
    ).toBeLessThan(0.033);
    expect(
      bladePoint(player, STICK_GRIP).distanceTo(previousGrip.add(translation)),
    ).toBeLessThan(0.085);
    expect(state.puck.position.y).toBeCloseTo(PUCK_HEIGHT, 5);
  }
};

test("a swerve first draws the puck toward the chest, then extends forward toward the chosen side", (): void => {
  for (const hand of ["right", "left"] as const) {
    for (const direction of [-1, 1]) {
      for (const moving of [false, true]) {
        const { state, player } = setup(hand, 0.9);
        const controls = {
          ...freshControls(),
          dummy: direction,
          lateral: moving ? direction : 0,
          forward: moving ? 1 : 0,
          sprint: moving,
        };
        const origin = localPuck(state, player);
        advance(state, player, 0.12, controls);
        const pulled = localPuck(state, player);
        expect(pulled.z - origin.z).toBeGreaterThan(0.1);
        expect(Math.abs(pulled.x - origin.x)).toBeLessThan(0.09);
        advance(state, player, 0.3, controls);
        const extended = localPuck(state, player);
        expect((extended.x - origin.x) * direction).toBeGreaterThan(0.25);
        expect(extended.z).toBeLessThan(pulled.z - 0.15);
        expect(state.puck.controlOwner).toBe(player.id);
        expect(
          state.puck.position.distanceTo(puckSeat(player).setY(PUCK_HEIGHT)),
        ).toBeLessThan(0.01);
      }
    }
  }
});

test("the puck remains in the first-person field of view throughout both swerve phases", (): void => {
  for (const hand of ["right", "left"] as const) {
    for (const direction of [-1, 1]) {
      const { state, player } = setup(hand, -1.2);
      const camera = new PerspectiveCamera(77, 1, 0.025, 90);
      const controls = {
        ...freshControls(),
        dummy: direction,
        lateral: direction,
        forward: 1,
        sprint: true,
        pitch: -0.6,
      };
      for (const unused of Array.from({ length: 60 })) {
        void unused;
        stepSimulation(state, controls, STEP);
        camera.position
          .copy(player.position)
          .add(
            CAMERA_OFFSET.clone().applyAxisAngle(
              new Vector3(0, 1, 0),
              player.yaw,
            ),
          );
        camera.rotation.order = "YXZ";
        camera.rotation.set(controls.pitch, player.yaw, 0);
        camera.updateMatrixWorld(true);
        const projected = state.puck.position.clone().project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(0.95);
        expect(Math.abs(projected.y)).toBeLessThan(0.85);
        expect(projected.z).toBeLessThan(1);
      }
    }
  }
});

test("holding a swerve does not repeat the pullback, analog changes keep the stroke, and reversing draws back again", (): void => {
  for (const direction of [-1, 1]) {
    const { state, player } = setup();
    const origin = localPuck(state, player);
    const controls = { ...freshControls(), dummy: direction };
    advance(state, player, 0.5, controls);
    const held = localPuck(state, player);
    controls.dummy = direction * 0.35;
    advance(state, player, 0.5, controls);
    expect(localPuck(state, player).distanceTo(held)).toBeLessThan(0.005);
    controls.dummy = -direction;
    advance(state, player, 0.12, controls);
    expect(localPuck(state, player).z - held.z).toBeGreaterThan(0.1);
    advance(state, player, 0.35, controls);
    expect((localPuck(state, player).x - origin.x) * direction).toBeLessThan(
      -0.25,
    );
  }
});

test("releasing at any stage returns the puck smoothly to a shootable carry", (): void => {
  for (const hand of ["right", "left"] as const) {
    for (const duration of [0.05, 0.16, 0.3, 0.5]) {
      const { state, player } = setup(hand);
      const origin = localPuck(state, player);
      advance(state, player, duration, { ...freshControls(), dummy: 1 });
      advance(state, player, 0.55);
      expect(localPuck(state, player).distanceTo(origin)).toBeLessThan(0.025);
      expect(player.cradle).toBeUndefined();
      expect(state.puck.controlKind).toBe("carry");
      stepSimulation(state, { ...freshControls(), shot: 0.8 }, STEP);
      for (const unused of Array.from({ length: 30 })) {
        void unused;
        stepSimulation(state, freshControls(), STEP);
      }
      expect(state.shots).toBe(1);
      expect(state.puck.controlOwner).toBeUndefined();
      expect(state.puck.velocity.z).toBeLessThan(-2);
    }
  }
});

test("surfacing or an opposing blade cancels the assisted swerve", (): void => {
  const rising = setup();
  const controls = { ...freshControls(), dummy: 1 };
  advance(rising.state, rising.player, 0.1, controls);
  stepSimulation(rising.state, { ...controls, vertical: 1 }, STEP);
  expect(rising.player.cradle).toBeUndefined();
  expect(rising.state.puck.controlOwner).toBeUndefined();

  const { state, player } = setup();
  advance(state, player, 0.1, controls);
  const opponent = createSimulation().players.at(6);
  if (!opponent) throw new Error("Opponent missing");
  opponent.wallReady = false;
  opponent.position.copy(state.puck.position).setY(FLOOR_HEIGHT);
  updateStick(opponent, STEP);
  opponent.position
    .add(state.puck.position.clone().sub(puckSeat(opponent)))
    .setY(FLOOR_HEIGHT);
  opponent.target.copy(opponent.position);
  opponent.previous.copy(opponent.position);
  updateStick(opponent, STEP);
  opponent.previousStick.copy(opponent.stick);
  state.players.push(opponent);
  expect(isPuckContested(state, player)).toBe(true);
  stepSimulation(state, controls, STEP);
  expect(player.cradle).toBeUndefined();
  expect(state.puck.controlOwner).not.toBe(player.id);
});

test("bot evasion uses the same pullback and directional extension", (): void => {
  for (const direction of [-1, 1]) {
    const { state, player } = setup();
    player.human = false;
    player.target.copy(player.position).add(new Vector3(0, 0, -5));
    player.evadeSide = direction;
    player.evadeUntil = 1;
    player.evadeTarget.copy(player.position).add(new Vector3(direction, 0, -2));
    const origin = localPuck(state, player);
    advance(state, player, 0.12);
    expect(localPuck(state, player).z - origin.z).toBeGreaterThan(0.1);
    advance(state, player, 0.3);
    expect((localPuck(state, player).x - origin.x) * direction).toBeGreaterThan(
      0.25,
    );
    expect(state.puck.controlKind).toBe("dummy");
  }
});
