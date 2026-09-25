import { type Quaternion, Vector3 } from "three";
import type { CharacterSpecies } from "./characters";

export type Formation = "3-3" | "2-3-1" | "1-3-2" | "2-1" | "1-2" | "1-1";
export type TeamSize = 2 | 3 | 6;
export type Team = 0 | 1;
export type Species = CharacterSpecies;
export type BotDifficulty = "easy" | "medium" | "hard" | "elite";
// Personal levels from 1 to 5. See player-profile.ts for their effects.
export type Attributes = {
  strength: number;
  technique: number;
  fitness: number;
};
export type MatchSelection = {
  team?: Team;
  species: Species;
  position: number;
  difficulty: BotDifficulty;
  ruleset?: Ruleset;
  swimTurn?: number;
  attributes?: Attributes;
  autoCurl?: boolean;
};
export type Handedness = "right" | "left";
export type WaterMode = "playing" | "ascending" | "recovering" | "diving";
export type Duty = "pressure" | "support" | "cover" | "recover";
export type GameMode = "match" | "practice" | "playground";
export type Ruleset = "alternative" | "original";
export type PuckCradle = {
  kind: "curl" | "charge" | "dummy" | "settling";
  elapsed: number;
  origin: Vector3;
  target: Vector3;
  turnDirection: number;
  originFace: number;
};
export type Player = {
  id: number;
  team: Team;
  species: CharacterSpecies;
  slot: number;
  human: boolean;
  handedness: Handedness;
  attributes: Attributes;
  // A hard turn with the puck while swimming forward without sprint becomes
  // a curl. Players turn this on in Settings.
  autoCurl: boolean;
  position: Vector3;
  previous: Vector3;
  previousYaw: number;
  previousBodyPitch: number;
  dummyBurstUntil: number;
  autoDummyUntil: number;
  autoDummyLocked: boolean;
  velocity: Vector3;
  yaw: number;
  aimYaw: number | undefined;
  // A bot's next shot or pass. The bot turns to this heading, charges and
  // releases like a player. A held shot charges on the way in but is not
  // released yet.
  plannedShot: { yaw: number; power: number; hold?: boolean } | undefined;
  evadeSide: number;
  evadeUntil: number;
  evadeTarget: Vector3;
  air: number;
  stamina: number;
  // Beats per minute. Only rulesets with a heart model change it.
  heartRate: number;
  // This event is visible only to this player.
  event: string;
  eventTime: number;
  mode: WaterMode;
  duty: Duty;
  role: string;
  target: Vector3;
  formationTarget: Vector3;
  wantDown: boolean;
  cycleUntil: number;
  sprint: boolean;
  kick: number;
  kickPhase: number;
  bodyPitch: number;
  bodyRoll: number;
  wallReady: boolean;
  handling: boolean;
  curl: number;
  curlTurnSpeed: number;
  turnRate: number;
  dummy: number;
  lateral: number;
  cradle: PuckCradle | undefined;
  grab: { elapsed: number; target: Vector3 } | undefined;
  knockdownTime: number;
  knockdownCooldown: number;
  knockdownAttempted: boolean;
  knockdownTarget: Vector3;
  curlBlockedUntil: number;
  stickOffset: Vector3;
  stick: Vector3;
  previousStick: Vector3;
  stickVelocity: Vector3;
  stickYaw: number;
  previousStickYaw: number;
  stickOrientation: Quaternion;
  previousStickOrientation: Quaternion;
  bladeRotation: number;
  bladeFace: number;
  bladeTilt: number;
  backhand: boolean;
  shotTime: number;
  charging: boolean;
  charge: number;
  shotDraw: number;
  shotPower: number;
  shotLoft: number;
  shotFired: boolean;
  shotDirection: Vector3;
  shotOrigin: Vector3 | undefined;
  shotStartPosition: Vector3;
  shotGrip: Vector3;
  cooldown: number;
  emergency: boolean;
};
export type Puck = {
  flightOrientation: Quaternion | undefined;
  position: Vector3;
  previous: Vector3;
  velocity: Vector3;
  spin: number;
  rotation: number;
  orientation: Quaternion;
  previousOrientation: Quaternion;
  angularVelocity: Vector3;
  shotOwner: number | undefined;
  lastTouch: number | undefined;
  touchTime: number;
  controlOwner: number | undefined;
  controlKind: "carry" | "curl" | "dummy" | "settling" | "charge" | undefined;
  controlUntil: number;
};
export type Faceoff =
  | { phase: "ready"; remaining: number }
  | { phase: "strike"; elapsed: number };
export type AirRotation = {
  outgoing: number;
  incoming: number;
  phase: "handoff" | "recover" | "return";
  started: number;
};
export type Controls = {
  forward: number;
  lateral: number;
  vertical: number;
  sprint: boolean;
  curl: number;
  glance: number;
  yawDelta: number;
  pitch: number;
  dummyMode: boolean;
  dummy: number;
  knockdown: boolean;
  backhand: boolean;
  dive: boolean;
  shot: number;
  charging: boolean;
  charge: number;
};

// Chaser costs are compared as distances in meters. Each weight adds or removes
// meters of apparent distance, so 1.0 is worth one meter of swimming.
export type PursuitWeights = {
  forwardBehindPuck: number;
  forwardAheadOfPuck: number;
  acrossCourt: number;
  keeper: number;
  pressureDuty: number;
  followingAttack: number;
  depth: number;
  humanNear: number;
  coveringRotation: number;
  outgoingRotation: number;
  hysteresis: number;
};

// Team wide tactics the coach sets. The neutral value reproduces the game as
// it plays with no coach, so an uncoached match is unaffected.
export type TeamTactics = {
  // Multiplies the air each bot holds back before it cycles to the surface.
  // Below 1 spends air to keep a player in the contest for longer.
  airBudget: number;
};

export const NEUTRAL_TACTICS: TeamTactics = { airBudget: 1 };

export type Simulation = {
  difficulty: BotDifficulty;
  // Each team carries its own chaser weights so tuning runs can play head to
  // head. The coach rewrites `pursuit` from `pursuitBase` on every decision
  // tick, so the base must survive untouched.
  pursuit: [PursuitWeights, PursuitWeights];
  pursuitBase: [PursuitWeights, PursuitWeights];
  coached: [boolean, boolean];
  tactics: [TeamTactics, TeamTactics];
  ruleset: Ruleset;
  // Bot match trials only. Bots are deterministic, so trial matches from
  // nearby starts replay almost the same game. A seeded jitter in bot timing
  // and targets makes each trial an independent sample. Live games leave it
  // unset, so hosts and clients stay in step.
  botNoise?: () => number;
  swimTurn: number;
  physics: { drag: number; lift: number };
  playground: {
    slowMotion: boolean;
    camera: "first-person" | "side";
    trace: Vector3[];
    distance: number;
    peak: number;
    origin: Vector3;
  };
  players: Player[];
  puck: Puck;
  formations: [Formation, Formation];
  scores: [number, number];
  // Every goal in order. The scorer is the last player to touch the puck, so
  // an own goal names a player of the other team.
  goals: Goal[];
  seconds: number;
  duration: number;
  time: number;
  decisionTime: number;
  restartTime: number;
  faceoff: Faceoff | undefined;
  finished: boolean;
  mode: GameMode;
  backLeads: [number, number];
  puckChasers: [number | undefined, number | undefined];
  airRotations: [AirRotation[], AirRotation[]];
  strongSides: [number, number];
  event: string;
  eventTime: number;
  contacts: number;
  shots: number;
};
export type Goal = {
  team: Team;
  scorer: number | undefined;
  // Match time of the goal, in seconds from the start.
  second: number;
};
export const POOL = { width: 15, length: 25, depth: 2.44, goal: 3 };
export const MAX_STAMINA = 100;
export const REST_HEART_RATE = 70;
export const FLOOR_HEIGHT = 0.36;
export const SURFACE_HEIGHT = POOL.depth - 0.13;
export const PUCK_RADIUS = 0.04;
export const PUCK_HEIGHT = 0.018;
export const STICK_HEIGHT = PUCK_HEIGHT;
export const STICK_TILT = 0;
export const STICK_REACH = 0.4;
export const CAMERA_OFFSET = new Vector3(0, 0.03, -0.1);
export const FRONT_PAW = new Vector3(0.164, -0.051, -0.073);
export const STEP = 1 / 120;
export const STICK_EDGE: readonly (readonly [number, number])[] = [
  [0.132, 0.057],
  [0.1, 0.052],
  [0.06, 0.044],
  [0.012, 0.043],
  [-0.033, 0.031],
  [-0.067, 0.024],
  [-0.091, 0.011],
  [-0.106, -0.012],
  [-0.114, -0.032],
  [-0.125, -0.037],
  [-0.138, -0.027],
  [-0.146, -0.005],
  [-0.148, 0.027],
  [-0.144, 0.05],
  [-0.13, 0.063],
  [-0.098, 0.07],
  [-0.05, 0.071],
  [0.005, 0.069],
  [0.047, 0.071],
  [0.095, 0.088],
  [0.12, 0.09],
  [0.132, 0.081],
  [0.132, 0.057],
];
export const STICK_OUTLINE: readonly (readonly [number, number])[] = [
  ...STICK_EDGE,
];
export const freshControls = (): Controls => ({
  forward: 0,
  lateral: 0,
  vertical: 0,
  sprint: false,
  curl: 0,
  glance: 0,
  yawDelta: 0,
  pitch: -0.5,
  dummyMode: false,
  dummy: 0,
  knockdown: false,
  backhand: false,
  dive: false,
  shot: 0,
  charging: false,
  charge: 0,
});
export const handSide = (player: Player): number =>
  player.handedness === "right" ? 1 : -1;
export const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));
export const attackDirection = (team: Team): number => (team === 0 ? -1 : 1);
export const angleDifference = (target: number, current: number): number =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current));
export const forwardVector = (yaw: number): Vector3 =>
  new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
export const directionYaw = (x: number, z: number): number =>
  Math.atan2(-x, -z);
