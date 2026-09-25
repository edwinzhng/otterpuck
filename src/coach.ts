import { teamSize } from "./positions";
import {
  attackDirection,
  clamp,
  type Formation,
  type Player,
  type Simulation,
  type Team,
  type TeamSize,
} from "./types";

export type CoachPlan = {
  formation: Formation;
  // Ordinal 0 to 3, from containing the goal to committing everyone forward.
  aggression: number;
  // Multiplies the air a bot holds back. Below 1 spends air to keep pressing.
  airBudget: number;
  // 0 holds every role, 1 lets the whole team contest the puck.
  commit: number;
};

// Shapes for each roster size, ordered from the most defensive to the most
// attacking. The coach may only move along its own row, because the snapshot
// schema requires the shape to match the number of players on the team.
const shapeLadder = {
  6: ["1-3-2", "2-3-1", "3-3"],
  3: ["1-2", "2-1"],
  2: ["1-1"],
} as const satisfies Record<TeamSize, readonly Formation[]>;

export const MAX_AGGRESSION = 3;
// A team this far behind or ahead late in the match changes how it plays.
const CLOSING_SECONDS = 45;
// Below this air a player must plan to surface and cannot hold a pressing role.
// Players cycle for air constantly, so the bar is set where a surface is due
// rather than where air is merely dropping.
const LOW_AIR = 25;

const strainedCount = (mates: readonly Player[]): number =>
  mates.filter((mate): boolean => mate.air < LOW_AIR).length;

export const heuristicPlan = (state: Simulation, team: Team): CoachPlan => {
  const mates = state.players.filter((player): boolean => player.team === team);
  const lead = state.scores[team] - state.scores[1 - team];
  const closing = state.seconds <= CLOSING_SECONDS;
  const defending = state.puck.position.z * attackDirection(team) < 0;

  let aggression = defending ? 1 : 2;
  if (lead < 0) aggression = closing ? MAX_AGGRESSION : 2;
  else if (lead > 0) aggression = closing ? 0 : 1;
  // The shape only drops back when half the team is due to surface. A smaller
  // number is normal play and must not pin the team into its own half.
  if (strainedCount(mates) * 2 >= mates.length) aggression -= 1;
  aggression = clamp(aggression, 0, MAX_AGGRESSION);

  const push = aggression / MAX_AGGRESSION;
  const ladder = shapeLadder[teamSize(state.formations[team])];
  const rung = Math.round(push * (ladder.length - 1));

  return {
    formation: ladder[rung] ?? ladder[0],
    aggression,
    // A contained team banks its air and holds its roles. A pressing team
    // spends air to stay down and lets more players leave their lane.
    airBudget: 1.25 - 0.5 * push,
    commit: push,
  };
};

export const applyPlan = (
  state: Simulation,
  team: Team,
  plan: CoachPlan,
): void => {
  // A team with a human keeps the shape the players picked. The coach still
  // sets its tactics.
  const humanTeam = state.players.some(
    (player): boolean => player.team === team && player.human,
  );
  if (
    !humanTeam &&
    teamSize(plan.formation) === teamSize(state.formations[team])
  )
    state.formations[team] = plan.formation;

  state.tactics[team].airBudget = clamp(plan.airBudget, 0.6, 1.5);

  const base = state.pursuitBase[team];
  const live = state.pursuit[team];
  const commit = clamp(plan.commit, 0, 1);
  Object.assign(live, base);
  // Committing loosens the penalties that hold a player in its lane and keep a
  // back on the goal, so more of the team contests the puck.
  live.acrossCourt = base.acrossCourt * (1 - 0.6 * commit);
  live.keeper = base.keeper * (1 - 0.7 * commit);
  live.pressureDuty = base.pressureDuty * (1 + commit);
  live.hysteresis = base.hysteresis * (1 - 0.4 * commit);
};

export const coachTeam = (state: Simulation, team: Team): void => {
  if (!state.coached[team]) return;
  applyPlan(state, team, heuristicPlan(state, team));
};
