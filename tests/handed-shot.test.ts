import { expect, test } from "bun:test";
import { PerspectiveCamera } from "three";
import { handlingPitch } from "../src/handling";
import {
  createSimulation,
  resetPracticePuck,
  setPlayerHandedness,
  stepSimulation,
} from "../src/simulation";
import { bladePoint, puckSeat, STICK_GRIP, STICK_TIP } from "../src/stick";
import {
  CAMERA_OFFSET,
  type Controls,
  freshControls,
  type Handedness,
  type Player,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
} from "../src/types";

const setup = (
  hand: Handedness = "right",
): { state: Simulation; player: Player } => {
  const state = createSimulation("2-3-1", "2-3-1", "playground", 180, hand);
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

test("right hand is the default and left hand mirrors the grip, hook, and contact face", (): void => {
  const right = setup();
  const left = setup("left");
  expect(right.player.handedness).toBe("right");
  for (const point of [STICK_GRIP, STICK_TIP]) {
    const a = bladePoint(right.player, point).sub(right.player.position);
    const b = bladePoint(left.player, point).sub(left.player.position);
    expect(a.x).toBeCloseTo(-b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
    expect(a.z).toBeCloseTo(b.z, 6);
  }
  expect(bladePoint(right.player, STICK_GRIP).x).toBeGreaterThan(0.1);
  expect(bladePoint(right.player, STICK_TIP).x).toBeLessThan(
    bladePoint(right.player, STICK_GRIP).x,
  );
  expect(bladePoint(left.player, STICK_GRIP).x).toBeLessThan(-0.1);
  expect(right.state.puck.position.x).toBeCloseTo(
    -left.state.puck.position.x,
    6,
  );
});

test("changing hands cancels a charged move without moving the puck and survives a reset", (): void => {
  const { state, player } = setup();
  advance(state, 0.1);
  advance(state, 0.65, { ...freshControls(), charging: true, charge: 1 });
  const puckPosition = state.puck.position.clone();
  setPlayerHandedness(state, "left");
  expect(player.handedness).toBe("left");
  expect(player.charging).toBe(false);
  expect(state.puck.controlOwner).toBeUndefined();
  expect(state.puck.position.distanceTo(puckPosition)).toBe(0);
  resetPracticePuck(state);
  expect(player.handedness).toBe("left");
  expect(bladePoint(player, STICK_GRIP).x).toBeLessThan(0);
});

test("holding left click smoothly draws an owned puck back into view without shooting", (): void => {
  for (const hand of ["right", "left"] as const) {
    const { state, player } = setup(hand);
    advance(state, 0.1);
    const start = state.puck.position.clone();
    const motion = { maximumStep: 0 };
    const camera = new PerspectiveCamera(77, 1.5, 0.025, 90);
    for (const frame of Array.from(
      { length: 100 },
      (_unused, index): number => index,
    )) {
      const previous = state.puck.position.clone();
      const controls = {
        ...freshControls(),
        charging: true,
        charge: Math.min(1, (frame * STEP) / 0.65),
      };
      stepSimulation(state, controls, STEP);
      motion.maximumStep = Math.max(
        motion.maximumStep,
        previous.distanceTo(state.puck.position),
      );
      camera.position.copy(player.position).add(CAMERA_OFFSET);
      camera.rotation.x = handlingPitch(player, state, controls.pitch);
      camera.updateMatrixWorld(true);
      const projected = state.puck.position.clone().project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(0.8);
      expect(Math.abs(projected.y)).toBeLessThan(0.9);
    }
    expect(state.shots).toBe(0);
    expect(state.puck.controlKind).toBe("charge");
    expect(state.puck.position.z - start.z).toBeGreaterThan(0.15);
    expect(motion.maximumStep).toBeLessThan(0.035);
    expect(
      state.puck.position.distanceTo(puckSeat(player).setY(PUCK_HEIGHT)),
    ).toBeLessThan(0.01);
  }
});

test("release fires once, a longer charge shoots farther, and a full drawn shot stays within three metres", (): void => {
  for (const hand of ["right", "left"] as const) {
    const ranges = [0.22, 1].map((power): number => {
      const { state } = setup(hand);
      advance(state, 0.1);
      const start = state.puck.position.clone();
      advance(state, 0.8, {
        ...freshControls(),
        charging: true,
        charge: power,
      });
      stepSimulation(state, { ...freshControls(), shot: power }, STEP);
      advance(state, 8);
      expect(state.shots).toBe(1);
      expect(state.puck.controlOwner).toBeUndefined();
      return Math.hypot(
        state.puck.position.x - start.x,
        state.puck.position.z - start.z,
      );
    });
    expect(ranges.at(1) ?? 0).toBeGreaterThan((ranges.at(0) ?? 0) + 0.6);
    expect(ranges.at(1) ?? 0).toBeGreaterThan(2);
    expect(ranges.at(1) ?? 0).toBeLessThan(3);
  }
});

test("canceling a charge returns the puck without firing and charging cannot attract a distant puck", (): void => {
  const { state, player } = setup();
  advance(state, 0.1);
  advance(state, 0.7, { ...freshControls(), charging: true, charge: 1 });
  advance(state, 0.6);
  expect(state.shots).toBe(0);
  expect(player.shotDraw).toBeLessThan(0.01);
  expect(
    state.puck.position.distanceTo(puckSeat(player).setY(PUCK_HEIGHT)),
  ).toBeLessThan(0.01);
  resetPracticePuck(state);
  state.puck.position.set(4, PUCK_HEIGHT, 0);
  const far = state.puck.position.clone();
  advance(state, 0.8, { ...freshControls(), charging: true, charge: 1 });
  stepSimulation(state, { ...freshControls(), shot: 1 }, STEP);
  advance(state, 0.6);
  expect(state.shots).toBe(0);
  expect(state.puck.position.distanceTo(far)).toBe(0);
});
