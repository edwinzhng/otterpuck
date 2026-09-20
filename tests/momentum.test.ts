import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { pollMovement } from "../src/handling";
import { RULESETS } from "../src/rules";
import {
  createSimulation,
  stepSimulation,
  updateStick,
} from "../src/simulation";
import {
  bladePoint,
  puckSeat,
  SHOT_APPROACH,
  STICK_GRIP,
  shotProgress,
} from "../src/stick";
import {
  type Controls,
  forwardVector,
  freshControls,
  type Handedness,
  type Player,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
} from "../src/types";

const setup = (
  hand: Handedness = "right",
  yaw = 0,
): { state: Simulation; player: Player } => {
  const state = createSimulation("2-3-1", "2-3-1", "playground", 180, hand);
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  player.position.set(5 * Math.sin(yaw), player.position.y, 5 * Math.cos(yaw));
  player.yaw = yaw;
  updateStick(player, STEP);
  player.previousStick.copy(player.stick);
  state.puck.position.copy(puckSeat(player)).setY(PUCK_HEIGHT);
  state.puck.previous.copy(state.puck.position);
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
const horizontalSpeed = (player: Player): number =>
  Math.hypot(player.velocity.x, player.velocity.z);

test("releasing movement stops a sprint with a short smooth slowdown", (): void => {
  const { state, player } = setup();
  advance(state, 2, { ...freshControls(), forward: 1, sprint: true });
  const speed = horizontalSpeed(player);
  expect(speed).toBeGreaterThan(2.8);
  const origin = player.position.clone();
  stepSimulation(state, freshControls(), STEP);
  expect(horizontalSpeed(player)).toBeGreaterThan(speed * 0.7);
  advance(state, 0.2);
  expect(horizontalSpeed(player)).toBeLessThan(speed * 0.05);
  advance(state, 0.4);
  expect(player.position.distanceTo(origin)).toBeLessThan(0.25);
  expect(player.position.distanceTo(origin)).toBeGreaterThan(0.1);
  expect(horizontalSpeed(player)).toBeLessThan(0.02);
});

test("S brakes more firmly without damping vertical swimming", (): void => {
  const { state, player } = setup();
  advance(state, 2, { ...freshControls(), forward: 1, sprint: true });
  const origin = player.position.clone();
  advance(state, 0.15, { ...freshControls(), forward: -1 });
  expect(horizontalSpeed(player)).toBeLessThan(0.15);
  expect(player.position.distanceTo(origin)).toBeLessThan(0.16);
  const rising = setup();
  const braking = setup();
  for (const entry of [rising, braking]) {
    entry.player.position.y = 1;
    entry.player.velocity.y = 0.8;
  }
  stepSimulation(rising.state, { ...freshControls(), vertical: 1 }, STEP);
  stepSimulation(
    braking.state,
    { ...freshControls(), vertical: 1, forward: -1 },
    STEP,
  );
  expect(braking.player.velocity.y).toBeCloseTo(rising.player.velocity.y, 8);
});

test("side input turns the swimmer, releasing it holds the new course, and opposite input carves back", (): void => {
  const { state, player } = setup();
  advance(state, 1, { ...freshControls(), forward: 1, lateral: 1 });
  expect(player.velocity.x).toBeGreaterThan(0.8);
  const heading = player.yaw;
  advance(state, 0.2, { ...freshControls(), forward: 1 });
  expect(player.yaw).toBeCloseTo(heading, 8);
  expect(
    player.velocity.clone().normalize().dot(forwardVector(heading)),
  ).toBeCloseTo(1, 8);
  advance(state, 0.2, { ...freshControls(), forward: 1, lateral: -1 });
  expect(player.yaw).toBeGreaterThan(heading + 0.3);
  advance(state, 1.1, { ...freshControls(), forward: 1, lateral: -1 });
  expect(player.velocity.x).toBeLessThan(-0.7);
  expect(player.velocity.z).toBeLessThan(-0.7);
});

test("sprinting does not add air drain during cruising or puck work", (): void => {
  for (const engaged of [false, true]) {
    const consumed = [false, true].map((sprint): number => {
      const { state, player } = setup();
      state.mode = "practice";
      state.puck.position.set(5, PUCK_HEIGHT, 5);
      advance(state, 5 * RULESETS.alternative.airSupply, {
        ...freshControls(),
        forward: 1,
        sprint,
        dummy: engaged ? 1 : 0,
      });
      return 100 - player.air;
    });
    const normal = consumed.at(0) ?? 0;
    const sprint = consumed.at(1) ?? 0;
    expect(sprint).toBeCloseTo(normal, 8);
  }
});

test("a moving shot keeps the loaded puck and paw ahead through the stroke and inherits swimming speed at release", (): void => {
  for (const hand of ["right", "left"] as const) {
    for (const yaw of [0, 0.8, -1.1]) {
      for (const power of [0.22, 1]) {
        const { state, player } = setup(hand, yaw);
        const controls = { ...freshControls(), forward: 1, sprint: true };
        advance(state, 1.2, controls);
        advance(state, 0.8, { ...controls, charging: true, charge: power });
        const forward = new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const initialOffset = state.puck.position.clone().sub(player.position);
        const motion = {
          released: false,
          landed: false,
          peak: PUCK_HEIGHT,
          minimumLead: Infinity,
        };
        stepSimulation(state, { ...controls, shot: power }, STEP);
        for (const unused of Array.from({ length: 150 })) {
          void unused;
          stepSimulation(state, { ...controls }, STEP);
          const offset = state.puck.position.clone().sub(player.position);
          const lead = offset.dot(forward);
          if (state.shots === 0 && shotProgress(player) < SHOT_APPROACH) {
            expect(
              offset.clone().setY(0).distanceTo(initialOffset.clone().setY(0)),
            ).toBeLessThan(0.04);
          }
          if (!motion.released && state.shots > 0) {
            motion.released = true;
            expect(state.puck.velocity.dot(forward)).toBeGreaterThan(
              2.2 + power * 2.8 + 1.5,
            );
            expect(state.puck.velocity.dot(forward)).toBeGreaterThan(
              player.velocity.dot(forward) + 1,
            );
          }
          if (player.shotTime > 0) {
            const grip = bladePoint(player, STICK_GRIP).sub(player.position);
            expect(grip.dot(forward)).toBeGreaterThan(0.05);
          }
          motion.peak = Math.max(motion.peak, state.puck.position.y);
          if (motion.released && state.puck.position.y === PUCK_HEIGHT)
            motion.landed = true;
          if (!motion.landed)
            motion.minimumLead = Math.min(motion.minimumLead, lead);
          if (motion.landed) break;
        }
        expect(state.shots).toBe(1);
        expect(motion.landed).toBe(true);
        expect(motion.peak).toBeGreaterThan(0.14);
        expect(motion.minimumLead).toBeGreaterThan(0.25);
      }
    }
  }
});

test("RMB swerving preserves steering and propulsion, including when RMB is released", (): void => {
  for (const hand of ["right", "left"] as const) {
    for (const key of ["KeyA", "KeyD"]) {
      const swerving = setup(hand, 0.6);
      const strafing = setup(hand, 0.6);
      const keys = new Set([key, "KeyW", "ShiftLeft"]);
      const controls = { ...freshControls(), dummyMode: true };
      const ordinary = freshControls();
      pollMovement(controls, keys);
      pollMovement(ordinary, keys);
      advance(swerving.state, 0.6, controls);
      advance(strafing.state, 0.6, ordinary);
      expect(
        swerving.player.position.distanceTo(strafing.player.position),
      ).toBeLessThan(0.001);
      const right = new Vector3(Math.cos(0.6), 0, -Math.sin(0.6));
      const direction = key === "KeyA" ? -1 : 1;
      expect(swerving.player.velocity.dot(right) * direction).toBeGreaterThan(
        1,
      );
      expect(swerving.state.puck.controlKind).toBe("dummy");
      expect(
        swerving.state.puck.position.distanceTo(
          puckSeat(swerving.player).setY(PUCK_HEIGHT),
        ),
      ).toBeLessThan(0.03);
      const speed = swerving.player.velocity.dot(right) * direction;
      controls.dummyMode = false;
      pollMovement(controls, keys);
      advance(swerving.state, 0.1, controls);
      expect(swerving.player.velocity.dot(right) * direction).toBeGreaterThan(
        speed * 0.95,
      );
      expect(controls.dummy).toBe(0);
      expect(controls.lateral).toBe(direction);
    }
  }
});
