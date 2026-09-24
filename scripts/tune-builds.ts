import {
  BOT_POINTS,
  botBuilds,
  type PositionRole,
  type RoleBuilds,
} from "../src/bots";
import {
  type DuelResult,
  duelJobs,
  tallyDuel,
  trialMatrix,
} from "../src/match-trials";
import { MAX_ATTRIBUTE, MIN_ATTRIBUTE } from "../src/player-profile";
import { sizeFormations } from "../src/positions";
import type { Attributes, BotDifficulty } from "../src/types";
import { closePool, runJobs } from "./trial-pool";

// Searches bot builds for each difficulty. Stage 1 plays every way to spend
// the difficulty's points, used by the whole team, against the shipped
// builds. Stage 2 starts from the best team build and tries the strongest
// alternatives for one position role at a time. Each result is the paired
// goal difference per match of the tested side and its t value over setups.
const DIFFICULTIES = (Bun.argv[2] ?? "easy,medium,hard,elite").split(
  ",",
) as BotDifficulty[];
const SEEDS = Number(Bun.argv[3] ?? 9);
const ROLE_CANDIDATES = 4;
const ROLES: PositionRole[] = ["forward", "middle", "back"];

const round = (value: number): number => Number(value.toFixed(2));
const label = (build: Attributes): string =>
  `${build.strength}/${build.technique}/${build.fitness}`;
const everyRole = (build: Attributes): RoleBuilds => ({
  forward: build,
  middle: build,
  back: build,
});

const spends = (points: number): Attributes[] => {
  const builds: Attributes[] = [];
  for (let strength = MIN_ATTRIBUTE; strength <= MAX_ATTRIBUTE; strength++)
    for (
      let technique = MIN_ATTRIBUTE;
      technique <= MAX_ATTRIBUTE;
      technique++
    ) {
      const fitness = points - strength - technique;
      if (fitness >= MIN_ATTRIBUTE && fitness <= MAX_ATTRIBUTE)
        builds.push({ strength, technique, fitness });
    }
  return builds;
};

const verdict = (result: DuelResult) => {
  const pairs = result.pairDiffs;
  const mean = pairs.reduce((sum, diff) => sum + diff, 0) / pairs.length;
  const variance =
    pairs.reduce((sum, diff) => sum + (diff - mean) ** 2, 0) /
    Math.max(1, pairs.length - 1);
  return {
    goalDiff: round(mean / 2),
    t: round(mean / Math.max(Math.sqrt(variance / pairs.length), 1e-9)),
  };
};

const play = async (
  difficulty: BotDifficulty,
  tested: RoleBuilds,
  other: RoleBuilds,
) =>
  verdict(
    tallyDuel(
      await runJobs(
        duelJobs(
          trialMatrix(sizeFormations(6), [difficulty], ["alternative"], SEEDS),
          { builds: { tested, other } },
        ),
      ),
    ),
  );

const report: Record<string, unknown> = {};
for (const difficulty of DIFFICULTIES) {
  const shipped = botBuilds[difficulty];
  const uniform = [];
  for (const build of spends(BOT_POINTS[difficulty])) {
    const result = await play(difficulty, everyRole(build), shipped);
    uniform.push({ build: label(build), attributes: build, ...result });
    console.info(difficulty, "team", label(build), JSON.stringify(result));
  }
  uniform.sort((a, b) => b.goalDiff - a.goalDiff);
  const best = uniform.at(0);
  if (!best) continue;
  const base = everyRole(best.attributes);
  const roles = [];
  for (const role of ROLES)
    for (const candidate of uniform.slice(1, ROLE_CANDIDATES + 1)) {
      const tested = { ...base, [role]: candidate.attributes };
      const result = await play(difficulty, tested, base);
      roles.push({ role, build: candidate.build, ...result });
      console.info(
        difficulty,
        role,
        candidate.build,
        "vs",
        best.build,
        JSON.stringify(result),
      );
    }
  report[difficulty] = {
    points: BOT_POINTS[difficulty],
    uniform: uniform.map(({ build, goalDiff, t }) => ({ build, goalDiff, t })),
    roles,
  };
}
closePool();
console.info(JSON.stringify(report, undefined, 2));
