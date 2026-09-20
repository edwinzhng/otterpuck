import type { BotDifficulty } from "./types";

export const BOT_DIFFICULTY_OPTIONS = [
  ["easy", "Easy"],
  ["medium", "Medium"],
  ["hard", "Hard"],
  ["elite", "Elite"],
] as const satisfies readonly (readonly [BotDifficulty, string])[];

export const MATCH_DURATION_OPTIONS = [
  [180, "3 min"],
  [300, "5 min"],
  [600, "10 min"],
] as const;

export const DEFAULT_MATCH_DURATION = 180;

export const matchDurationChoice = (value: string): number | undefined =>
  MATCH_DURATION_OPTIONS.find(([seconds]) => String(seconds) === value)?.[0];

export const botDifficultyChoice = (value: string): BotDifficulty | undefined =>
  BOT_DIFFICULTY_OPTIONS.find(([difficulty]) => difficulty === value)?.[0];
