import { expect, test } from "bun:test";
import { pursuitWeights } from "./bots";
import { duel, runTrial, trialMatrix } from "./match-trials";
import { sizeFormations } from "./positions";

const setup = {
  formation: "2-3-1",
  opposition: "2-3-1",
  difficulty: "medium",
  ruleset: "alternative",
  seed: 1,
} as const;

// Each full match takes about 1.3 s, so a test that plays several needs more
// than the default 5 s limit.
const MATCHES_TIMEOUT = 20_000;

test("a trial plays a full bot match and reports both teams", () => {
  const report = runTrial(setup);
  expect(report.contacts).toBeGreaterThan(0);
  expect(report.shots).toBeGreaterThan(0);
  expect(report.possession[0] + report.possession[1]).toBeGreaterThan(0);
  for (const team of [0, 1] as const) {
    expect(report.swarm[team]).toBeGreaterThan(0);
    expect(report.swarm[team]).toBeLessThanOrEqual(6);
    expect(report.exposed[team]).toBeLessThanOrEqual(180);
    expect(report.chaserChanges[team]).toBeGreaterThan(0);
  }
});

test(
  "the same setup replays identically and a new seed diverges",
  () => {
    const first = runTrial(setup);
    expect(runTrial(setup)).toEqual(first);
    const other = runTrial({ ...setup, seed: 2 });
    expect(other.contacts).not.toBe(first.contacts);
  },
  MATCHES_TIMEOUT,
);

test("the matrix covers every formation pairing for each seed", () => {
  const formations = sizeFormations(6);
  const setups = trialMatrix(formations, ["medium"], ["alternative"], 2);
  expect(setups).toHaveLength(formations.length * formations.length * 2);
  expect(new Set(setups.map((entry): string => entry.formation)).size).toBe(
    formations.length,
  );
});

test(
  "each team runs its own chaser weights",
  () => {
    const eager = { ...pursuitWeights, keeper: 0, acrossCourt: 0 };
    const shipped = runTrial(setup);
    expect(runTrial(setup, [pursuitWeights, pursuitWeights])).toEqual(shipped);
    const split = runTrial(setup, [eager, pursuitWeights]);
    expect(split.contacts).not.toBe(shipped.contacts);
    expect(split.exposed).not.toEqual(shipped.exposed);
  },
  MATCHES_TIMEOUT,
);

test("a duel plays every setup from both sides", () => {
  const result = duel([setup], {
    pursuit: { tested: pursuitWeights, other: pursuitWeights },
  });
  expect(result.matches).toBe(2);
  expect(result.pairDiffs).toHaveLength(1);
  // Identical weights on both teams still differ by side, so the mirrored
  // pair is what removes the advantage rather than a zero result.
  expect(result.goalsFor + result.goalsAgainst).toBeGreaterThanOrEqual(0);
});
