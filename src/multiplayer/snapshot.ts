import { Quaternion, Vector3 } from "three";
import { z } from "zod";
import { pursuitWeights } from "../bots";
import { CHARACTER_SPECIES } from "../characters";
import { coachTeam } from "../coach";
import { teamSize } from "../positions";
import { NEUTRAL_TACTICS, type Simulation } from "../types";
import { attributeLevelsSchema } from "./protocol";

const n = z.number().finite();
const vector = z
  .object({ x: n, y: n, z: n })
  .transform((v) => new Vector3(v.x, v.y, v.z));
const quaternion = z.tuple([n, n, n, n]).transform((v) => new Quaternion(...v));
const playerFields = z.object({
  species: z.enum(CHARACTER_SPECIES),
  id: n,
  team: z.union([z.literal(0), z.literal(1)]),
  slot: n,
  human: z.boolean(),
  handedness: z.enum(["left", "right"]),
  attributes: attributeLevelsSchema,
  autoCurl: z.boolean(),
  position: vector,
  previous: vector,
  previousYaw: n,
  previousBodyPitch: n,
  dummyBurstUntil: n,
  autoDummyUntil: n.default(0),
  autoDummyLocked: z.boolean().default(false),
  velocity: vector,
  yaw: n,
  aimYaw: n.optional(),
  plannedShot: z
    .object({ yaw: n, power: n, hold: z.boolean().optional() })
    .optional(),
  evadeSide: n,
  evadeUntil: n,
  evadeTarget: vector,
  air: n,
  stamina: n,
  heartRate: n,
  mode: z.enum(["playing", "ascending", "recovering", "diving"]),
  duty: z.enum(["pressure", "support", "cover", "recover"]),
  role: z.string().max(120),
  target: vector,
  formationTarget: vector,
  wantDown: z.boolean(),
  cycleUntil: n,
  sprint: z.boolean(),
  kick: n,
  kickPhase: n,
  bodyPitch: n,
  bodyRoll: n,
  wallReady: z.boolean(),
  handling: z.boolean(),
  curl: n,
  curlTurnSpeed: n,
  turnRate: n,
  event: z.string().max(120).default(""),
  eventTime: n.default(0),
  dummy: n,
  lateral: n,
  cradle: z
    .object({
      kind: z.enum(["curl", "charge", "dummy", "settling"]),
      elapsed: n,
      origin: vector,
      target: vector,
      turnDirection: n,
      originFace: n,
    })
    .optional(),
  grab: z.object({ elapsed: n, target: vector }).optional(),
  knockdownTime: n,
  knockdownCooldown: n,
  knockdownAttempted: z.boolean(),
  knockdownTarget: vector,
  curlBlockedUntil: n,
  stickOffset: vector,
  stick: vector,
  previousStick: vector,
  stickVelocity: vector,
  stickYaw: n,
  previousStickYaw: n,
  stickOrientation: quaternion,
  previousStickOrientation: quaternion,
  bladeRotation: n,
  bladeFace: n,
  bladeTilt: n,
  backhand: z.boolean(),
  shotTime: n,
  charging: z.boolean(),
  charge: n,
  shotDraw: n,
  shotPower: n,
  shotLoft: n,
  shotFired: z.boolean(),
  shotDirection: vector,
  shotOrigin: vector.optional(),
  shotStartPosition: vector,
  shotGrip: vector,
  cooldown: n,
  emergency: z.boolean(),
});
const playerSchema = playerFields.transform((p) => ({
  ...p,
  aimYaw: p.aimYaw,
  plannedShot: p.plannedShot,
  cradle: p.cradle,
  grab: p.grab,
  shotOrigin: p.shotOrigin,
}));
const puckFields = z.object({
  flightOrientation: quaternion.optional(),
  position: vector,
  previous: vector,
  velocity: vector,
  spin: n,
  rotation: n,
  orientation: quaternion,
  previousOrientation: quaternion,
  angularVelocity: vector,
  shotOwner: n.optional(),
  lastTouch: n.optional(),
  touchTime: n,
  controlOwner: n.optional(),
  controlKind: z
    .enum(["carry", "curl", "dummy", "settling", "charge"])
    .optional(),
  controlUntil: n,
});
const puckSchema = puckFields.transform((p) => ({
  ...p,
  flightOrientation: p.flightOrientation,
  shotOwner: p.shotOwner,
  lastTouch: p.lastTouch,
  controlOwner: p.controlOwner,
  controlKind: p.controlKind,
}));
const formation = z.enum(["3-3", "2-3-1", "1-3-2", "2-1", "1-2", "1-1"]);
const optionalId = n
  .optional()
  .nullable()
  .transform((v) => v ?? undefined);
const rotation = z.object({
  outgoing: n,
  incoming: n,
  phase: z.enum(["handoff", "recover", "return"]),
  started: n,
});
export const snapshotSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard", "elite"]),
  ruleset: z.enum(["alternative", "original"]),
  physics: z.object({ drag: n, lift: n }),
  playground: z.object({
    slowMotion: z.boolean(),
    camera: z.enum(["first-person", "side"]),
    trace: z.array(vector).max(180),
    distance: n,
    peak: n,
    origin: vector,
  }),
  players: z
    .array(playerSchema)
    .min(4)
    .max(12)
    .refine(
      (players) =>
        new Set(players.map((p) => p.id)).size === players.length &&
        players.every((p) => Number.isInteger(p.id) && p.id >= 0 && p.id < 12),
    ),
  puck: puckSchema,
  formations: z.tuple([formation, formation]),
  scores: z.tuple([n, n]),
  goals: z
    .array(
      z.object({
        team: z.union([z.literal(0), z.literal(1)]),
        scorer: optionalId,
        second: n,
      }),
    )
    .max(200),
  seconds: n,
  duration: n,
  time: n,
  decisionTime: n,
  restartTime: n,
  faceoff: z
    .union([
      z.object({ phase: z.literal("ready"), remaining: n }),
      z.object({ phase: z.literal("strike"), elapsed: n }),
    ])
    .optional(),
  finished: z.boolean(),
  mode: z.literal("match"),
  backLeads: z.tuple([n, n]),
  puckChasers: z.tuple([optionalId, optionalId]),
  airRotations: z.tuple([z.array(rotation).max(12), z.array(rotation).max(12)]),
  strongSides: z.tuple([n, n]),
  event: z.string().max(120),
  eventTime: n,
  contacts: n,
  shots: n,
  swimTurn: n.default(1),
});
const rosterSchema = snapshotSchema.refine((state): boolean =>
  ([0, 1] as const).every(
    (team): boolean =>
      state.players.filter((player): boolean => player.team === team).length ===
      teamSize(state.formations[team]),
  ),
);
export const parseSnapshot = (value: unknown): Simulation | undefined => {
  const result = rosterSchema.safeParse(unpackSnapshot(value));
  if (!result.success) return undefined;
  const state: Simulation = {
    ...result.data,
    faceoff: result.data.faceoff,
    pursuit: [{ ...pursuitWeights }, { ...pursuitWeights }],
    pursuitBase: [{ ...pursuitWeights }, { ...pursuitWeights }],
    coached: [true, true],
    tactics: [{ ...NEUTRAL_TACTICS }, { ...NEUTRAL_TACTICS }],
  };
  // Weights and tactics are derived, not sent. The coach reads only fields the
  // snapshot carries, so re-running it here rebuilds what the host holds and
  // keeps the wire format unchanged.
  coachTeam(state, 0);
  coachTeam(state, 1);
  return state;
};
export const localView = (state: Simulation, playerId: number): Simulation => {
  state.players.sort(
    (a, b) => Number(b.id === playerId) - Number(a.id === playerId),
  );
  return state;
};

const playerKeys = Object.keys(playerFields.shape);
const puckKeys = Object.keys(puckFields.shape);
const stateKeys = Object.keys(snapshotSchema.shape).filter(
  (key) => key !== "players" && key !== "puck",
);
const packRecord = (value: object, keys: readonly string[]): unknown[] =>
  keys.map((key): unknown => Reflect.get(value, key));
export const packSnapshot = (state: Simulation): object => ({
  wire: 1,
  state: packRecord(state, stateKeys),
  players: state.players.map((player) => packRecord(player, playerKeys)),
  puck: packRecord(state.puck, puckKeys),
});
const packedSchema = z.object({
  wire: z.literal(1),
  state: z.array(z.unknown()).length(stateKeys.length),
  players: z
    .array(z.array(z.unknown()).length(playerKeys.length))
    .min(4)
    .max(12),
  puck: z.array(z.unknown()).length(puckKeys.length),
});
const unpackRecord = (values: unknown[], keys: readonly string[]): object =>
  Object.fromEntries(
    keys.map((key, index) => [
      key,
      values[index] === null ? undefined : values[index],
    ]),
  );
const unpackSnapshot = (value: unknown): unknown => {
  const packed = packedSchema.safeParse(value);
  if (!packed.success) return value;
  return {
    ...unpackRecord(packed.data.state, stateKeys),
    players: packed.data.players.map((player) =>
      unpackRecord(player, playerKeys),
    ),
    puck: unpackRecord(packed.data.puck, puckKeys),
  };
};
export const stringifySnapshot = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown): unknown =>
    typeof item === "number" && Math.abs(item) < 1e6
      ? Math.round(item * 10000) / 10000
      : item,
  );
