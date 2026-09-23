import {
  duelJobs,
  type TrialReport,
  type TrialSetup,
  tallyDuel,
  trialMatrix,
} from "../src/match-trials";
import { sizeFormations } from "../src/positions";
import type { BotDifficulty } from "../src/types";
import { closePool, runJobs } from "./trial-pool";

const DIFFICULTIES = ["easy", "medium", "hard", "elite"] as const;

// Review thresholds, not pass criteria. A trial above one of these needs a look
// in the running game before its numbers are used to judge a tuning change.
const REVIEW = {
  exposedSeconds: 45,
  swarm: 2.5,
  chaserChanges: 150,
  // Air cycling keeps half a team up for about 40 s of a 180 s match. Only
  // the upper tail of that spread needs review.
  strandedSeconds: 50,
} as const;

const mean = (values: number[]): number =>
  values.reduce((sum: number, value: number): number => sum + value, 0) /
  Math.max(1, values.length);

const round = (value: number): number => Number(value.toFixed(2));

const bothTeams = (
  reports: TrialReport[],
  pick: (report: TrialReport) => [number, number],
): number => mean(reports.flatMap((report): number[] => [...pick(report)]));

const summarize = (reports: TrialReport[]): object => ({
  trials: reports.length,
  goalsPerMatch: round(
    mean(reports.map((report): number => report.scores[0] + report.scores[1])),
  ),
  shotsPerMatch: round(mean(reports.map((report): number => report.shots))),
  contactsPerMatch: round(
    mean(reports.map((report): number => report.contacts)),
  ),
  possessionSeconds: round(
    bothTeams(reports, (report): [number, number] => report.possession),
  ),
  swarm: round(bothTeams(reports, (report): [number, number] => report.swarm)),
  exposedSeconds: round(
    bothTeams(reports, (report): [number, number] => report.exposed),
  ),
  chaserChanges: round(
    bothTeams(reports, (report): [number, number] => report.chaserChanges),
  ),
  emergencies: round(
    bothTeams(reports, (report): [number, number] => report.emergencies),
  ),
  strandedSeconds: round(
    bothTeams(reports, (report): [number, number] => report.stranded),
  ),
});

const flags = (report: TrialReport): string[] => {
  const found: string[] = [];
  for (const team of [0, 1] as const) {
    if (report.exposed[team] > REVIEW.exposedSeconds)
      found.push(
        `team ${team} had no cover behind the puck ${round(report.exposed[team])}s`,
      );
    if (report.swarm[team] > REVIEW.swarm)
      found.push(
        `team ${team} kept ${round(report.swarm[team])} players on the puck`,
      );
    if (report.stranded[team] > REVIEW.strandedSeconds)
      found.push(
        `team ${team} had half its players off the floor ${round(report.stranded[team])}s`,
      );
    if (report.chaserChanges[team] > REVIEW.chaserChanges)
      found.push(
        `team ${team} reassigned the chaser ${report.chaserChanges[team]} times`,
      );
  }
  return found;
};

const label = (setup: TrialSetup): string =>
  `${setup.formation} vs ${setup.opposition} · ${setup.difficulty} · ${setup.ruleset} · seed ${setup.seed}`;

const setups = trialMatrix(sizeFormations(6), DIFFICULTIES, ["alternative"], 2);
const started = performance.now();
const reports = await runJobs(setups.map((setup) => ({ setup })));
// One side runs the coach and the other does not. A positive goal difference
// per match shows that the coach still improves bot play.
const coach = tallyDuel(
  await runJobs(duelJobs(setups, { coached: { tested: true, other: false } })),
);
closePool();

console.info(
  JSON.stringify(
    {
      wallClockSeconds: round((performance.now() - started) / 1000),
      overall: summarize(reports),
      coachGoalDiffPerMatch: round(
        (coach.goalsFor - coach.goalsAgainst) / coach.matches,
      ),
      byDifficulty: Object.fromEntries(
        DIFFICULTIES.map((difficulty: BotDifficulty): [string, object] => [
          difficulty,
          summarize(
            reports.filter(
              (report): boolean => report.setup.difficulty === difficulty,
            ),
          ),
        ]),
      ),
      review: reports.flatMap((report): string[] =>
        flags(report).map((flag): string => `${label(report.setup)}: ${flag}`),
      ),
    },
    undefined,
    2,
  ),
);
