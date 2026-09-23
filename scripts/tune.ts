import { pursuitWeights } from "../src/bots";
import {
  type DuelResult,
  duelJobs,
  randomizer,
  type TrialSetup,
  tallyDuel,
  trialMatrix,
} from "../src/match-trials";
import { sizeFormations } from "../src/positions";
import type { PursuitWeights } from "../src/types";
import { closePool, runJobs } from "./trial-pool";

// A candidate must beat the incumbent head to head without making the team
// crowd the puck or abandon cover. These match the arena review thresholds.
const LIMITS = { swarm: 2.5, exposedSeconds: 45 } as const;
// A win must clear this many standard errors of the paired goal difference.
// One full match is noisy, so a bare positive difference is mostly luck.
const MIN_T = 1;
// Bot trials carry no human player, so `humanNear` has no effect and is fixed.
const KEYS = (Object.keys(pursuitWeights) as (keyof PursuitWeights)[]).filter(
  (key): boolean => key !== "humanNear",
);
const ITERATIONS = Number(Bun.argv[2] ?? 20);
const DIFFICULTIES = ["easy", "medium", "hard", "elite"] as const;
const FORMATIONS = sizeFormations(6);

// The search and the holdout use different start offsets, so a gain on the
// holdout is not an overfit to the offsets the search saw.
const setups = trialMatrix(FORMATIONS, DIFFICULTIES, ["alternative"], 2);
const holdout = trialMatrix(FORMATIONS, DIFFICULTIES, ["alternative"], 4)
  .filter((setup): boolean => setup.seed > 2)
  .map((setup): TrialSetup => ({ ...setup, seed: setup.seed + 10 }));

const draw = randomizer(20260923);
// Box-Muller turns the uniform draw into the normal step an evolution
// strategy needs. Math.random is avoided so a run repeats exactly.
const gaussian = (): number =>
  Math.sqrt(-2 * Math.log(1 - draw())) * Math.cos(2 * Math.PI * draw());

const mutate = (weights: PursuitWeights, sigma: number): PursuitWeights => {
  const next = { ...weights };
  for (const key of KEYS)
    next[key] += gaussian() * sigma * Math.max(Math.abs(weights[key]), 0.25);
  next.hysteresis = Math.max(0, next.hysteresis);
  return next;
};

const round = (value: number): number => Number(value.toFixed(3));

const verdict = (result: DuelResult) => {
  const pairs = result.pairDiffs;
  const mean =
    pairs.reduce((sum, diff): number => sum + diff, 0) / pairs.length;
  const variance =
    pairs.reduce((sum, diff): number => sum + (diff - mean) ** 2, 0) /
    Math.max(1, pairs.length - 1);
  const swarm = result.swarm / result.matches;
  const exposed = result.exposed / result.matches;
  return {
    goalDiff: mean / 2,
    t: mean / Math.max(Math.sqrt(variance / pairs.length), 1e-9),
    safe: swarm <= LIMITS.swarm && exposed <= LIMITS.exposedSeconds,
    swarm,
    exposed,
  };
};

const play = async (
  tested: PursuitWeights,
  other: PursuitWeights,
  field: readonly TrialSetup[],
) =>
  verdict(
    tallyDuel(await runJobs(duelJobs(field, { pursuit: { tested, other } }))),
  );

let incumbent: PursuitWeights = { ...pursuitWeights };
let sigma = 0.25;
let accepted = 0;
const started = performance.now();

for (let round_ = 1; round_ <= ITERATIONS; round_ += 1) {
  const candidate = mutate(incumbent, sigma);
  const outcome = await play(candidate, incumbent, setups);
  const win = outcome.safe && outcome.t > MIN_T;
  if (win) {
    incumbent = candidate;
    accepted += 1;
    sigma *= 1.3;
  } else sigma = Math.max(0.05, sigma * 0.85);
  console.info(
    JSON.stringify({
      round: round_,
      goalDiff: round(outcome.goalDiff),
      t: round(outcome.t),
      swarm: round(outcome.swarm),
      exposed: round(outcome.exposed),
      accepted: win,
      sigma: round(sigma),
    }),
  );
}

const validation = await play(incumbent, pursuitWeights, holdout);
closePool();

console.info(
  JSON.stringify(
    {
      iterations: ITERATIONS,
      accepted,
      holdout: {
        matches: holdout.length * 2,
        goalDiff: round(validation.goalDiff),
        t: round(validation.t),
        swarm: round(validation.swarm),
        exposed: round(validation.exposed),
        safe: validation.safe,
      },
      minutes: round((performance.now() - started) / 60000),
      // Paste this table into pursuitWeights in src/bots.ts only after the
      // change is confirmed in the running game.
      weights: Object.fromEntries(
        (Object.keys(incumbent) as (keyof PursuitWeights)[]).map(
          (key): [string, number] => [key, round(incumbent[key])],
        ),
      ),
    },
    undefined,
    2,
  ),
);
