import { expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";
import {
  canKnockdown,
  KNOCKDOWN_DURATION,
  KNOCKDOWN_HIT_TIME,
  pollMovement,
} from "./handling";
import {
  createSimulation,
  feedPracticePuck,
  requestShot,
  resetPracticePuck,
  stepSimulation,
} from "./simulation";
import { bladePoint, puckSeat, STICK_GRIP } from "./stick";
import {
  CAMERA_OFFSET,
  type Controls,
  freshControls,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
  STICK_EDGE,
} from "./types";

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
const setup = (): {
  state: Simulation;
  player: Simulation["players"][number];
} => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  return { state, player };
};

test("RMB adds a dummy to A/D while keeping steering active", (): void => {
  const controls = freshControls();
  const keys = new Set(["KeyA", "KeyW"]);
  pollMovement(controls, keys);
  expect(controls.lateral).toBe(-1);
  expect(controls.dummy).toBe(0);
  controls.dummyMode = true;
  pollMovement(controls, keys);
  expect(controls.lateral).toBe(-1);
  expect(controls.dummy).toBe(-1);
  expect(controls.forward).toBe(1);
  keys.add("KeyD");
  pollMovement(controls, keys);
  expect(controls.dummy).toBe(0);
  expect(controls.lateral).toBe(0);
  keys.delete("KeyA");
  pollMovement(controls, keys);
  expect(controls.dummy).toBe(1);
  expect(controls.lateral).toBe(1);
  controls.dummyMode = false;
  pollMovement(controls, keys);
  expect(controls.dummy).toBe(0);
  expect(controls.lateral).toBe(1);
});

test("both dummies swerve the puck while the swimmer turns without taking a distant puck", (): void => {
  for (const direction of [-1, 1]) {
    const { state, player } = setup();
    const origin = state.puck.position.clone();
    const swimmerOrigin = player.position.clone();
    const controls = { ...freshControls(), dummyMode: true };
    pollMovement(controls, new Set([direction < 0 ? "KeyA" : "KeyD"]));
    const motion = { maximumStep: 0 };
    for (const unused of Array.from({ length: 45 })) {
      void unused;
      const before = state.puck.position.clone();
      stepSimulation(state, controls, STEP);
      motion.maximumStep = Math.max(
        motion.maximumStep,
        before.distanceTo(state.puck.position),
      );
    }
    expect(
      (state.puck.position.x -
        origin.x -
        (player.position.x - swimmerOrigin.x)) *
        direction,
    ).toBeGreaterThan(0.16);
    expect((player.position.x - swimmerOrigin.x) * direction).toBeGreaterThan(
      0.1,
    );
    expect(player.yaw * direction).toBeLessThan(-0.5);
    expect(motion.maximumStep).toBeLessThan(0.04);
    expect(state.puck.controlKind).toBe("dummy");
    state.puck.position.set(4, PUCK_HEIGHT, 0);
    state.puck.velocity.set(0, 0, 0);
    advance(state, 1, controls);
    expect(state.puck.controlOwner).toBeUndefined();
    expect(state.puck.position.x).toBe(4);
  }
});

test("regular and reverse curls stay visible through a full turn and leave a shootable puck in front", (): void => {
  for (const direction of [-1, 1]) {
    const { state, player } = setup();
    const controls = { ...freshControls(), curl: direction, pitch: -0.6 };
    const camera = new PerspectiveCamera(77, 1, 0.025, 90);
    advance(state, 0.25, controls);
    for (const unused of Array.from({ length: 360 })) {
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
      expect(Math.abs(projected.x)).toBeLessThan(0.7);
      expect(Math.abs(projected.y)).toBeLessThan(0.9);
      expect(projected.z).toBeLessThan(1);
    }
    advance(state, 0.45);
    const local = state.puck.position
      .clone()
      .sub(player.position)
      .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
    expect(local.z).toBeLessThan(-0.45);
    expect(Math.abs(local.x)).toBeLessThan(0.26);
    expect(
      state.puck.position.distanceTo(puckSeat(player).setY(PUCK_HEIGHT)),
    ).toBeLessThan(0.08);
    expect(state.puck.velocity.length()).toBeLessThan(0.15);
    stepSimulation(state, { ...freshControls(), shot: 0.7 }, STEP);
    advance(state, 0.24);
    expect(state.shots).toBe(1);
  }
});

test("resting stick clears the tiles, stays visible, and lies across the swimmer", (): void => {
  for (const backhand of [false, true]) {
    const { state, player } = setup();
    advance(state, 0.5, { ...freshControls(), backhand });
    const minimum = Math.min(
      ...STICK_EDGE.map(
        ([x, z]): number => bladePoint(player, new Vector3(x, 0, z)).y,
      ),
    );
    expect(minimum).toBeGreaterThanOrEqual(0.01);
    expect(minimum).toBeLessThan(0.02);
    const tip = bladePoint(player, new Vector3(-0.125, 0, -0.037));
    const grip = bladePoint(player, STICK_GRIP);
    expect(Math.abs(tip.z - grip.z)).toBeLessThan(0.025);
    expect(grip.x - tip.x).toBeGreaterThan(0.23);
    const camera = new PerspectiveCamera(77, 1.5, 0.025, 90);
    camera.position.copy(player.position).add(CAMERA_OFFSET);
    camera.rotation.x = -0.5;
    camera.updateMatrixWorld(true);
    const projected = tip.clone().project(camera);
    expect(Math.abs(projected.x)).toBeLessThan(0.8);
    expect(Math.abs(projected.y)).toBeLessThan(0.9);
  }
});

test("knockdown prompt and reaction reject grounded, distant, rearward, and side pucks", (): void => {
  for (const point of [
    [0, 0.018, -1],
    [0, 0.5, -2],
    [0, 0.5, 1],
    [0.8, 0.5, -1],
    [0, 1.8, -1],
  ]) {
    const { state, player } = setup();
    state.puck.position
      .copy(player.position)
      .add(new Vector3(point.at(0), 0, point.at(2)))
      .setY(point.at(1) ?? 0);
    expect(canKnockdown(state, player)).toBe(false);
    stepSimulation(state, { ...freshControls(), knockdown: true }, STEP);
    expect(player.knockdownTime).toBe(0);
    expect(player.knockdownAttempted).toBe(false);
  }
});

test("a knockdown needs a new press, respects cooldown, and misses if the puck leaves its box", (): void => {
  const { state, player } = setup();
  state.puck.position.copy(player.position).add(new Vector3(0, 0.2, -1.05));
  expect(canKnockdown(state, player)).toBe(true);
  advance(state, 0.04);
  expect(state.puck.lastTouch).toBeUndefined();
  const controls = { ...freshControls(), knockdown: true };
  stepSimulation(state, controls, STEP);
  expect(controls.knockdown).toBe(false);
  advance(state, KNOCKDOWN_HIT_TIME + STEP);
  expect(state.puck.velocity.y).toBeLessThan(-2);
  expect(state.puck.lastTouch).toBe(0);
  expect(canKnockdown(state, player)).toBe(false);
  advance(state, 0.55);
  state.puck.position.copy(player.position).add(new Vector3(0, 0.2, -1.05));
  state.puck.velocity.set(15, 0, 0);
  state.puck.lastTouch = undefined;
  stepSimulation(state, { ...freshControls(), knockdown: true }, STEP);
  advance(state, 0.12);
  expect(state.puck.lastTouch).toBeUndefined();
});

test("the lab's incoming feed gives a usable knockdown prompt window", (): void => {
  const { state, player } = setup();
  feedPracticePuck(state);
  const prompt = { seconds: 0 };
  for (const unused of Array.from({ length: 180 })) {
    void unused;
    stepSimulation(state, freshControls(), STEP);
    if (canKnockdown(state, player)) prompt.seconds += STEP;
  }
  expect(prompt.seconds).toBeGreaterThan(0.2);
});

test("full flicks stop between two and three metres and a flat push dies quickly", (): void => {
  for (const backhand of [false, true]) {
    const { state, player } = setup();
    const controls = { ...freshControls(), backhand };
    advance(state, 0.6, controls);
    resetPracticePuck(state);
    const origin = state.puck.position.clone();
    requestShot(player, 1, new Vector3(0, 0, -1));
    advance(state, 8, controls);
    const range = Math.hypot(
      state.puck.position.x - origin.x,
      state.puck.position.z - origin.z,
    );
    expect(range).toBeGreaterThan(2);
    expect(range).toBeLessThan(3);
    expect(state.puck.velocity.length()).toBeLessThan(0.01);
  }
  const { state } = setup();
  state.puck.position.set(4, PUCK_HEIGHT, 0);
  state.puck.velocity.set(0, 0, -2);
  advance(state, 2);
  expect(Math.abs(state.puck.position.z)).toBeLessThan(0.6);
  expect(state.puck.velocity.length()).toBeLessThan(0.01);
});

test("knockdowns stay in front of the face and return smoothly", (): void => {
  for (const handedness of ["left", "right"] as const) {
    const { state, player } = setup();
    player.handedness = handedness;
    advance(state, 0.5);
    const resting = player.stickOffset.clone();
    state.puck.position.copy(player.position).add(new Vector3(0, 0.7, -0.7));
    stepSimulation(state, { ...freshControls(), knockdown: true }, STEP);
    const motion = { peak: 0 };
    for (const unused of Array.from({
      length: Math.ceil((KNOCKDOWN_DURATION + 0.4) / STEP),
    })) {
      void unused;
      const previous = player.stickOffset.clone();
      stepSimulation(state, freshControls(), STEP);
      expect(player.stickOffset.distanceTo(previous)).toBeLessThan(0.035);
      expect(player.stickOffset.y).toBeLessThanOrEqual(0.28);
      expect(player.stickOffset.z).toBeGreaterThanOrEqual(-0.52);
      motion.peak = Math.max(motion.peak, player.stickOffset.y);
    }
    expect(motion.peak).toBeGreaterThan(0.15);
    expect(player.stickOffset.distanceTo(resting)).toBeLessThan(0.01);
  }
});
