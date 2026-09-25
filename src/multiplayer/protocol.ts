import { z } from "zod";
import { ARENA_IDS } from "../arena-catalog";
import { CHARACTER_SPECIES } from "../characters";
import {
  ATTRIBUTE_POINTS,
  attributePoints,
  MAX_ATTRIBUTE,
  MAX_HELD,
  MIN_ATTRIBUTE,
} from "../player-profile";
import { SWIM_TURNS } from "../swim-turn";
export const PROTOCOL = 12;
const speciesSchema = z.enum(CHARACTER_SPECIES);
const teamSpeciesSchema = z.tuple([speciesSchema, speciesSchema]);
export const teamSizeSchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(6),
]);
export const swimTurnSchema = z.union(
  SWIM_TURNS.map((turn) => z.literal(turn)),
);
export const botDifficultySchema = z.enum(["easy", "medium", "hard", "elite"]);
const level = z.number().int().min(MIN_ATTRIBUTE).max(MAX_ATTRIBUTE);
// Bots at higher difficulty spend more points than a player, so snapshots
// check only the levels. Player profiles also check the point budget.
export const attributeLevelsSchema = z.object({
  strength: level,
  technique: level,
  fitness: level,
});
export const attributesSchema = attributeLevelsSchema.refine(
  (attributes): boolean => attributePoints(attributes) <= ATTRIBUTE_POINTS,
);
const profileFields = {
  name: z.string().trim().max(24).optional(),
  handedness: z.enum(["left", "right"]).optional(),
  attributes: attributesSchema.optional(),
  autoCurl: z.boolean().optional(),
};
const axis = z.number().finite().min(-1).max(1);
export const controlsSchema = z.object({
  forward: axis,
  lateral: axis,
  vertical: axis,
  sprint: z.boolean(),
  curl: axis,
  // Glance changes the local view only. Older packets can omit this field.
  glance: axis.default(0),
  yawDelta: z.number().finite().min(-4).max(4),
  pitch: z.number().finite().min(-2).max(2),
  dummyMode: z.boolean(),
  dummy: axis,
  knockdown: z.boolean(),
  backhand: z.boolean(),
  dive: z.boolean(),
  shot: z.number().min(0).max(MAX_HELD),
  charging: z.boolean(),
  charge: z.number().min(0).max(MAX_HELD),
});
export const signalSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("offer"), sdp: z.string().max(16000) }),
  z.object({ type: z.literal("answer"), sdp: z.string().max(16000) }),
  z.object({
    type: z.literal("candidate"),
    candidate: z.string().max(2048),
    sdpMid: z.string().max(100).nullable(),
    sdpMLineIndex: z.number().int().min(0).nullable(),
  }),
]);
export type Signal = z.infer<typeof signalSchema>;
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping"), nonce: z.number().finite() }),
  z.object({
    type: z.literal("create"),
    protocol: z.literal(PROTOCOL),
    ...profileFields,
    mode: z.enum(["online", "lan"]),
    team: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
  z.object({
    type: z.literal("join"),
    protocol: z.literal(PROTOCOL),
    ...profileFields,
    code: z.string().regex(/^[A-Z2-9]{6}$/),
    team: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
  z.object({
    type: z.literal("resume"),
    protocol: z.literal(PROTOCOL),
    code: z.string().max(6),
    token: z.string().uuid(),
  }),
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("start") }),
  z.object({
    type: z.literal("loaded"),
    loadId: z.number().int().nonnegative(),
    ok: z.boolean(),
  }),
  z.object({
    type: z.literal("settings"),
    teamSpecies: teamSpeciesSchema.optional(),
    arena: z.enum(ARENA_IDS).optional(),
    teamSize: teamSizeSchema.optional(),
    swimTurn: swimTurnSchema.optional(),
    difficulty: botDifficultySchema.optional(),
  }),
  z.object({
    type: z.literal("profile"),
    ...profileFields,
    playerId: z.number().int().min(0).max(11).optional(),
  }),
  z.object({
    type: z.literal("input"),
    sequence: z.number().int().nonnegative(),
    controls: controlsSchema,
    duration: z.number().min(0).max(0.5).optional(),
  }),
  z.object({
    type: z.literal("signal"),
    to: z.string().uuid(),
    signal: signalSchema,
  }),
  z.object({ type: z.literal("checkpoint"), state: z.unknown() }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export const memberSchema = z.object({
  species: speciesSchema,
  id: z.string().uuid(),
  name: z.string().max(24),
  playerId: z.number().int().min(0).max(11),
  connected: z.boolean(),
  handedness: z.enum(["left", "right"]).optional(),
  attributes: attributesSchema.optional(),
  autoCurl: z.boolean().optional(),
});
export const roomSchema = z.object({
  arena: z.enum(ARENA_IDS),
  code: z.string(),
  region: z.string(),
  mode: z.enum(["online", "lan"]),
  phase: z.enum(["waiting", "loading", "playing"]),
  loadId: z.number().int().nonnegative(),
  hostId: z.string().uuid(),
  teamSize: teamSizeSchema,
  teamSpecies: teamSpeciesSchema,
  swimTurn: swimTurnSchema,
  difficulty: botDifficultySchema,
  members: z.array(memberSchema).max(12),
});
export type RoomView = z.infer<typeof roomSchema>;
export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pong"), nonce: z.number(), region: z.string() }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
    fatal: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("session"),
    id: z.string().uuid(),
    token: z.string().uuid(),
    room: roomSchema,
  }),
  z.object({ type: z.literal("room"), room: roomSchema }),
  z.object({
    type: z.literal("snapshot"),
    state: z.unknown(),
    acknowledged: z.record(z.string(), z.number()).optional(),
  }),
  z.object({
    type: z.literal("signal"),
    from: z.string().uuid(),
    signal: signalSchema,
  }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
const booleanFromWire = (value: unknown): unknown =>
  value === 0 ? false : value === 1 ? true : value;
const CONTROL_WIRE_FIELDS = [
  "forward",
  "lateral",
  "vertical",
  "sprint",
  "curl",
  "glance",
  "yawDelta",
  "pitch",
  "dummyMode",
  "dummy",
  "knockdown",
  "backhand",
  "dive",
  "shot",
  "charging",
  "charge",
] as const satisfies readonly (keyof z.infer<typeof controlsSchema>)[];
const BOOLEAN_CONTROL_FIELDS = new Set<string>([
  "sprint",
  "dummyMode",
  "knockdown",
  "backhand",
  "dive",
  "charging",
]);
export const encodeClientMessage = (message: ClientMessage): string => {
  if (message.type !== "input") return JSON.stringify(message);
  return JSON.stringify([
    "i",
    message.sequence,
    message.duration ?? null,
    ...CONTROL_WIRE_FIELDS.map((field) => {
      const value = message.controls[field];
      return typeof value === "boolean" ? Number(value) : value;
    }),
  ]);
};
const expandWireInput = (value: unknown): unknown => {
  if (
    !Array.isArray(value) ||
    value.at(0) !== "i" ||
    value.length !== CONTROL_WIRE_FIELDS.length + 3
  )
    return value;
  return {
    type: "input",
    sequence: value.at(1),
    duration: value.at(2) === null ? undefined : value.at(2),
    controls: Object.fromEntries(
      CONTROL_WIRE_FIELDS.map((field, index) => {
        const wireValue = value.at(index + 3);
        return [
          field,
          BOOLEAN_CONTROL_FIELDS.has(field)
            ? booleanFromWire(wireValue)
            : wireValue,
        ];
      }),
    ),
  };
};
export const decodeMessage = (text: string): unknown => {
  try {
    return expandWireInput(JSON.parse(text));
  } catch {
    return undefined;
  }
};
