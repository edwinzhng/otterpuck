import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { planTeam } from "./formations";
import {
  createSimulation,
  feedPracticePuck,
  puckFloorHeight,
  requestShot,
  resetPracticePuck,
  stepSimulation,
} from "./simulation";
import { freshControls, PUCK_HEIGHT, STEP } from "./types";

test("puck lab has one player, unlimited breath, no clock, and no goal resets", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground", 1);
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  expect(state.players.length).toBe(1);
  expect(state.faceoff).toBeUndefined();
  state.puck.position.set(0, PUCK_HEIGHT, -12.4);
  for (const unused of Array.from({ length: 6000 })) {
    void unused;
    stepSimulation(state, { ...freshControls(), dummy: 1 }, STEP);
  }
  expect(player.air).toBe(100);
  expect(player.emergency).toBe(false);
  expect(state.seconds).toBe(1);
  expect(state.finished).toBe(false);
  expect(state.restartTime).toBe(0);
  expect(state.scores).toEqual([0, 0]);
});

test("a shot pushes forward continuously, arcs without tumbling, and settles flat", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  requestShot(player, 0.9, new Vector3(0, 0, -1));
  const motion = {
    maximumStep: 0,
    smallestNormalY: 1,
    maximumTiltedFloorError: 0,
    sawBevel: false,
  };
  for (const unused of Array.from({ length: 1500 })) {
    void unused;
    const previous = state.puck.position.clone();
    stepSimulation(state, freshControls(), STEP);
    motion.sawBevel ||= state.puck.shotOwner === 0;
    motion.maximumStep = Math.max(
      motion.maximumStep,
      previous.distanceTo(state.puck.position),
    );
    motion.smallestNormalY = Math.min(
      motion.smallestNormalY,
      Math.abs(new Vector3(0, 1, 0).applyQuaternion(state.puck.orientation).y),
    );
    if (state.puck.shotOwner === undefined)
      motion.maximumTiltedFloorError = Math.max(
        motion.maximumTiltedFloorError,
        puckFloorHeight(state) - state.puck.position.y,
      );
    expect(state.puck.orientation.length()).toBeCloseTo(1, 5);
  }
  expect(motion.sawBevel).toBe(true);
  expect(state.shots).toBe(1);
  expect(motion.maximumStep).toBeLessThan(0.09);
  expect(motion.smallestNormalY).toBeLessThan(0.001);
  expect(motion.maximumTiltedFloorError).toBeLessThan(0.001);
  expect(state.puck.position.y).toBeCloseTo(PUCK_HEIGHT, 3);
  expect(state.puck.velocity.length()).toBeLessThan(0.01);
  expect(state.playground.trace.length).toBeLessThanOrEqual(180);
});

test("lab reset cancels a live flick and feed creates an incoming airborne puck", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  stepSimulation(state, { ...freshControls(), shot: 1 }, STEP);
  expect(state.puck.shotOwner).toBe(0);
  resetPracticePuck(state);
  expect(state.puck.shotOwner).toBeUndefined();
  expect(state.puck.angularVelocity.length()).toBe(0);
  expect(state.puck.velocity.length()).toBe(0);
  feedPracticePuck(state);
  expect(state.puck.position.y).toBeGreaterThan(0.6);
  expect(state.puck.velocity.z).toBeGreaterThan(2);
});

test("lab drag and lift tune the arc without adding tumble", (): void => {
  const normal = createSimulation("2-3-1", "2-3-1", "playground");
  const tuned = createSimulation("2-3-1", "2-3-1", "playground");
  tuned.physics = { drag: 1.8, lift: 1.6 };
  for (const state of [normal, tuned]) {
    stepSimulation(state, { ...freshControls(), shot: 1 }, STEP);
    for (const unused of Array.from({ length: 48 })) {
      void unused;
      stepSimulation(state, freshControls(), STEP);
    }
  }
  expect(tuned.puck.position.y).toBeGreaterThan(normal.puck.position.y);
  expect(Math.abs(tuned.puck.velocity.z)).toBeLessThan(
    Math.abs(normal.puck.velocity.z),
  );
  expect(tuned.puck.angularVelocity.x).toBe(0);
  expect(normal.puck.angularVelocity.length()).toBe(0);
});

test("2-3-1 is the default and a covered teammate cycles without sending both up", (): void => {
  const state = createSimulation();
  expect(state.formations.at(0)).toBe("2-3-1");
  const arriving = state.players.at(2);
  const covering = state.players.at(3);
  if (!arriving || !covering) throw new Error("Teammates missing");
  state.faceoff = undefined;
  state.puck.position.z = -7;
  planTeam(state, 0);
  arriving.position.copy(arriving.target);
  arriving.mode = "playing";
  arriving.air = 72;
  covering.position.copy(arriving.target).add(new Vector3(0.6, 0, 0));
  covering.mode = "playing";
  covering.air = 92;
  planTeam(state, 0);
  expect(String(arriving.mode)).toBe("ascending");
  expect(arriving.duty).toBe("recover");
  expect(covering.mode).toBe("playing");
  expect(covering.wantDown).toBe(true);
});

test("teammates keep a vacant position covered even with partially used air", (): void => {
  const state = createSimulation();
  state.faceoff = undefined;
  planTeam(state, 0);
  const player = state.players.at(3);
  if (!player) throw new Error("Teammate missing");
  player.position.copy(player.target);
  player.mode = "playing";
  player.air = 70;
  planTeam(state, 0);
  expect(player.mode).toBe("playing");
});
