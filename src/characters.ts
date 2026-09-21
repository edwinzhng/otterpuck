export const CHARACTER_SPECIES = [
  "otter",
  "beaver",
  "raccoon",
  "crocodile",
  "penguin",
  "walrus",
  "puffin",
  "dolphin",
] as const;
export type CharacterSpecies = (typeof CHARACTER_SPECIES)[number];

export const randomOpponent = (
  selected: CharacterSpecies,
  random: () => number = Math.random,
): CharacterSpecies => {
  const choices = CHARACTER_SPECIES.filter((species) => species !== selected);
  return choices[Math.floor(random() * choices.length)] ?? choices[0];
};

export const CHARACTER_LABELS: Record<CharacterSpecies, string> = {
  otter: "Otter",
  beaver: "Beaver",
  raccoon: "Raccoon",
  crocodile: "Crocodile",
  penguin: "Penguin",
  walrus: "Walrus",
  puffin: "Puffin",
  dolphin: "Dolphin",
};

export const isCharacterSpecies = (value: unknown): value is CharacterSpecies =>
  CHARACTER_SPECIES.some((species): boolean => species === value);
