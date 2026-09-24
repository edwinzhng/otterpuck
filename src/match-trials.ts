import { applyBotBuilds, type RoleBuilds } from "./bots";
import { createSimulation, stepSimulation } from "./simulation";
import {
  attackDirection,
  type BotDifficulty,
  type Formation,
  freshControls,
  type Player,
  type PursuitWeights,
  type Ruleset,
  type Simulation,
  STEP,
} from "./types";

export type TrialSetup = {
  formation: Formation;
  opposition: Formation;
  difficulty: BotDifficulty;
  ruleset: Ruleset;
  seed: number;
};

export type TeamPair = [number, number];

export type TeamWeights = [PursuitWeights, PursuitWeights];

export type TrialReport = {
  setup: TrialSetup;
  scores: TeamPair;
  shots: number;
  contacts: number;
  possession: TeamPair;
  swarm: TeamPair;
  exposed: TeamPair;
  chaserChanges: TeamPair;
  emergencies: TeamPair;
  stranded: TeamPair;
  surfaced: TeamPair;
};

// Players inside this radius of the puck are counted as committed to it.
const SWARM_RADIUS = 2;
// Metrics are sampled at 10 Hz. The simulation still advances at the full step.
const SAMPLE_STRIDE = 12;
// Start offsets stay below the smallest formation spacing so roles are unchanged.
const JITTER = 0.35;

export const randomizer = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
};

// The simulation holds no randomness, so identical setups replay identically.
// Offsetting the start spreads each setup over distinct puck battles instead.
const scatterStart = (state: Simulation, seed: number): void => {
  const draw = randomizer(seed);
  for (const player of state.players) {
    player.position.x += (draw() * 2 - 1) * JITTER;
    player.position.z += (draw() * 2 - 1) * JITTER;
    player.previous.copy(player.position);
  }
};

// The rules field no goalkeeper, so cover is measured against the puck instead
// of a goal mouth. A defender is goal-side when it is deeper than the puck.
const goalSide = (state: Simulation, player: Player): boolean =>
  player.position.z * attackDirection(player.team) <
  state.puck.position.z * attackDirection(player.team);

export const runTrial = (
  setup: TrialSetup,
  pursuit?: TeamWeights,
  coached?: [boolean, boolean],
  builds?: [RoleBuilds, RoleBuilds],
): TrialReport => {
  const state = createSimulation(
    setup.formation,
    setup.opposition,
    "match",
    180,
    "right",
    { species: "otter", position: 0, difficulty: setup.difficulty },
    setup.ruleset,
  );
  // Both teams must run the bot controller for the trial to measure bot play.
  for (const player of state.players) player.human = false;
  applyBotBuilds(state, builds);
  if (pursuit) {
    state.pursuit = [{ ...pursuit[0] }, { ...pursuit[1] }];
    state.pursuitBase = [{ ...pursuit[0] }, { ...pursuit[1] }];
  }
  if (coached) state.coached = [coached[0], coached[1]];
  state.botNoise = randomizer(setup.seed * 7919 + 17);
  scatterStart(state, setup.seed);

  const controls = freshControls();
  const possession: TeamPair = [0, 0];
  const swarm: TeamPair = [0, 0];
  const exposed: TeamPair = [0, 0];
  const chaserChanges: TeamPair = [0, 0];
  const emergencies: TeamPair = [0, 0];
  const stranded: TeamPair = [0, 0];
  const surfaced: TeamPair = [0, 0];
  let chasers = [...state.puckChasers];
  const downed = new Set<number>();
  let samples = 0;

  for (let step = 0; !state.finished; step += 1) {
    stepSimulation(state, controls, STEP);
    for (const player of state.players) {
      if (player.emergency) {
        if (!downed.has(player.id)) {
          downed.add(player.id);
          emergencies[player.team] += 1;
        }
      } else downed.delete(player.id);
    }
    for (const team of [0, 1] as const) {
      const current = state.puckChasers[team];
      if (current !== chasers[team]) chaserChanges[team] += 1;
    }
    chasers = [...state.puckChasers];
    if (step % SAMPLE_STRIDE !== 0) continue;
    samples += 1;
    const owner = state.players.find(
      (player): boolean => player.id === state.puck.controlOwner,
    );
    if (owner) possession[owner.team] += 1;
    for (const team of [0, 1] as const) {
      const mates = state.players.filter(
        (player): boolean => player.team === team,
      );
      swarm[team] += mates.filter(
        (player): boolean =>
          player.position.distanceTo(state.puck.position) < SWARM_RADIUS,
      ).length;
      const defending = state.puck.position.z * attackDirection(team) < 0;
      if (defending && !mates.some((mate): boolean => goalSide(state, mate)))
        exposed[team] += 1;
      const away = mates.filter(
        (mate): boolean =>
          mate.mode === "ascending" || mate.mode === "recovering",
      ).length;
      surfaced[team] += away;
      // Half the team off the floor at once leaves the game briefly uncontested.
      if (away * 2 >= mates.length) stranded[team] += 1;
    }
  }

  const seconds = SAMPLE_STRIDE * STEP;
  return {
    setup,
    scores: [state.scores[0], state.scores[1]],
    shots: state.shots,
    contacts: state.contacts,
    possession: [possession[0] * seconds, possession[1] * seconds],
    swarm: [swarm[0] / samples, swarm[1] / samples],
    exposed: [exposed[0] * seconds, exposed[1] * seconds],
    chaserChanges,
    emergencies,
    stranded: [stranded[0] * seconds, stranded[1] * seconds],
    surfaced: [surfaced[0] / samples, surfaced[1] / samples],
  };
};

export const trialMatrix = (
  formations: readonly Formation[],
  difficulties: readonly BotDifficulty[],
  rulesets: readonly Ruleset[],
  seeds: number,
): TrialSetup[] =>
  formations.flatMap((formation): TrialSetup[] =>
    formations.flatMap((opposition): TrialSetup[] =>
      difficulties.flatMap((difficulty): TrialSetup[] =>
        rulesets.flatMap((ruleset): TrialSetup[] =>
          Array.from(
            { length: seeds },
            (_, seed): TrialSetup => ({
              formation,
              opposition,
              difficulty,
              ruleset,
              seed: seed + 1,
            }),
          ),
        ),
      ),
    ),
  );

export type TrialJob = {
  setup: TrialSetup;
  pursuit?: TeamWeights;
  coached?: [boolean, boolean];
  builds?: [RoleBuilds, RoleBuilds];
};

export const runJob = (job: TrialJob): TrialReport =>
  runTrial(job.setup, job.pursuit, job.coached, job.builds);

// What the tested side runs. The other side runs the shipped weights with the
// coach on, unless the variant says otherwise for both sides.
export type DuelVariant = {
  pursuit?: { tested: PursuitWeights; other: PursuitWeights };
  coached?: { tested: boolean; other: boolean };
  builds?: { tested: RoleBuilds; other: RoleBuilds };
};

// Team 0 and team 1 do not start from mirrored positions, so every setup is
// played from both sides. Job 2n puts the tested side on team 0 and job 2n+1
// puts it on team 1, and `tallyDuel` relies on that order.
export const duelJobs = (
  setups: readonly TrialSetup[],
  variant: DuelVariant,
): TrialJob[] =>
  setups.flatMap((setup): TrialJob[] =>
    ([0, 1] as const).map((side): TrialJob => {
      const { pursuit, coached, builds } = variant;
      return {
        setup,
        pursuit: pursuit
          ? side === 0
            ? [pursuit.tested, pursuit.other]
            : [pursuit.other, pursuit.tested]
          : undefined,
        coached: coached
          ? side === 0
            ? [coached.tested, coached.other]
            : [coached.other, coached.tested]
          : undefined,
        builds: builds
          ? side === 0
            ? [builds.tested, builds.other]
            : [builds.other, builds.tested]
          : undefined,
      };
    }),
  );

export type DuelResult = {
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  // Goal difference of the tested side for each setup, summed over both sides.
  // The pair is the independent sample, so the standard error uses these.
  pairDiffs: number[];
  exposed: number;
  swarm: number;
  chaserChanges: number;
};

export const tallyDuel = (reports: readonly TrialReport[]): DuelResult => {
  const result: DuelResult = {
    matches: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    pairDiffs: [],
    exposed: 0,
    swarm: 0,
    chaserChanges: 0,
  };
  for (const [index, report] of reports.entries()) {
    const side = index % 2;
    const diff = report.scores[side] - report.scores[1 - side];
    result.matches += 1;
    result.goalsFor += report.scores[side];
    result.goalsAgainst += report.scores[1 - side];
    if (side === 0) result.pairDiffs.push(diff);
    else result.pairDiffs[result.pairDiffs.length - 1] += diff;
    result.exposed += report.exposed[side];
    result.swarm += report.swarm[side];
    result.chaserChanges += report.chaserChanges[side];
  }
  return result;
};

export const duel = (
  setups: readonly TrialSetup[],
  variant: DuelVariant,
): DuelResult => tallyDuel(duelJobs(setups, variant).map(runJob));
