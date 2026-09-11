import type { Team } from "./types";

export const matchResult = (
  scores: readonly [number, number],
  team: Team,
): {
  outcome: "win" | "loss" | "draw";
  title: string;
  score: string;
  teams: string;
} => {
  const own = scores[team];
  const opponent = scores[team === 0 ? 1 : 0];
  const outcome = own === opponent ? "draw" : own > opponent ? "win" : "loss";
  return {
    outcome,
    title:
      outcome === "win" ? "YOU WIN!" : outcome === "loss" ? "DEFEAT" : "DRAW",
    score: `${own} — ${opponent}`,
    teams: team === 0 ? "OTTERS · BEAVERS" : "BEAVERS · OTTERS",
  };
};
