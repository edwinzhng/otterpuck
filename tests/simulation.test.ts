import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { planTeam } from "../src/formations";
import {
  createSimulation,
  requestShot,
  stepSimulation,
} from "../src/simulation";
import { puckSeat } from "../src/stick";
import {
  FLOOR_HEIGHT,
  freshControls,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
  SURFACE_HEIGHT,
} from "../src/types";

const advance = (
  state: Simulation,
  seconds: number,
  controls = freshControls(),
): void => {
  for (const unused of Array.from({ length: Math.ceil(seconds / STEP) })) {
    void unused;
    stepSimulation(state, controls, STEP);
  }
};

describe("Physical puck", (): void => {
  test("moving and turning nearby cannot assign possession or attract a free puck", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    state.puck.position.set(3, PUCK_HEIGHT, 2);
    const origin = state.puck.position.clone();
    const controls = freshControls();
    controls.forward = 1;
    controls.yawDelta = 1;
    advance(state, 1, controls);
    expect(state.puck.position.distanceTo(origin)).toBeLessThan(0.0001);
    expect(state.puck.lastTouch).toBeUndefined();
  });
  test("a flick contacts the puck, lifts it, and moves it forward", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    const player = state.players.at(0);
    if (!player) throw new Error("Player missing");
    state.puck.position.copy(puckSeat(player)).setY(PUCK_HEIGHT);
    requestShot(player, 0.8, new Vector3(0, 0, -1));
    advance(state, 0.25);
    expect(state.shots).toBe(1);
    expect(state.puck.velocity.z).toBeLessThan(-2);
    expect(state.puck.position.y).toBeGreaterThan(0.08);
    expect(state.puck.lastTouch).toBe(player.id);
  });
  test("clicking out of reach misses", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    state.puck.position.set(4, PUCK_HEIGHT, -4);
    const player = state.players.at(0);
    if (!player) throw new Error("Player missing");
    requestShot(player, 1, new Vector3(0, 0, -1));
    advance(state, 0.5);
    expect(state.shots).toBe(0);
    expect(state.puck.velocity.length()).toBe(0);
  });
  test("a released puck settles and never travels through pool walls", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    state.puck.position.set(6.8, 0.6, 0);
    state.puck.velocity.set(8, 1.2, 2);
    advance(state, 9);
    expect(Math.abs(state.puck.position.x)).toBeLessThan(7.47);
    expect(state.puck.position.y).toBeCloseTo(PUCK_HEIGHT);
    expect(state.puck.velocity.length()).toBeLessThan(0.1);
  });
  test("a backhand releases from the inside face without spin", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    const player = state.players.at(0);
    if (!player) throw new Error("Player missing");
    const controls = { ...freshControls(), backhand: true };
    advance(state, 0.5, controls);
    state.puck.position.copy(puckSeat(player)).setY(PUCK_HEIGHT);
    state.puck.velocity.set(0, 0, 0);
    requestShot(player, 0.8, new Vector3(0, 0, -1));
    advance(state, 0.25, controls);
    expect(state.shots).toBe(1);
    expect(state.puck.velocity.z).toBeLessThan(-2);
    expect(state.puck.spin).toBe(0);
  });
  test("a dummy can take and swerve a nearby puck last touched by an opponent", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    const player = state.players.at(0);
    if (!player) throw new Error("Player missing");
    state.puck.position
      .copy(puckSeat(player))
      .add(new Vector3(0.1, 0, 0))
      .setY(PUCK_HEIGHT);
    state.puck.lastTouch = 6;
    const origin = state.puck.position.clone();
    const controls = { ...freshControls(), dummy: 1 };
    advance(state, 0.12, controls);
    expect(state.puck.lastTouch).toBe(player.id);
    expect(state.puck.position.z - origin.z).toBeGreaterThan(0.09);
    advance(state, 0.3, controls);
    expect(state.puck.position.x - origin.x).toBeGreaterThan(0.15);
    expect(state.contacts).toBeGreaterThan(0);
  });
  test("the reaction button knocks down a rising puck in reach", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    const player = state.players.at(0);
    if (!player) throw new Error("Player missing");
    state.puck.position.copy(player.position).add(new Vector3(0, 0.2, -1.05));
    state.puck.velocity.set(0, 0.5, 0);
    advance(state, 0.12, { ...freshControls(), knockdown: true });
    expect(state.contacts).toBeGreaterThan(0);
    expect(state.puck.velocity.y).toBeLessThan(-0.3);
  });
  test("only entering the low goal trough counts", (): void => {
    const goal = createSimulation();
    goal.faceoff = undefined;
    goal.puck.position.set(0, PUCK_HEIGHT, -12.385);
    stepSimulation(goal, freshControls(), STEP);
    expect(goal.scores.at(0)).toBe(1);
    advance(goal, 0.5);
    expect(goal.scores.at(0)).toBe(1);
    const high = createSimulation();
    high.faceoff = undefined;
    high.puck.position.set(0, 0.8, -12.3);
    stepSimulation(high, freshControls(), STEP);
    expect(high.scores.at(0)).toBe(0);
  });
});

describe("Movement and breath", (): void => {
  test("power kicking accelerates faster without an air penalty", (): void => {
    const normal = createSimulation("3-3", "3-3", "practice");
    const sprint = createSimulation("3-3", "3-3", "practice");
    normal.puck.position.x = 5;
    sprint.puck.position.x = 5;
    advance(normal, 2, { ...freshControls(), forward: 1 });
    advance(sprint, 2, { ...freshControls(), forward: 1, sprint: true });
    expect(sprint.players.at(0)?.velocity.length()).toBeGreaterThan(
      normal.players.at(0)?.velocity.length() ?? 0,
    );
    expect(sprint.players.at(0)?.air).toBeCloseTo(
      normal.players.at(0)?.air ?? 0,
      8,
    );
  });
  test("empty air triggers an ascent and sustained recovery", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    const player = state.players.at(0);
    if (!player) throw new Error("Player missing");
    player.air = 0.01;
    advance(state, 0.1);
    expect(player.emergency).toBe(true);
    advance(state, 2);
    expect(player.position.y).toBeCloseTo(SURFACE_HEIGHT, 1);
    expect(player.air).toBeLessThan(30);
    advance(state, 8);
    expect(player.air).toBeGreaterThan(86);
    expect(player.emergency).toBe(false);
  });
  test("emergency recovery unlocks diving at 80 percent air", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    const player = state.players.at(0);
    if (!player) throw new Error("Player missing");
    player.position.y = SURFACE_HEIGHT;
    player.mode = "recovering";
    player.emergency = true;
    player.air = 79;
    stepSimulation(state, freshControls(), STEP);
    expect(player.emergency).toBe(true);
    player.air = 80;
    stepSimulation(state, freshControls(), STEP);
    expect(player.emergency).toBe(false);
    advance(state, 3, { ...freshControls(), dive: true });
    expect(player.position.y).toBeCloseTo(FLOOR_HEIGHT);
  });
  test("a stationary duck dive returns to the floor", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    const player = state.players.at(0);
    if (!player) throw new Error("Player missing");
    player.position.y = SURFACE_HEIGHT;
    player.mode = "recovering";
    const start = player.position.clone();
    advance(state, 3, { ...freshControls(), dive: true });
    expect(player.position.y).toBeCloseTo(FLOOR_HEIGHT);
    expect(player.position.x).toBeCloseTo(start.x);
    expect(player.position.z).toBeCloseTo(start.z);
  });
  test("curling can continue past a full revolution without teleporting the puck", (): void => {
    const state = createSimulation("3-3", "3-3", "practice");
    state.puck.position.set(5, PUCK_HEIGHT, 0);
    advance(state, 4, { ...freshControls(), curl: 1 });
    expect(Math.abs(state.players.at(0)?.yaw ?? 0)).toBeGreaterThan(
      Math.PI * 2,
    );
    expect(state.puck.position.x).toBe(5);
  });
});

describe("Three-three seven rotation", (): void => {
  test("backs line up diagonally toward their own goal", (): void => {
    const state = createSimulation("3-3");
    state.puck.position.set(4, PUCK_HEIGHT, 0);
    planTeam(state, 0);
    const strong = state.players.at(5);
    const swing = state.players.at(4);
    const weak = state.players.at(3);
    if (!strong || !swing || !weak) throw new Error("Backs missing");
    expect(strong.target.x).toBeGreaterThan(swing.target.x);
    expect(swing.target.x).toBeGreaterThan(weak.target.x);
    expect(Math.abs(weak.target.x)).toBeLessThan(Math.abs(strong.target.x));
    expect(strong.target.distanceTo(swing.target)).toBeLessThan(2);
    expect(swing.target.distanceTo(weak.target)).toBeLessThan(2);
    expect(swing.target.z).toBeGreaterThan(strong.target.z);
    expect(weak.target.z).toBeGreaterThan(swing.target.z);
    expect(weak.wantDown).toBe(true);
  });
  test("the swing relieves a tired strong back while the weak back preserves cover", (): void => {
    const state = createSimulation("3-3");
    state.puck.position.x = 4;
    const strong = state.players.at(5);
    if (!strong) throw new Error("Back missing");
    strong.air = 20;
    planTeam(state, 0);
    expect(state.backLeads.at(0)).toBe(4);
    expect(state.players.at(3)?.duty).toBe("cover");
    expect(state.players.at(4)?.wantDown).toBe(true);
  });
  test("a side switch makes the weak back strong without moving any player instantly", (): void => {
    const state = createSimulation("3-3");
    state.puck.position.x = 4;
    planTeam(state, 0);
    const positions = state.players.map(
      (player): Vector3 => player.position.clone(),
    );
    state.puck.position.x = -4;
    planTeam(state, 0);
    expect(state.backLeads.at(0)).toBe(3);
    expect(state.players.at(5)?.duty).toBe("cover");
    for (const [index, player] of state.players.entries())
      expect(player.position.equals(positions.at(index) ?? new Vector3())).toBe(
        true,
      );
  });
});

test("each formation can play a finite complete match", (): void => {
  for (const formation of ["3-3", "2-3-1", "1-3-2"] as const) {
    const state = createSimulation(formation, "3-3", "match", 180);
    advance(state, 400);
    expect(state.finished).toBe(true);
    expect(state.contacts).toBeGreaterThan(10);
    for (const player of state.players) {
      expect(Number.isFinite(player.position.length())).toBe(true);
      expect(player.air).toBeGreaterThanOrEqual(0);
      expect(player.air).toBeLessThanOrEqual(100);
      expect(Math.abs(player.position.x)).toBeLessThan(7.5);
      expect(Math.abs(player.position.z)).toBeLessThan(12.5);
    }
  }
}, 30_000);
