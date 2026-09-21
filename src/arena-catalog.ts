export const ARENA_IDS = [
  "tropical",
  "city",
  "alpine",
  "forest",
  "ruins",
  "desert",
  "glacier",
  "terminal",
] as const;

export type ArenaId = (typeof ARENA_IDS)[number];

export const ARENA_LABELS: Record<ArenaId, string> = {
  tropical: "Tropical Cove",
  city: "Neon Rooftop",
  alpine: "Alpine Lodge",
  forest: "Forest Hot Springs",
  ruins: "Rainforest Ruins",
  desert: "Desert Oasis",
  glacier: "Glacier Base",
  terminal: "Container Terminal",
};

export const isArenaId = (value: unknown): value is ArenaId =>
  ARENA_IDS.some((id): boolean => id === value);
