import { z } from "zod";
export const PROTOCOL = 3;
export const teamSizeSchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(6),
]);
const axis = z.number().finite().min(-1).max(1);
export const controlsSchema = z.object({
  forward: axis,
  lateral: axis,
  vertical: axis,
  sprint: z.boolean(),
  curl: axis,
  yawDelta: z.number().finite().min(-4).max(4),
  pitch: z.number().finite().min(-2).max(2),
  dummyMode: z.boolean(),
  dummy: axis,
  knockdown: z.boolean(),
  pushPull: z.boolean(),
  backhand: z.boolean(),
  dive: z.boolean(),
  shot: z.number().min(0).max(1),
  charging: z.boolean(),
  charge: z.number().min(0).max(1),
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
    name: z.string().trim().max(24).optional(),
    handedness: z.enum(["left", "right"]).optional(),
    mode: z.enum(["online", "lan"]),
    team: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
  z.object({
    type: z.literal("join"),
    protocol: z.literal(PROTOCOL),
    name: z.string().trim().max(24).optional(),
    handedness: z.enum(["left", "right"]).optional(),
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
  z.object({ type: z.literal("settings"), teamSize: teamSizeSchema }),
  z.object({
    type: z.literal("profile"),
    name: z.string().trim().max(24).optional(),
    handedness: z.enum(["left", "right"]).optional(),
    playerId: z.number().int().min(0).max(11).optional(),
  }),
  z.object({
    type: z.literal("input"),
    sequence: z.number().int().nonnegative(),
    controls: controlsSchema,
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
  id: z.string().uuid(),
  name: z.string().max(24),
  playerId: z.number().int().min(0).max(11),
  connected: z.boolean(),
  handedness: z.enum(["left", "right"]).optional(),
});
export const roomSchema = z.object({
  code: z.string(),
  region: z.string(),
  mode: z.enum(["online", "lan"]),
  phase: z.enum(["waiting", "playing"]),
  hostId: z.string().uuid(),
  teamSize: teamSizeSchema,
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
export const decodeMessage = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
