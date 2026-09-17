import { type Quaternion, Vector3 } from "three";

export type Formation = "3-3" | "2-3-1" | "1-3-2" | "2-1" | "1-2" | "1-1";
export type TeamSize = 2 | 3 | 6;
export type Team = 0 | 1;
export type Species = "otter" | "beaver";
export type BotDifficulty = "easy" | "medium" | "hard" | "elite";
export type MatchSelection = {
  species: Species;
  position: number;
  difficulty: BotDifficulty;
  ruleset?: Ruleset;
};
export type Handedness = "right" | "left";
export type WaterMode = "playing" | "ascending" | "recovering" | "diving";
export type Duty = "pressure" | "support" | "cover" | "recover";
export type GameMode = "match" | "practice" | "playground";
export type Ruleset = "alternative" | "original";
export type PuckMoveKind = "push" | "pull";
export type PuckMove = {
  kind: PuckMoveKind;
  phase: "approach" | "stroke" | "hold";
  elapsed: number;
  yaw: number;
  startOffset: Vector3;
  origin: Vector3;
  end: Vector3;
  holdOffset: Vector3;
  returning: boolean;
};
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
  slot: number;
  human: boolean;
  handedness: Handedness;
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
  evadeSide: number;
  evadeUntil: number;
  evadeTarget: Vector3;
  air: number;
  stamina: number;
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
  puckMove: PuckMove | undefined;
  puckMoveCooldown: number;
  puckWorkHeld: boolean;
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
  controlKind:
    | "carry"
    | "curl"
    | "dummy"
    | "settling"
    | "charge"
    | PuckMoveKind
    | undefined;
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
  pushPull: boolean;
  backhand: boolean;
  dive: boolean;
  shot: number;
  charging: boolean;
  charge: number;
};
export type Simulation = {
  difficulty: BotDifficulty;
  ruleset: Ruleset;
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
export const POOL = { width: 15, length: 25, depth: 2.44, goal: 3 };
export const MAX_STAMINA = 100;
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
  pushPull: false,
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
