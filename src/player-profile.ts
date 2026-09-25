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

// Strength: level 5 swims 6% faster and flicks the puck 10% faster. It also
// pushes a weaker swimmer aside on contact, see strengthPush.
export const swimSpeedScale = (attributes: Attributes): number =>
  scale(attributes.strength, 0.03);

// Strength and technique both lengthen the flick. Technique adds half as much
// per level.
export const flickScale = (attributes: Attributes): number =>
  1 +
  (attributes.strength - NEUTRAL_LEVEL) * 0.05 +
  (attributes.technique - NEUTRAL_LEVEL) * 0.025;

// Speed at which the stronger swimmer shoves a weaker one aside on contact,
// in meters per second. A 5 against 1 gap pushes at a quarter of the sprint
// speed; a one level gap barely pushes.
const FULL_PUSH = 0.25 * 2.9;
export const strengthPush = (
  stronger: Attributes,
  weaker: Attributes,
): number =>
  Math.max(0, stronger.strength - weaker.strength) *
  (FULL_PUSH / (MAX_ATTRIBUTE - MIN_ATTRIBUTE));

// Fitness: level 5 uses 10% less air underwater, refills air 20% faster at
// the surface and uses stamina 16% slower. Level 1 is the same amount worse.
export const airRefillScale = (attributes: Attributes): number =>
  scale(attributes.fitness, 0.1);
export const staminaDrainScale = (attributes: Attributes): number =>
  scale(attributes.fitness, -0.08);
export const airUseScale = (attributes: Attributes): number =>
  scale(attributes.fitness, -0.05);
// Fitness also brings the heart rate back to rest faster: 20% faster at level
// 5, 20% slower at level 1.
export const heartRecoveryScale = (attributes: Attributes): number =>
  scale(attributes.fitness, 0.1);

// Technique: level 5 curls 20% faster, reaches 30% further to challenge a
// carrier and covers the puck 30% better while curling. It also charges a
// shot in half the time; level 1 takes one and a half times as long.
export const curlSpeedScale = (attributes: Attributes): number =>
  scale(attributes.technique, 0.1);
export const tackleScale = (attributes: Attributes): number =>
  scale(attributes.technique, 0.15);
export const shieldScale = (attributes: Attributes): number =>
  scale(attributes.technique, 0.15);
export const chargeTimeScale = (attributes: Attributes): number =>
  scale(attributes.technique, -0.25);
// Technique also lowers the heart rate that playing the puck and curling add:
// 30% less at level 5, 30% more at level 1. A fast heart burns air, so a
// skilled carrier keeps the puck longer on one breath.
export const puckEffortScale = (attributes: Attributes): number =>
  scale(attributes.technique, -0.15);

// Longest useful hold, as a fraction of the 0.65 s full charge. Technique 1
// charges one and a half times slower, so it needs this long to reach full
// power.
export const MAX_HELD = 1.5;

// The weakest shot a release gives. A tap charges less than this.
export const MIN_SHOT_POWER = 0.22;

// Converts how long a player held the shot, as a fraction of 0.65 s, into shot
// power. Technique shortens the hold that reaches full power.
export const shotPower = (attributes: Attributes, held: number): number =>
  Math.min(1, Math.max(MIN_SHOT_POWER, held / chargeTimeScale(attributes)));
export const chargePower = (attributes: Attributes, held: number): number =>
  Math.min(1, held / chargeTimeScale(attributes));
