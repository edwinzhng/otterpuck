import { expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";
import { planTeam } from "../src/formations";
import { playerPosition, projectPlayerLabel } from "../src/positions";
import { createSimulation, stepSimulation } from "../src/simulation";
import { freshControls, PUCK_HEIGHT, STEP } from "../src/types";

test("a goal holds one stable pose and resets every interpolation transform at the wall", (): void => {
  const state = createSimulation();
  state.faceoff = undefined;
  const human = state.players.at(0);
  if (!human) throw new Error("Player missing");
  human.position.set(0, 0.36, 1);
  human.velocity.set(0.6, 0, -1.5);
  human.bodyPitch = -0.2;
  state.puck.position.set(0, PUCK_HEIGHT, -12.385);
  state.puck.velocity.set(0, 0, -2);
  const controls = freshControls();
  stepSimulation(state, controls, STEP);
  expect(state.restartTime).toBeGreaterThan(0);
  const stopped = human.position.clone();
  for (const frame of Array.from(
    { length: 370 },
    (_unused, index): number => index,
  )) {
    controls.yawDelta = state.restartTime > 0 ? 0.4 : 0;
    controls.shot = 1;
    stepSimulation(state, controls, STEP);
    for (const player of state.players) {
      expect(player.previous.distanceTo(player.position)).toBe(0);
      expect(player.previousStick.distanceTo(player.stick)).toBe(0);
      expect(
        player.previousStickOrientation.angleTo(player.stickOrientation),
      ).toBeLessThan(0.000001);
      expect(player.previousStickYaw).toBe(player.stickYaw);
    }
    expect(state.puck.previous.distanceTo(state.puck.position)).toBe(0);
    if (frame < 350) {
      expect(human.position.distanceTo(stopped)).toBe(0);
      expect(controls.yawDelta).toBe(0);
      expect(controls.shot).toBe(0);
    }
  }
  expect(state.scores.at(0)).toBe(1);
  expect(state).toMatchObject({ faceoff: { phase: "ready" } });
  expect(
    state.players.every(
      (player): boolean => player.wallReady && player.bodyPitch === 0,
    ),
  ).toBe(true);
});

test("faceoffs hold all otters horizontally until they swim off the wall", (): void => {
  const state = createSimulation();
  for (const unused of Array.from({ length: 355 })) {
    void unused;
    stepSimulation(state, { ...freshControls(), dive: true, forward: 1 }, STEP);
    for (const player of state.players) {
      expect(player.bodyPitch).toBe(0);
      expect(player.bodyRoll).toBe(0);
      expect(Math.abs(player.position.z)).toBe(12);
    }
  }
  for (const unused of Array.from({ length: 20 })) {
    void unused;
    stepSimulation(state, freshControls(), STEP);
  }
  expect(state.faceoff?.phase).toBe("strike");
  expect(
    state.players.every(
      (player): boolean =>
        !player.wallReady && Math.abs(player.bodyPitch) < 0.65,
    ),
  ).toBe(true);
});

test("each formation has the requested positions and labels survive tactical and air rotations", (): void => {
  const expected = {
    "3-3": ["LF", "CF", "RF", "LB", "CB", "RB"],
    "2-3-1": ["LF", "RF", "LW", "C", "RW", "B"],
    "1-3-2": ["F", "LW", "C", "RW", "LB", "RB"],
  } as const;
  for (const formation of ["3-3", "2-3-1", "1-3-2"] as const) {
    const state = createSimulation(formation, formation);
    state.faceoff = undefined;
    for (const team of [0, 1] as const) {
      const players = state.players.filter(
        (player): boolean => player.team === team,
      );
      const labels = players.map(
        (player): string => playerPosition(state, player).code,
      );
      expect([...labels].sort()).toEqual([...expected[formation]].sort());
      for (const side of [-3, 3]) {
        state.puck.position.x = side;
        planTeam(state, team);
        for (const player of players) player.air = 30;
        planTeam(state, team);
        expect(
          players.map((player): string => playerPosition(state, player).code),
        ).toEqual(labels);
      }
    }
  }
});

test("position tags project with the same interpolation as swimmers and hide behind the camera", (): void => {
  const state = createSimulation();
  const player = state.players.at(1);
  if (!player) throw new Error("Player missing");
  const camera = new PerspectiveCamera(77, 1.5, 0.025, 90);
  camera.position.set(0, 1, 2);
  camera.updateMatrixWorld(true);
  player.previous.set(-1, 0.7, -2);
  player.position.set(1, 0.7, -2);
  const middle = projectPlayerLabel(player, camera, 0.5);
  expect(middle?.x).toBeCloseTo(0, 6);
  expect(middle?.y).toBeCloseTo(0, 6);
  expect(projectPlayerLabel(player, camera, 0)?.x ?? 0).toBeLessThan(0);
  expect(projectPlayerLabel(player, camera, 1)?.x ?? 0).toBeGreaterThan(0);
  player.position.copy(new Vector3(0, 1, 4));
  expect(projectPlayerLabel(player, camera, 1)).toBeUndefined();
});
