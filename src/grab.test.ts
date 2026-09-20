import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { canGrabPuck, KNOCKDOWN_HIT_TIME, puckReaction } from "./handling";
import {
  createSimulation,
  resetPracticePuck,
  stepSimulation,
  updateStick,
} from "./simulation";
import { bladePoint, puckSeat } from "./stick";
import {
  type Controls,
  freshControls,
  type Handedness,
  handSide,
  type Player,
  PUCK_HEIGHT,
  PUCK_RADIUS,
  type Simulation,
  STEP,
  STICK_EDGE,
} from "./types";

const setup = (
  handedness: Handedness = "right",
): { state: Simulation; player: Player } => {
  const state = createSimulation(
    "2-3-1",
    "2-3-1",
    "playground",
    180,
    handedness,
  );
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  state.puck.position
    .copy(player.position)
    .add(new Vector3(0.48 * handSide(player), 0, -0.6))
    .setY(PUCK_HEIGHT);
  state.puck.previous.copy(state.puck.position);
  return { state, player };
};

const advance = (
  state: Simulation,
  frames: number,
  controls: Controls = { ...freshControls(), pitch: -0.5 },
): void => {
  for (const unused of Array.from({ length: frames })) {
    void unused;
    stepSimulation(state, controls, STEP);
  }
};

const bladeDistance = (player: Player, position: Vector3): number =>
  Math.min(
    ...STICK_EDGE.slice(0, -1).map(([x, z], index): number => {
      const end = STICK_EDGE.at(index + 1);
      if (!end) return Infinity;
      const start = bladePoint(player, new Vector3(x, 0, z));
      const edge = bladePoint(player, new Vector3(end[0], 0, end[1])).sub(
        start,
      );
      const fraction = Math.max(
        0,
        Math.min(1, position.clone().sub(start).dot(edge) / edge.lengthSq()),
      );
      return position.distanceTo(start.addScaledVector(edge, fraction));
    }),
  );

test("X reaches a nearby puck before contact, then brings it to the blade smoothly for either hand", (): void => {
  for (const handedness of ["right", "left"] as const) {
    const { state, player } = setup(handedness);
    const origin = state.puck.position.clone();
    expect(puckReaction(state, player, -0.5)).toBe("grab");
    const controls = { ...freshControls(), pitch: -0.5, knockdown: true };
    stepSimulation(state, controls, STEP);
    expect(controls.knockdown).toBe(false);
    expect(player.grab).toBeDefined();
    expect(state.puck.controlOwner).toBeUndefined();
    expect(state.puck.position.distanceTo(origin)).toBe(0);
    const motion = { touched: false, maximumStep: 0 };
    for (const unused of Array.from({ length: 100 })) {
      void unused;
      const before = state.puck.position.clone();
      stepSimulation(state, controls, STEP);
      motion.maximumStep = Math.max(
        motion.maximumStep,
        state.puck.position.distanceTo(before),
      );
      if (!motion.touched && state.puck.controlOwner === player.id) {
        expect(bladeDistance(player, before)).toBeLessThan(PUCK_RADIUS + 0.019);
        motion.touched = true;
      }
      if (!motion.touched)
        expect(state.puck.position.distanceTo(origin)).toBe(0);
    }
    expect(motion.touched).toBe(true);
    expect(motion.maximumStep).toBeLessThan(0.035);
    expect(player.grab).toBeUndefined();
    expect(state.puck.controlOwner).toBe(player.id);
    expect(state.puck.controlKind).toBe("carry");
    expect(
      state.puck.position.distanceTo(puckSeat(player).setY(PUCK_HEIGHT)),
    ).toBeLessThan(0.01);
    expect(puckReaction(state, player, -0.5)).toBeUndefined();
  }
});

test("grab requires a loose grounded puck in arm reach and within the view direction", (): void => {
  const rejects: ReadonlyArray<(state: Simulation, player: Player) => void> = [
    (state): void => {
      state.puck.position.x = 0.8;
    },
    (state, player): void => {
      state.puck.position.z = player.position.z + 0.3;
    },
    (state, player): void => {
      state.puck.position.z = player.position.z - 1.1;
    },
    (state): void => {
      state.puck.position.y = 0.08;
    },
    (state): void => {
      state.puck.controlOwner = 6;
    },
    (state): void => {
      state.puck.shotOwner = 6;
    },
    (_state, player): void => {
      player.position.y = 1;
    },
    (_state, player): void => {
      player.bodyPitch = -0.5;
    },
    (_state, player): void => {
      player.emergency = true;
    },
    (_state, player): void => {
      player.charging = true;
    },
  ];
  for (const reject of rejects) {
    const { state, player } = setup();
    reject(state, player);
    expect(canGrabPuck(state, player, -0.5)).toBe(false);
  }
  const { state, player } = setup();
  expect(canGrabPuck(state, player, 0.6)).toBe(false);
  player.yaw = 1.4;
  expect(canGrabPuck(state, player, -0.5)).toBe(false);
  state.puck.position
    .copy(player.position)
    .add(
      new Vector3(0.48, 0, -0.6).applyAxisAngle(
        new Vector3(0, 1, 0),
        player.yaw,
      ),
    )
    .setY(PUCK_HEIGHT);
  expect(canGrabPuck(state, player, -0.5)).toBe(true);
});

test("X still selects knockdown for an airborne puck", (): void => {
  const { state, player } = setup();
  state.puck.position.copy(player.position).add(new Vector3(0, 0.2, -0.8));
  expect(puckReaction(state, player, -0.5)).toBe("knockdown");
  stepSimulation(
    state,
    { ...freshControls(), pitch: -0.5, knockdown: true },
    STEP,
  );
  expect(player.grab).toBeUndefined();
  expect(player.knockdownTime).toBeGreaterThan(0);
  advance(state, Math.ceil(KNOCKDOWN_HIT_TIME / STEP) + 1);
  expect(state.puck.lastTouch).toBe(player.id);
  expect(state.puck.velocity.y).toBeLessThan(-1);
});

test("a nearby opponent does not cancel a physical reach for a loose puck", (): void => {
  const { state, player } = setup();
  stepSimulation(
    state,
    { ...freshControls(), pitch: -0.5, knockdown: true },
    STEP,
  );
  const opponent = createSimulation().players.at(6);
  if (!opponent) throw new Error("Opponent missing");
  opponent.wallReady = false;
  opponent.mode = "playing";
  opponent.bodyPitch = 0;
  opponent.position
    .copy(state.puck.position)
    .add(new Vector3(0.9, 0, 0))
    .setY(0.36);
  opponent.target.copy(opponent.position);
  opponent.previous.copy(opponent.position);
  updateStick(opponent, STEP);
  state.players.push(opponent);
  const previous = state.puck.position.clone();
  advance(state, 4);
  expect(player.grab).toBeDefined();
  expect(state.puck.controlOwner).toBeUndefined();
  expect(state.puck.position.distanceTo(previous)).toBeLessThan(0.001);
  advance(state, 65);
  expect(state.puck.controlOwner).toBe(player.id);
  expect(player.grab).toBeUndefined();
  expect(
    state.puck.position.distanceTo(puckSeat(player).setY(PUCK_HEIGHT)),
  ).toBeLessThan(0.015);
});

test("looking away, surfacing, a puck leaving reach, and reset cancel a pending grab", (): void => {
  for (const cancellation of ["look", "surface", "escape", "reset"] as const) {
    const { state, player } = setup();
    stepSimulation(
      state,
      { ...freshControls(), pitch: -0.5, knockdown: true },
      STEP,
    );
    expect(player.grab).toBeDefined();
    if (cancellation === "escape") state.puck.position.x = 2;
    if (cancellation === "reset") resetPracticePuck(state);
    else
      stepSimulation(
        state,
        {
          ...freshControls(),
          pitch: cancellation === "look" ? 0.7 : -0.5,
          vertical: cancellation === "surface" ? 1 : 0,
        },
        STEP,
      );
    expect(player.grab).toBeUndefined();
    expect(state.puck.controlOwner).toBeUndefined();
  }
});

test("X reaches beneath the chest and returns the puck forward without requiring exact camera aim", (): void => {
  for (const hand of ["right", "left"] as const) {
    for (const offset of [
      new Vector3(),
      new Vector3(0.16, 0, -0.06),
      new Vector3(-0.12, 0, 0.12),
    ]) {
      const { state, player } = setup(hand);
      player.yaw = 0.8;
      updateStick(player, STEP);
      player.previousStick.copy(player.stick);
      state.puck.position
        .copy(player.position)
        .add(offset.clone().applyAxisAngle(new Vector3(0, 1, 0), player.yaw))
        .setY(PUCK_HEIGHT);
      state.puck.previous.copy(state.puck.position);
      const origin = state.puck.position.clone();
      expect(puckReaction(state, player, 0.2)).toBe("grab");
      const controls = { ...freshControls(), pitch: 0.2, knockdown: true };
      stepSimulation(state, controls, STEP);
      expect(state.puck.position.distanceTo(origin)).toBeLessThan(0.001);
      const motion = { contact: false, maximumStep: 0, maximumStickStep: 0 };
      for (const unused of Array.from({ length: 150 })) {
        void unused;
        const before = state.puck.position.clone();
        const stick = player.stick.clone();
        stepSimulation(state, controls, STEP);
        motion.maximumStep = Math.max(
          motion.maximumStep,
          state.puck.position.distanceTo(before),
        );
        motion.maximumStickStep = Math.max(
          motion.maximumStickStep,
          player.stick.distanceTo(stick),
        );
        if (!motion.contact && state.puck.controlOwner === player.id) {
          expect(bladeDistance(player, before)).toBeLessThan(
            PUCK_RADIUS + 0.019,
          );
          motion.contact = true;
        }
        if (!motion.contact)
          expect(state.puck.position.distanceTo(origin)).toBeLessThan(0.001);
      }
      expect(motion.contact).toBe(true);
      expect(motion.maximumStep).toBeLessThan(0.035);
      expect(motion.maximumStickStep).toBeLessThan(0.15);
      expect(
        state.puck.position.distanceTo(puckSeat(player).setY(PUCK_HEIGHT)),
      ).toBeLessThan(0.01);
      const local = state.puck.position
        .clone()
        .sub(player.position)
        .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
      expect(local.z).toBeLessThan(-0.45);
      expect(player.grab).toBeUndefined();
    }
  }
});
