import { expect, test } from "bun:test";
import { Vector3 } from "three";
import {
  CURL_TURN_SPEED,
  createSimulation,
  stepSimulation,
} from "./simulation";
import {
  bladeMirror,
  bladePoint,
  HOOK_ROOT,
  INSIDE_NORMAL,
  mirrorBladePoint,
  REST_BLADE_YAW,
  SHOT_APPROACH,
  SHOT_CONTACT,
  STICK_GRIP,
  STICK_TIP,
  shotProgress,
} from "./stick";
import {
  angleDifference,
  type Controls,
  freshControls,
  type Handedness,
  handSide,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
  STICK_EDGE,
} from "./types";

const setup = (hand: Handedness): Simulation =>
  createSimulation("2-3-1", "2-3-1", "playground", 180, hand);
const advance = (
  state: Simulation,
  frames: number,
  controls: Controls = freshControls(),
): void => {
  for (const unused of Array.from({ length: frames })) {
    void unused;
    stepSimulation(state, controls, STEP);
  }
};

test("both curls engage promptly and cradle the puck on the inside throughout a smooth turn", (): void => {
  for (const hand of ["right", "left"] as const) {
    for (const curl of [1, -1]) {
      const state = setup(hand);
      const player = state.players.at(0);
      if (!player) throw new Error("Player missing");
      const origin = state.puck.position.clone();
      const controls = { ...freshControls(), curl };
      advance(state, 6, controls);
      expect(Math.abs(player.yaw)).toBeGreaterThan(0.04);
      expect(state.puck.position.distanceTo(origin)).toBeLessThan(0.08);
      advance(state, 18, controls);
      expect(Math.abs(player.yaw)).toBeGreaterThan(0.3);
      expect(player.bladeFace).toBeGreaterThan(0.98);
      for (const unused of Array.from({ length: 420 })) {
        void unused;
        const before = state.puck.position.clone();
        stepSimulation(state, controls, STEP);
        expect(state.puck.position.distanceTo(before)).toBeLessThan(
          3.5 * STEP + 0.001,
        );
        const insideEdge = bladePoint(player, new Vector3(-0.052, 0, 0.027));
        const normal = mirrorBladePoint(player, INSIDE_NORMAL)
          .applyQuaternion(player.stickOrientation)
          .setY(0)
          .normalize();
        expect(
          state.puck.position.clone().sub(insideEdge).dot(normal),
        ).toBeGreaterThan(0.03);
        if (curl < 0 && (player.cradle?.elapsed ?? 0) > 0.7) {
          expect(
            normal.dot(state.puck.velocity.clone().setY(0).normalize()),
          ).toBeGreaterThan(0.98);
          const grip = bladePoint(player, STICK_GRIP)
            .sub(player.position)
            .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
          expect(grip.x * handSide(player)).toBeGreaterThan(0.27);
          expect(grip.x * handSide(player)).toBeLessThan(0.36);
        }
      }
      expect(Math.abs(player.yaw)).toBeGreaterThan(6);
      const tipHeight =
        bladePoint(player, STICK_TIP).y - bladePoint(player, HOOK_ROOT).y;
      if (curl < 0) expect(tipHeight).toBeGreaterThan(0.018);
      else expect(Math.abs(tipHeight)).toBeLessThan(0.001);
      advance(state, 60);
      expect(state.puck.controlKind).toBe("carry");
    }
  }
});

test("changing curl direction eases through the reversal and release settles promptly without losing the puck", (): void => {
  for (const hand of ["right", "left"] as const) {
    const state = setup(hand);
    const player = state.players.at(0);
    if (!player) throw new Error("Player missing");
    advance(state, 30, { ...freshControls(), curl: 1 });
    expect(player.curlTurnSpeed).toBeGreaterThan(2);
    const initial = player.curlTurnSpeed;
    stepSimulation(state, { ...freshControls(), curl: -1 }, STEP);
    expect(player.curlTurnSpeed).toBeGreaterThan(0);
    expect(initial - player.curlTurnSpeed).toBeLessThan(CURL_TURN_SPEED * 0.5);
    advance(state, 12, { ...freshControls(), curl: -1 });
    expect(player.curlTurnSpeed).toBeLessThan(-1.7);
    const yawAtRelease = player.yaw;
    advance(state, 60);
    expect(Math.abs(player.yaw - yawAtRelease)).toBeLessThan(0.065);
    expect(player.curlTurnSpeed).toBe(0);
    expect(state.puck.controlOwner).toBe(player.id);
    expect(state.puck.controlKind).toBe("carry");
  }
});

test("steering turns the wrist directly while a swerve tucks before its mirrored outward stroke", (): void => {
  for (const hand of ["right", "left"] as const) {
    for (const direction of [-1, 1]) {
      for (const swerve of [false, true]) {
        const state = setup(hand);
        const player = state.players.at(0);
        if (!player) throw new Error("Player missing");
        advance(state, 12);
        const origin = state.puck.position.clone();
        const controls = {
          ...freshControls(),
          lateral: direction,
          dummy: swerve ? direction : 0,
        };
        advance(state, swerve ? 12 : 10, controls);
        if (swerve) {
          expect(player.bladeFace).toBeGreaterThan(0.65);
          expect(
            Math.abs(angleDifference(player.bladeRotation, REST_BLADE_YAW)),
          ).toBeLessThan(0.03);
          advance(state, 42, controls);
        }
        const turn = angleDifference(
          player.stickYaw,
          player.yaw + REST_BLADE_YAW * bladeMirror(player),
        );
        expect(turn * direction * bladeMirror(player)).toBeGreaterThan(0.2);
        expect((state.puck.position.x - origin.x) * direction).toBeGreaterThan(
          0.01,
        );
        expect(player.bladeFace).toBeLessThan(0.01);
      }
    }
  }
});

test("the entire resting blade lies flat at tile height", (): void => {
  for (const hand of ["right", "left"] as const) {
    const player = setup(hand).players.at(0);
    if (!player) throw new Error("Player missing");
    const heights = STICK_EDGE.map(
      ([x, z]): number => bladePoint(player, new Vector3(x, 0, z)).y,
    );
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.001);
    expect(Math.min(...heights)).toBeCloseTo(PUCK_HEIGHT, 6);
  }
});

test("charged shots draw behind the blade and fly straight through one clean arc without tumble or rebound", (): void => {
  for (const hand of ["right", "left"] as const) {
    for (const backhand of [false, true]) {
      for (const power of [0.22, 1]) {
        const state = setup(hand);
        const player = state.players.at(0);
        if (!player) throw new Error("Player missing");
        const controls = { ...freshControls(), backhand };
        advance(state, 60, controls);
        const start = state.puck.position.clone();
        advance(state, 100, { ...controls, charging: true, charge: power });
        expect(state.puck.position.z).toBeGreaterThan(start.z + 0.02);
        expect(state.puck.position.z).toBeGreaterThan(
          bladePoint(player, new Vector3(-0.067, 0, 0.024)).z,
        );
        const origin = state.puck.position.clone();
        stepSimulation(state, { ...controls, shot: power }, STEP);
        const path = {
          descending: false,
          landed: false,
          peak: PUCK_HEIGHT,
          maxStep: 0,
        };
        for (const unused of Array.from({ length: 500 })) {
          void unused;
          const previous = state.puck.position.clone();
          stepSimulation(state, { ...controls, yawDelta: 0.003 }, STEP);
          const puck = state.puck;
          path.maxStep = Math.max(
            path.maxStep,
            puck.position.distanceTo(previous),
          );
          expect(puck.position.x).toBeCloseTo(origin.x, 6);
          expect(puck.position.z).toBeLessThanOrEqual(previous.z + 0.000001);
          const normal = new Vector3(0, 1, 0).applyQuaternion(puck.orientation);
          if (puck.flightOrientation)
            expect(
              puck.orientation.angleTo(puck.flightOrientation),
            ).toBeLessThan(
              puck.velocity.y < 0 && puck.position.y < 0.14 ? Math.PI : 0.001,
            );
          if (state.shots > 0 && puck.position.y > 0.14)
            expect(Math.abs(normal.y)).toBeLessThan(0.001);
          expect(puck.angularVelocity.length()).toBe(0);
          if (player.shotTime > 0.14 && player.shotTime < 0.25) {
            const tipDirection = bladePoint(player, STICK_TIP)
              .sub(bladePoint(player, STICK_GRIP))
              .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
            expect(tipDirection.x * handSide(player)).toBeLessThan(0.001);
            if (player.shotTime < 0.17)
              expect(tipDirection.z).toBeLessThan(-0.1);
          }
          path.peak = Math.max(path.peak, puck.position.y);
          if (state.shots === 0) continue;
          if (puck.velocity.y < 0) path.descending = true;
          if (path.descending)
            expect(puck.position.y).toBeLessThanOrEqual(previous.y + 0.000001);
          if (path.descending && puck.position.y === PUCK_HEIGHT)
            path.landed = true;
          if (path.landed) expect(puck.velocity.y).toBe(0);
        }
        expect(state.shots).toBe(1);
        expect(path.peak).toBeGreaterThan(0.14);
        expect(path.landed).toBe(true);
        expect(path.maxStep).toBeLessThan(0.05);
      }
    }
  }
});

test("a shot puts the blade behind the loaded puck before it pushes and rolls upward", (): void => {
  for (const hand of ["right", "left"] as const) {
    const state = setup(hand);
    const player = state.players.at(0);
    if (!player) throw new Error("Player missing");
    advance(state, 90, { ...freshControls(), charging: true, charge: 1 });
    const origin = state.puck.position.clone();
    stepSimulation(state, { ...freshControls(), shot: 1 }, STEP);
    for (const unused of Array.from({ length: 10 })) {
      void unused;
      stepSimulation(state, freshControls(), STEP);
      expect(shotProgress(player)).toBeLessThan(SHOT_APPROACH);
      expect(state.puck.position.distanceTo(origin)).toBeLessThan(0.001);
    }
    stepSimulation(state, freshControls(), STEP);
    const contact = bladePoint(player, SHOT_CONTACT).sub(state.puck.position);
    expect(contact.dot(player.shotDirection)).toBeLessThan(-0.025);
    expect(Math.abs(contact.x)).toBeLessThan(0.005);
    expect(Math.abs(contact.y)).toBeLessThan(0.005);
    expect(state.shots).toBe(0);
    advance(state, 17);
    expect(state.shots).toBe(1);
    const tip = bladePoint(player, STICK_TIP);
    const root = bladePoint(player, HOOK_ROOT);
    const grip = bladePoint(player, STICK_GRIP);
    expect(tip.y - root.y).toBeGreaterThan(0.085);
    expect(Math.abs(root.y - grip.y)).toBeLessThan(0.025);
    expect(tip.clone().sub(grip).dot(player.shotDirection)).toBeGreaterThan(
      0.15,
    );
    expect(
      Math.abs(new Vector3(0, 1, 0).applyQuaternion(player.stickOrientation).y),
    ).toBeLessThan(0.001);
    const puckNormal = new Vector3(0, 1, 0).applyQuaternion(
      state.puck.orientation,
    );
    expect(Math.abs(puckNormal.dot(player.shotDirection))).toBeLessThan(0.001);
    expect(puckNormal.x * handSide(player)).toBeGreaterThan(0.3);
    expect(Math.abs(puckNormal.y)).toBeLessThan(0.001);
  }
});

test("shot follow-through turns the tip forward and twists the puck in the same mirrored direction", (): void => {
  for (const hand of ["right", "left"] as const) {
    const state = setup(hand);
    const player = state.players.at(0);
    if (!player) throw new Error("Otter missing");
    advance(state, 90, { ...freshControls(), charging: true, charge: 1 });
    stepSimulation(state, { ...freshControls(), shot: 1 }, STEP);
    const motion: {
      bladeAngle: number | undefined;
      puckAngle: number | undefined;
      bladeTurn: number;
      puckTurn: number;
      followedThrough: boolean;
    } = {
      bladeAngle: undefined,
      puckAngle: undefined,
      bladeTurn: 0,
      puckTurn: 0,
      followedThrough: false,
    };
    for (const unused of Array.from({ length: 45 })) {
      void unused;
      stepSimulation(state, freshControls(), STEP);
      const progress = shotProgress(player);
      const tip = bladePoint(player, STICK_TIP)
        .sub(bladePoint(player, STICK_GRIP))
        .setY(0)
        .normalize();
      const normal = new Vector3(0, 1, 0).applyQuaternion(
        state.puck.orientation,
      );
      if (progress > 0.3 && progress < 0.78) {
        const bladeAngle = Math.atan2(tip.x, -tip.z);
        if (motion.bladeAngle !== undefined) {
          const turn =
            angleDifference(bladeAngle, motion.bladeAngle) * handSide(player);
          expect(turn).toBeGreaterThanOrEqual(-0.001);
          motion.bladeTurn += turn;
        }
        motion.bladeAngle = bladeAngle;
        const puckAngle = Math.atan2(normal.x, -normal.z);
        if (motion.puckAngle !== undefined) {
          const turn =
            angleDifference(puckAngle, motion.puckAngle) * handSide(player);
          expect(turn).toBeGreaterThanOrEqual(-0.001);
          motion.puckTurn += turn;
        }
        motion.puckAngle = puckAngle;
      }
      if (progress > 0.74 && progress < 0.78) {
        expect(-tip.z).toBeGreaterThan(0.975);
        expect(tip.x * handSide(player)).toBeLessThan(0);
        motion.followedThrough = true;
      }
      if (state.puck.flightOrientation && state.puck.position.y > 0.14) {
        expect(
          state.puck.orientation.angleTo(state.puck.flightOrientation),
        ).toBeLessThan(0.001);
      }
    }
    expect(motion.followedThrough).toBe(true);
    expect(motion.bladeTurn).toBeGreaterThan(0.7);
    expect(motion.puckTurn).toBeGreaterThan(0.65);
  }
});
