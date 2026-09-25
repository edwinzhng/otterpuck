import { playerPosition } from "./positions";
import type { Goal, Player, Simulation, Team } from "./types";

// Room names of the human players, by player id. Offline matches have none.
export type PlayerNames = ReadonlyMap<number, string>;

export const NO_NAMES: PlayerNames = new Map();

// The local player is always first in the state.
export const playerName = (
  state: Simulation,
  player: Player,
  names: PlayerNames,
): string =>
  player.human && player === state.players.at(0)
    ? "You"
    : (player.human ? names.get(player.id) : undefined) ||
      playerPosition(state, player).name;

export type ScorerLine = { name: string; goals: number; ownGoal: boolean };

// Groups a team's goals by scorer, in the order of each scorer's first goal.
export const teamScorers = (
  state: Simulation,
  team: Team,
  names: PlayerNames,
): ScorerLine[] => {
  const lines = new Map<string, ScorerLine>();
  for (const goal of state.goals) {
    if (goal.team !== team) continue;
    const scorer = scorerOf(state, goal);
    const ownGoal = scorer !== undefined && scorer.team !== team;
    const name = scorer ? playerName(state, scorer, names) : "Unknown";
    const key = `${name}:${ownGoal}`;
    const line = lines.get(key) ?? { name, goals: 0, ownGoal };
    line.goals += 1;
    lines.set(key, line);
  }
  return [...lines.values()];
};

const scorerOf = (state: Simulation, goal: Goal): Player | undefined =>
  state.players.find((player): boolean => player.id === goal.scorer);
