import { expect, test } from "bun:test";
import { createSimulation, stepSimulation } from "../simulation";
import { freshControls, SURFACE_HEIGHT } from "../types";
import { createHudPresentation } from "./hud";

test("vitals and clock advance between packets without changing authoritative state", () => {
  const state = createSimulation();
  state.faceoff = undefined;
  const player = state.players[0];
  if (!player) throw new Error("Missing player");
  player.air = 70;
  player.stamina = 60;
  player.sprint = true;
  const hud = createHudPresentation();
  hud.push(state, 1000);
  const first = { ...hud.read(1016) };
  const second = hud.read(1032);
  expect(second?.air).toBeLessThan(first.air ?? 0);
  expect(second?.stamina).toBeLessThan(first.stamina ?? 0);
  expect(second?.seconds).toBeCloseTo(state.seconds - 0.032, 6);
  expect(player.air).toBe(70);
  expect(player.stamina).toBe(60);
  expect(state.seconds).toBe(180);
});

test("surface recovery is continuous and stale connections stop extrapolating", () => {
  const state = createSimulation();
  state.faceoff = undefined;
  const player = state.players[0];
  if (!player) throw new Error("Missing player");
  player.position.y = SURFACE_HEIGHT;
  player.air = 50;
  player.stamina = 50;
  player.sprint = false;
  const hud = createHudPresentation();
  hud.push(state, 0);
  expect(hud.read(500)?.air).toBeGreaterThan(50);
  expect(hud.read(500)?.stamina).toBeGreaterThan(50);
  const sample = hud.read(2000);
  if (!sample) throw new Error("Missing HUD sample");
  const limit = { ...sample };
  expect(hud.read(20_000)).toEqual(limit);
});

test("packet corrections blend and clock never ticks backward", () => {
  const state = createSimulation();
  state.faceoff = undefined;
  const player = state.players[0];
  if (!player) throw new Error("Missing player");
  player.air = 70;
  const hud = createHudPresentation();
  hud.push(state, 0);
  const before = { ...hud.read(100) };
  player.air = 65;
  state.seconds -= 0.08;
  hud.push(state, 100);
  expect(hud.read(100)?.air).toBeCloseTo(before.air ?? 0, 6);
  expect(hud.read(200)?.air).toBeLessThan(before.air ?? 0);
  expect(hud.read(200)?.seconds).toBeLessThanOrEqual(before.seconds ?? 0);
  state.restartTime = 3;
  hud.push(state, 200);
  expect(hud.read(1000)?.seconds).toBe(state.seconds);
  state.restartTime = 0;
  state.faceoff = { phase: "ready", remaining: 3 };
  player.air = player.stamina = 100;
  hud.push(state, 1000);
  expect(hud.read(1500)).toEqual({
    air: 100,
    stamina: 100,
    seconds: state.seconds,
  });
  state.finished = true;
  state.seconds = 0;
  hud.push(state, 1600);
  expect(hud.read(1800)?.seconds).toBe(0);
});

test("forecast uses the same drain rules as server simulation", () => {
  for (const ruleset of ["original", "alternative"] as const) {
    const state = createSimulation();
    state.faceoff = undefined;
    state.ruleset = ruleset;
    const player = state.players[0];
    if (!player) throw new Error("Missing player");
    player.air = player.stamina = 60;
    player.kick = 0;
    const hud = createHudPresentation();
    hud.push(state, 0);
    const expected = { ...hud.read(10) };
    stepSimulation(state, freshControls(), 0.01);
    expect(player.air).toBeCloseTo(expected.air ?? 0, 2);
    expect(player.stamina).toBeCloseTo(expected.stamina ?? 0, 2);
  }
});
