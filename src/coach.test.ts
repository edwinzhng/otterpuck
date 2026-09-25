import { expect, test } from "bun:test";
import { pursuitWeights } from "./bots";
import { applyPlan, coachTeam, heuristicPlan, MAX_AGGRESSION } from "./coach";
import { teamSize } from "./positions";
import { createSimulation } from "./simulation";
import { NEUTRAL_TACTICS } from "./types";

const match = () =>
  createSimulation("2-3-1", "2-3-1", "match", 180, "right", {
    species: "otter",
    position: 0,
    difficulty: "medium",
  });

test("a team with the coach turned off is left exactly as it was", () => {
  const state = match();
  const shape = state.formations[0];
  state.coached = [false, false];
  coachTeam(state, 0);
  expect(state.formations[0]).toBe(shape);
  expect(state.pursuit[0]).toEqual(pursuitWeights);
  expect(state.tactics[0]).toEqual(NEUTRAL_TACTICS);
});

test("the plan keeps the roster size and swings with the scoreline", () => {
  const state = match();
  state.seconds = 20;
  state.scores = [0, 2];
  const chasing = heuristicPlan(state, 0);
  state.scores = [2, 0];
  const holding = heuristicPlan(state, 0);
  expect(chasing.aggression).toBe(MAX_AGGRESSION);
  expect(holding.aggression).toBe(0);
  for (const plan of [chasing, holding])
    expect(teamSize(plan.formation)).toBe(teamSize(state.formations[0]));
});

test("applying a plan derives the live weights and leaves the base alone", () => {
  const state = match();
  state.coached = [true, true];
  applyPlan(state, 1, {
    formation: "3-3",
    aggression: 3,
    airBudget: 0.75,
    commit: 1,
  });
  expect(state.pursuitBase[1]).toEqual(pursuitWeights);
  expect(state.pursuit[1].acrossCourt).toBeLessThan(pursuitWeights.acrossCourt);
  expect(state.pursuit[1].hysteresis).toBeLessThan(pursuitWeights.hysteresis);
  expect(state.tactics[1].airBudget).toBeCloseTo(0.75, 6);
  expect(state.formations[1]).toBe("3-3");
  // A shape from another roster size must be refused; the snapshot schema
  // requires the shape to match the players on the team.
  applyPlan(state, 1, {
    formation: "1-1",
    aggression: 0,
    airBudget: 1,
    commit: 0,
  });
  expect(state.formations[1]).toBe("3-3");
});

test("the coach never changes the shape of a team with a human", () => {
  const state = match();
  state.coached = [true, true];
  applyPlan(state, 0, {
    formation: "3-3",
    aggression: 3,
    airBudget: 0.75,
    commit: 1,
  });
  expect(state.formations[0]).toBe("2-3-1");
  expect(state.tactics[0].airBudget).toBeCloseTo(0.75, 6);
});
