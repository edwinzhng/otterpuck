import type { Attributes } from "./types";

export const ATTRIBUTE_NAMES = ["strength", "technique", "fitness"] as const;
export const ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  strength: "Strength",
  technique: "Technique",
  fitness: "Fitness",
};
export const MIN_ATTRIBUTE = 1;
export const MAX_ATTRIBUTE = 5;
export const ATTRIBUTE_POINTS = 10;
// Level 3 reproduces the swimmer without personalisation. Bots use it, so
// every modifier below is exactly 1 for them.
const NEUTRAL_LEVEL = 3;
export const NEUTRAL_ATTRIBUTES: Attributes = {
  strength: NEUTRAL_LEVEL,
  technique: NEUTRAL_LEVEL,
  fitness: NEUTRAL_LEVEL,
};

const ATTRIBUTES_KEY = "otterpuck-attributes";
const AUTO_CURL_KEY = "otterpuck-auto-curl";

export const attributePoints = (attributes: Attributes): number =>
  attributes.strength + attributes.technique + attributes.fitness;

export const validAttributes = (attributes: Attributes): boolean =>
  ATTRIBUTE_NAMES.every(
    (name): boolean =>
      Number.isInteger(attributes[name]) &&
      attributes[name] >= MIN_ATTRIBUTE &&
      attributes[name] <= MAX_ATTRIBUTE,
  ) && attributePoints(attributes) <= ATTRIBUTE_POINTS;

const readAttributes = (value: unknown): Attributes | undefined => {
  if (typeof value !== "object" || value === null) return;
  const [strength, technique, fitness] = ATTRIBUTE_NAMES.map((name): unknown =>
    Reflect.get(value, name),
  );
  if (
    typeof strength !== "number" ||
    typeof technique !== "number" ||
    typeof fitness !== "number"
  )
    return;
  const attributes = { strength, technique, fitness };
  return validAttributes(attributes) ? attributes : undefined;
};

export const savedAttributes = (): Attributes => {
  try {
    return (
      readAttributes(
        JSON.parse(localStorage.getItem(ATTRIBUTES_KEY) ?? "null"),
      ) ?? {
        ...NEUTRAL_ATTRIBUTES,
      }
    );
  } catch {
    return { ...NEUTRAL_ATTRIBUTES };
  }
};

export const saveAttributes = (attributes: Attributes): void => {
  try {
    localStorage.setItem(ATTRIBUTES_KEY, JSON.stringify(attributes));
  } catch {}
};

export const savedAutoCurl = (): boolean => {
  try {
    return localStorage.getItem(AUTO_CURL_KEY) === "true";
  } catch {
    return false;
  }
};

export const saveAutoCurl = (enabled: boolean): void => {
  try {
    localStorage.setItem(AUTO_CURL_KEY, String(enabled));
  } catch {}
};

// Each level above or below 3 changes a quality by a fixed fraction. The
// ranges stay small so a build changes the feel of a swimmer, not the rules.
const scale = (level: number, perLevel: number): number =>
  1 + (level - NEUTRAL_LEVEL) * perLevel;

// Fitness: level 5 drains air 14% slower and recovers air and stamina 20%
// faster. Level 1 is the same amount worse.
export const airDrainScale = (attributes: Attributes): number =>
  scale(attributes.fitness, -0.07);
export const recoveryScale = (attributes: Attributes): number =>
  scale(attributes.fitness, 0.1);

// Strength: level 5 flicks the puck 14% faster and swims 6% faster.
export const flickScale = (attributes: Attributes): number =>
  scale(attributes.strength, 0.07);
export const swimSpeedScale = (attributes: Attributes): number =>
  scale(attributes.strength, 0.03);

// Technique: level 5 curls 16% faster, reaches 20% further to challenge a
// carrier and covers the puck 20% better while curling.
export const curlSpeedScale = (attributes: Attributes): number =>
  scale(attributes.technique, 0.08);
export const tackleScale = (attributes: Attributes): number =>
  scale(attributes.technique, 0.1);
export const shieldScale = (attributes: Attributes): number =>
  scale(attributes.technique, 0.1);
