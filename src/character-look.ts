export type CharacterRampStop = {
  position: number;
  color: readonly [number, number, number];
};

export const characterRampStops: readonly CharacterRampStop[] = [
  { position: 0, color: [0.3, 0.35, 0.46] },
  { position: 0.32, color: [0.39, 0.44, 0.54] },
  { position: 0.6, color: [0.63, 0.64, 0.68] },
  { position: 0.84, color: [0.88, 0.85, 0.8] },
  { position: 1, color: [1, 0.99, 0.95] },
];

export const sampleCharacterRamp = (
  position: number,
): readonly [number, number, number] => {
  const upper = characterRampStops.findIndex(
    (stop): boolean => stop.position >= position,
  );
  const end = characterRampStops.at(upper < 0 ? -1 : upper);
  const start = characterRampStops.at(Math.max(0, upper - 1));
  if (!start || !end) throw new Error("Character shading palette is empty");
  const width = end.position - start.position;
  const fraction =
    width > 0
      ? Math.max(0, Math.min(1, (position - start.position) / width))
      : 0;
  const blend = fraction * fraction * (3 - 2 * fraction);
  const channel = (index: number): number => {
    const from = start.color.at(index) ?? 0;
    return from + ((end.color.at(index) ?? from) - from) * blend;
  };
  return [channel(0), channel(1), channel(2)];
};

export const characterKeyDirection: readonly [number, number, number] = [
  -0.45, 0.85, -0.6,
];
