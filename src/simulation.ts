import { Quaternion, Vector3 } from "three";
import { planCarry } from "./bot-carry";
import { botControls } from "./bot-driver";
import {
  nearOwnGoal,
  protectGoalApproach,
  safeGoalTurn,
} from "./bot-goal-safety";
import {
  airSeconds,
  applyBotBuilds,
  approachAtSurface,
  botProfiles,
  clearAscent,
  coordinatePuckPursuit,
  defendingZone,
  followingAttack,
  pursuitWeights,
  safeAirReserve,
  shouldSprintToPuck,
  steerThroughTraffic,
  surfacingQuota,
  teammatesAway,
  teamPuckCarrier,
  yieldToPuckChaser,
} from "./bots";
import type { CharacterSpecies } from "./characters";
import { coachTeam } from "./coach";
import { avoidBodies, pushWeakerBodies, resolveBodies } from "./collisions";
import { FLICK_BASE, FLICK_GAIN } from "./flick";
import { wallLane } from "./formation-layout";
import { planTeam } from "./formations";
import {
  chargePower,
  curlSpeedScale,
  flickScale,
  MAX_HELD,
  NEUTRAL_ATTRIBUTES,
  shotPower,
  swimSpeedScale,
} from "./player-profile";
import { teamSize } from "./positions";
import { advancePuck, puckFloorHeight } from "./puck-physics";
import { RULESETS, type Rules } from "./rules";
import { announce, announceTo } from "./simulation-events";
import {
  CURL_TURN_SPEED,
  HARD_TURN_FORWARD_RATE,
  HARD_TURN_RATE,
  HARD_TURN_RELEASE,
  pointerTurnGain,
  SPRINT_SPEED,
  SWIM_SPEED,
  swimTurnLimit,
} from "./swim-limits";
import { airEngaged, airRate, heartDrive, staminaRate } from "./vitals";

export {
  goalSurfaceHeight,
  puckFloorHeight,
  puckInsideGoal,
} from "./puck-physics";
export { announce, announceTo } from "./simulation-events";
export {
  CARRY_TURN_SPEED,
  CURL_TURN_SPEED,
  SURFACE_TURN_SPEED,
} from "./swim-limits";

import {
  canGrabPuck,
  canKnockdown,
  isPuckContested,
  KNOCKDOWN_COOLDOWN,
  KNOCKDOWN_DURATION,
  KNOCKDOWN_HIT_TIME,
  puckInGrabReach,
  puckInKnockdownBox,
} from "./handling";
import {
  bladeMirror,
  bladeOrigin,
  bladePoint,
  CRADLE_APPROACH,
  CURL_APPROACH,
  mirrorBladePoint,
  puckSeat,
  REST_BLADE_YAW,
  restPuckOffset,
  reversePuckOffset,
  SHOT_APPROACH,
  SHOT_CONTACT,
  SHOT_DURATION,
  SHOT_RELEASE,
  STICK_GRIP,
  SWERVE_EXTEND_DURATION,
  SWERVE_PULL_DURATION,
  shotProgress,
  shotPuckOrientation,
  shotPuckPosition,
  shotTranslation,
  smoothMotion,
  swerveExtension,
  updateBladePose,
} from "./stick";
import {
  attackDirection,
  type Controls,
  clamp,
  directionYaw,
  FLOOR_HEIGHT,
  type Formation,
  FRONT_PAW,
  forwardVector,
  freshControls,
  type GameMode,
  type Handedness,
  handSide,
  MAX_STAMINA,
  type MatchSelection,
  NEUTRAL_TACTICS,
  type Player,
  POOL,
  PUCK_HEIGHT,
  PUCK_RADIUS,
  REST_HEART_RATE,
  type Ruleset,
  type Simulation,
  STICK_EDGE,
  STICK_HEIGHT,
  STICK_REACH,
  SURFACE_HEIGHT,
  type Team,
} from "./types";

export const TEAM_STRIDE = 6;
const FACEOFF_COUNTDOWN = 3;
const FACEOFF_SETTLE = 0.5;

const playerTeam = (id: number): Team => (id < TEAM_STRIDE ? 0 : 1);

const makePlayer = (
  id: number,
  mode: GameMode,
  handedness: Handedness = "right",
  human = id === 0,
  formation: Formation = "2-3-1",
  species: CharacterSpecies = playerTeam(id) === 0 ? "otter" : "beaver",
): Player => {
  const team = playerTeam(id);
  const slot = id % TEAM_STRIDE;
  const direction = attackDirection(team);
  const wallReady = mode === "match";
  const position = wallReady
    ? new Vector3(wallLane(formation, slot) * -direction, 1.9, -direction * 12)
    : new Vector3(0, FLOOR_HEIGHT, 3);
  return {
    id,
    team,
    species,
    slot,
    human,
    handedness,
    attributes: { ...NEUTRAL_ATTRIBUTES },
    autoCurl: false,
    position,
    previous: position.clone(),
    previousYaw: team === 0 ? 0 : Math.PI,
    previousBodyPitch: 0,
    dummyBurstUntil: 0,
    autoDummyUntil: 0,
    autoDummyLocked: false,
    velocity: new Vector3(),
    yaw: team === 0 ? 0 : Math.PI,
    aimYaw: undefined,
    plannedShot: undefined,
    evadeSide: 0,
    evadeUntil: 0,
    evadeTarget: position.clone(),
    air: 100,
    stamina: MAX_STAMINA,
    heartRate: REST_HEART_RATE,
    mode: "playing",
    duty: "support",
    role: "Forward",
    target: position.clone(),
    formationTarget: position.clone(),
    wantDown: true,
    cycleUntil: 0,
    sprint: false,
    kick: 0,
    kickPhase: id * 1.73,
    bodyPitch: 0,
    bodyRoll: 0,
    wallReady,
    handling: false,
    curl: 0,
    curlTurnSpeed: 0,
    turnRate: 0,
    event: "",
    eventTime: 0,
    dummy: 0,
    lateral: 0,
    cradle: undefined,
    grab: undefined,
    knockdownTime: 0,
    knockdownCooldown: 0,
    knockdownAttempted: false,
    knockdownTarget: new Vector3(),
    curlBlockedUntil: 0,
    stickOffset: new Vector3(
      handedness === "right" ? 0.13 : -0.13,
      0,
      -STICK_REACH,
    ),
    stick: new Vector3(),
    previousStick: new Vector3(),
    stickVelocity: new Vector3(),
    stickYaw: 0,
    previousStickYaw: 0,
    stickOrientation: new Quaternion(),
    previousStickOrientation: new Quaternion(),
    bladeRotation: REST_BLADE_YAW,
    bladeFace: 0,
    bladeTilt: 0,
    backhand: false,
    shotTime: 0,
    charging: false,
    charge: 0,
    shotDraw: 0,
    shotPower: 0,
    shotLoft: 1,
    shotFired: false,
    shotDirection: new Vector3(),
    shotOrigin: undefined,
    shotStartPosition: new Vector3(),
    shotGrip: new Vector3(),
    cooldown: 0,
    emergency: false,
  };
};

export const createSimulation = (
  formation: Formation = "2-3-1",
  opposition: Formation = "2-3-1",
  mode: GameMode = "match",
  duration = 180,
  handedness: Handedness = "right",
  selection: MatchSelection = {
    species: "otter",
    position: 0,
    difficulty: "medium",
  },
  ruleset: Ruleset = selection.ruleset ?? "alternative",
): Simulation => {
  const humanTeam = selection.team ?? 0;
  const size = teamSize(formation);
  const humanId =
    humanTeam * TEAM_STRIDE +
    clamp(Math.round(selection.position), 0, size - 1);
  const roster =
    mode === "match"
      ? ([0, 1] as const).flatMap((team): number[] =>
          Array.from(
            { length: teamSize(team === humanTeam ? formation : opposition) },
            (_, slot): number => team * TEAM_STRIDE + slot,
          ),
        )
      : [humanId];
  const state: Simulation = {
    difficulty: selection.difficulty,
    pursuit: [{ ...pursuitWeights }, { ...pursuitWeights }],
    pursuitBase: [{ ...pursuitWeights }, { ...pursuitWeights }],
    coached: [true, true],
    tactics: [{ ...NEUTRAL_TACTICS }, { ...NEUTRAL_TACTICS }],
    ruleset,
    swimTurn: selection.swimTurn ?? 1,
    physics: { drag: 1, lift: 1 },
    playground: {
      slowMotion: false,
      camera: "first-person",
      trace: [],
      distance: 0,
      peak: 0,
      origin: new Vector3(),
    },
    players: [humanId, ...roster.filter((id): boolean => id !== humanId)].map(
      (id): Player =>
        makePlayer(
          id,
          mode,
          id === humanId ? handedness : "right",
          id === humanId,
          playerTeam(id) === humanTeam ? formation : opposition,
          playerTeam(id) === humanTeam ? selection.species : undefined,
        ),
    ),
    puck: {
      flightOrientation: undefined,
      position: new Vector3(0, PUCK_HEIGHT, mode !== "match" ? 1.93 : 0),
      previous: new Vector3(),
      velocity: new Vector3(),
      spin: 0,
      rotation: 0,
      orientation: new Quaternion(),
      previousOrientation: new Quaternion(),
      angularVelocity: new Vector3(),
      shotOwner: undefined,
      lastTouch: undefined,
      touchTime: -10,
      controlOwner: undefined,
      controlKind: undefined,
      controlUntil: 0,
    },
    formations:
      humanTeam === 0 ? [formation, opposition] : [opposition, formation],
    scores: [0, 0],
    goals: [],
    seconds: duration,
    duration,
    time: 0,
    decisionTime: 0,
    restartTime: 0,
    faceoff:
      mode === "match"
        ? { phase: "ready", remaining: FACEOFF_COUNTDOWN + FACEOFF_SETTLE }
        : undefined,
    finished: false,
    mode,
    backLeads: [5, 11],
    puckChasers: [undefined, undefined],
    airRotations: [[], []],
    strongSides: [1, -1],
    event: "",
    eventTime: 0,
    contacts: 0,
    shots: 0,
  };
  const human = state.players.at(0);
  if (human) {
    human.attributes = { ...(selection.attributes ?? NEUTRAL_ATTRIBUTES) };
    human.autoCurl = selection.autoCurl ?? false;
  }
  applyBotBuilds(state);
  state.puck.previous.copy(state.puck.position);
  for (const player of state.players) {
    updateStick(player, 1 / 120);
    player.previousStick.copy(player.stick);
    player.previousStickOrientation.copy(player.stickOrientation);
    player.stickVelocity.set(0, 0, 0);
  }
  if (mode !== "match") resetPracticePuck(state);
  return state;
};

export const setPlayerHandedness = (
  state: Simulation,
  handedness: Handedness,
  playerId = state.players.at(0)?.id,
): void => {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.handedness === handedness) return;
  player.handedness = handedness;
  player.stickOffset.x *= -1;
  player.curl = 0;
  player.curlTurnSpeed = 0;
  player.dummy = 0;
  player.lateral = 0;
  player.cradle = undefined;
  player.grab = undefined;
  player.bladeFace = 0;
  player.bladeTilt = 0;
  player.bladeRotation = REST_BLADE_YAW;
  player.knockdownTime = 0;
  player.shotTime = 0;
  player.shotOrigin = undefined;
  player.charging = false;
  player.charge = 0;
  player.shotDraw = 0;
  player.curlBlockedUntil = state.time + 0.3;
  if (state.puck.controlOwner === player.id) releaseControl(state);
  if (state.puck.shotOwner === player.id) state.puck.shotOwner = undefined;
  updateStick(player, 1 / 120);
  player.previousStick.copy(player.stick);
  player.previousStickOrientation.copy(player.stickOrientation);
  player.previousStickYaw = player.stickYaw;
  player.stickVelocity.set(0, 0, 0);
};

export const requestShot = (
  player: Player,
  power: number,
  direction: Vector3,
  loft = 1,
): boolean => {
  if (
    (nearOwnGoal(player) && direction.z * attackDirection(player.team) <= 0) ||
    player.cooldown > 0 ||
    player.emergency ||
    player.position.y > 1.4 ||
    player.knockdownTime > 0
  )
    return false;
  player.shotTime = SHOT_DURATION;
  player.shotPower = clamp(power, 0, 1);
  player.shotLoft = clamp(loft, 0, 1);
  player.shotDirection.copy(direction).setY(0).normalize();
  player.shotFired = false;
  player.shotOrigin = undefined;
  player.cooldown = 0.47;
  return true;
};

const updateCradle = (
  state: Simulation,
  player: Player,
  dt: number,
  automaticDummy = false,
): void => {
  if (
    !canCarryPuck(state, player) ||
    (state.puck.controlOwner !== player.id &&
      ((player.curl === 0 && player.dummy === 0) ||
        player.stick.distanceTo(state.puck.position) >
          (player.curl !== 0 ? 0.65 : 0.27)))
  ) {
    player.cradle = undefined;
    return;
  }
  const kind =
    player.curl !== 0
      ? "curl"
      : player.charging
        ? "charge"
        : player.dummy !== 0
          ? "dummy"
          : "settling";
  const direction = kind === "dummy" ? Math.sign(player.dummy) : player.curl;
  if (!player.cradle && kind === "settling") return;
  if (
    player.cradle?.kind !== kind ||
    ((kind === "curl" || kind === "dummy") &&
      player.cradle.turnDirection !== direction)
  ) {
    const origin = state.puck.position
      .clone()
      .sub(player.position)
      .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw)
      .setY(0);
    player.cradle = {
      kind,
      elapsed: 0,
      origin,
      target: origin.clone(),
      turnDirection: direction,
      originFace: player.bladeFace,
    };
  }
  const cradle = player.cradle;
  cradle.elapsed += dt;
  const progress = smoothMotion(
    (cradle.elapsed - (kind === "curl" ? CURL_APPROACH : CRADLE_APPROACH)) /
      (kind === "curl" ? 0.18 : 0.2),
  );
  if (kind === "dummy") {
    const dummyTiming = automaticDummy ? AUTO_DUMMY_TIMING : 1;
    const pullDuration = SWERVE_PULL_DURATION * dummyTiming;
    if (
      cradle.elapsed >= pullDuration &&
      cradle.elapsed - dt < pullDuration &&
      !automaticDummy
    )
      player.dummyBurstUntil = state.time + 0.7;
    const pulled = cradle.origin
      .clone()
      .setX(cradle.origin.x * 0.55)
      .setZ(Math.min(-0.32, cradle.origin.z + 0.16));
    const extended = restPuckOffset(player).add(
      new Vector3(cradle.turnDirection * 0.3, 0, -0.05),
    );
    cradle.target
      .copy(cradle.origin)
      .lerp(pulled, smoothMotion(cradle.elapsed / pullDuration))
      .lerp(extended, swerveExtension(player, dummyTiming));
  } else if (kind === "charge") {
    cradle.target.copy(cradle.origin);
    cradle.target.z = Math.min(
      -0.3,
      cradle.origin.z + player.shotDraw * 0.18 * progress,
    );
  } else if (kind === "curl") {
    cradle.target
      .copy(cradle.origin)
      .lerp(
        player.curl < 0
          ? reversePuckOffset(player)
          : new Vector3(0.03 * handSide(player), 0, -0.48),
        progress,
      );
  } else {
    cradle.target
      .copy(cradle.origin)
      .lerp(restPuckOffset(player), smoothMotion(cradle.elapsed / 0.32));
    if (cradle.elapsed > 0.42) player.cradle = undefined;
  }
};

const approachSwimVelocity = (
  current: number,
  target: number,
  braking: boolean,
  dt: number,
): number => {
  const response = braking
    ? 24
    : target === 0
      ? 16
      : current * target < 0
        ? 14
        : 8;
  const velocity =
    current + (target - current) * (1 - Math.exp(-response * dt));
  return target === 0 && Math.abs(velocity) < 0.01 ? 0 : velocity;
};

const rulesFor = (state: Simulation): Rules => RULESETS[state.ruleset];

const canSprint = (rules: Rules, player: Player): boolean =>
  !rules.sprintGate || player.stamina > (player.sprint ? 0 : rules.sprintFloor);

// An exact exponential step, so the heart never overshoots its target.
const updateHeart = (state: Simulation, player: Player, dt: number): void => {
  const heart = heartDrive(state, player);
  if (!heart) return;
  player.heartRate =
    heart.target +
    (player.heartRate - heart.target) * Math.exp(-dt / heart.seconds);
};

const updateStamina = (rules: Rules, player: Player, dt: number): void => {
  player.stamina = clamp(
    player.stamina + staminaRate(rules, player) * dt,
    0,
    MAX_STAMINA,
  );
};

// Air a player keeps above its reserve when the surfacing quota is full. The
// ascent itself costs air, so waiting down to the bare reserve risks a drown.
const HELD_AIR_MARGIN = 6;
const TURN_RELEASE_RESPONSE = 18;
const HARD_TURN_CURL_RATE = 7.5;
const AUTO_DUMMY_TIMING = 1.6;

const bodyTurnRate = (controls: Controls): number =>
  controls.lateral * (controls.sprint && controls.forward > 0 ? 2.08 : 2.47);

const requestedTurnRate = (
  controls: Controls,
  dt: number,
  pointerGain: number,
): number =>
  (controls.yawDelta * 1.3 * pointerGain) / dt - bodyTurnRate(controls);

// Use a lower limit to keep an active handover.
const turningHard = (player: Player, rate: number): boolean =>
  Math.abs(player.turnRate) > (player.curl === 0 ? rate : HARD_TURN_RELEASE);

const handoverRate = (controls: Controls): number =>
  controls.forward > 0 ? HARD_TURN_FORWARD_RATE : HARD_TURN_RATE;

const sprintingForward = (
  rules: Rules,
  player: Player,
  controls: Controls,
): boolean =>
  controls.sprint && controls.forward > 0 && canSprint(rules, player);

const canTurnWithPuck = (
  rules: Rules,
  state: Simulation,
  player: Player,
  controls: Controls,
): boolean =>
  rules.autoCurl &&
  state.puck.controlOwner === player.id &&
  !controls.charging &&
  !controls.dummyMode &&
  !player.grab;

const canHandOver = (
  rules: Rules,
  state: Simulation,
  player: Player,
  controls: Controls,
): boolean =>
  canTurnWithPuck(rules, state, player, controls) &&
  (controls.forward <= 0 || sprintingForward(rules, player, controls));

// With auto curl on, a harder forward turn than the dummy threshold becomes a
// curl. Sprint keeps the automatic dummy.
const curlsOutOfTurn = (
  rules: Rules,
  state: Simulation,
  player: Player,
  controls: Controls,
): boolean =>
  player.autoCurl &&
  controls.forward > 0 &&
  !sprintingForward(rules, player, controls) &&
  canTurnWithPuck(rules, state, player, controls) &&
  turningHard(player, HARD_TURN_CURL_RATE);

const autoTurnDirection = (
  rules: Rules,
  state: Simulation,
  player: Player,
  controls: Controls,
): number => {
  if (player.autoDummyLocked && controls.forward > 0)
    return state.time < player.autoDummyUntil ? player.dummy : 0;
  return canHandOver(rules, state, player, controls) &&
    turningHard(player, handoverRate(controls))
    ? Math.sign(player.turnRate) * bladeMirror(player)
    : 0;
};

const carveThrottle = (
  rules: Rules,
  player: Player,
  underwater: boolean,
): number =>
  underwater
    ? 1 -
      clamp(Math.abs(player.turnRate) / HARD_TURN_RATE, 0, 1) * rules.carveDrag
    : 1;

const updateHumanMovement = (
  state: Simulation,
  player: Player,
  controls: Controls,
  dt: number,
): void => {
  const rules = rulesFor(state);
  const carrying = state.puck.controlOwner === player.id;
  const pointerGain = pointerTurnGain(carrying);
  const requestedRate = requestedTurnRate(controls, dt, pointerGain);
  player.turnRate =
    Math.abs(requestedRate) > 0.01
      ? requestedRate
      : player.turnRate * Math.exp(-TURN_RELEASE_RESPONSE * dt);
  if (
    player.autoDummyLocked &&
    Math.abs(player.turnRate) <= HARD_TURN_RELEASE
  ) {
    player.autoDummyLocked = false;
    player.autoDummyUntil = 0;
  }
  const curling = curlsOutOfTurn(rules, state, player, controls);
  if (curling) {
    player.autoDummyLocked = false;
    player.autoDummyUntil = 0;
  }
  const automatic = curling
    ? Math.sign(player.turnRate) * bladeMirror(player)
    : autoTurnDirection(rules, state, player, controls);
  if (
    controls.forward > 0 &&
    !curling &&
    automatic !== 0 &&
    !player.autoDummyLocked
  ) {
    player.autoDummyLocked = true;
    player.autoDummyUntil =
      state.time +
      (SWERVE_PULL_DURATION + SWERVE_EXTEND_DURATION) * AUTO_DUMMY_TIMING;
  }
  const forwardTurn = controls.forward > 0 && !curling;
  const curl =
    controls.curl !== 0 ? controls.curl : forwardTurn ? 0 : automatic;
  const locomotion =
    curl === 0
      ? controls
      : {
          ...controls,
          forward: 0,
          lateral: 0,
          vertical: 0,
          dive: false,
          sprint: false,
        };
  const underwater = player.position.y < SURFACE_HEIGHT - 0.07;
  player.curl = curl;
  player.dummy =
    curl === 0 ? controls.dummy || (forwardTurn ? automatic : 0) : 0;
  const pointerTurn = clamp(
    -player.turnRate /
      bodyTurnRate({
        ...controls,
        lateral: 1,
      }),
    -1,
    1,
  );
  if (locomotion.lateral !== 0) player.lateral = locomotion.lateral;
  else player.lateral = pointerTurn;
  const curlTurnSpeed = CURL_TURN_SPEED * curlSpeedScale(player.attributes);
  player.curlTurnSpeed +=
    (curl * curlTurnSpeed - player.curlTurnSpeed) *
    (1 - Math.exp(-(curl === 0 ? 34 : 24) * dt));
  if (Math.abs(player.curlTurnSpeed) < 0.01) player.curlTurnSpeed = 0;
  const steer =
    curl === 0
      ? requestedRate * dt
      : controls.yawDelta * 1.3 * pointerGain * rules.curlMouseTurn -
        bodyTurnRate(locomotion) * dt +
        player.curlTurnSpeed * bladeMirror(player) * dt;
  // Normal swimming uses the room turn rate. Curling keeps its own limit.
  // A swimmer at the surface turns faster, because the limit exists to stop a
  // pivot around the puck and the puck is not played up here.
  const turnLimit =
    curl === 0
      ? swimTurnLimit(state.swimTurn, carrying, underwater)
      : curlTurnSpeed;
  player.yaw += !rules.autoCurl
    ? steer
    : clamp(steer, -turnLimit * dt, turnLimit * dt);
  player.sprint =
    canSprint(rules, player) &&
    ((locomotion.sprint && locomotion.forward > 0) ||
      (state.time < player.dummyBurstUntil &&
        locomotion.forward >= 0 &&
        (locomotion.forward > 0 || locomotion.lateral !== 0)));
  if (curl !== 0) player.sprint = false;
  player.backhand = controls.backhand || curl < 0;
  const forward = forwardVector(player.yaw);
  const throttle =
    locomotion.forward < 0
      ? 0
      : Math.max(locomotion.forward, Math.abs(locomotion.lateral));
  const speed =
    (player.sprint ? SPRINT_SPEED : SWIM_SPEED) *
    swimSpeedScale(player.attributes);
  const braking = locomotion.forward < 0;
  const forwardSpeed =
    curl !== 0
      ? 0
      : approachSwimVelocity(
          Math.max(0, player.velocity.dot(forward)),
          throttle * speed * carveThrottle(rules, player, underwater),
          braking,
          dt,
        );
  player.velocity.x = forward.x * forwardSpeed;
  player.velocity.z = forward.z * forwardSpeed;
  player.kick = clamp(
    throttle +
      Math.abs(locomotion.lateral) * 0.5 +
      Math.abs(locomotion.vertical) * 0.5,
    0,
    player.sprint ? 1.5 : 1,
  );
  if (locomotion.vertical > 0 && !player.emergency) player.mode = "ascending";
  if (locomotion.vertical < 0 && player.air > 8 && !player.emergency)
    player.mode = "diving";
  if (locomotion.dive && !player.emergency && player.air > 12) {
    player.mode = "diving";
    player.velocity.y = -1.4;
    if (throttle) player.velocity.addScaledVector(forward, 0.9);
  }
  if (player.emergency) player.velocity.y += 3.1 * dt;
  else if (locomotion.vertical !== 0)
    player.velocity.y += locomotion.vertical * 3.0 * dt;
  else if (player.mode === "diving" && underwater)
    player.velocity.y -= 1.5 * dt;
  else player.velocity.y *= Math.exp(-2.8 * dt);
  if (curl !== 0 && !player.emergency) player.velocity.y = 0;
};

const updateHumanCharge = (
  player: Player,
  controls: Controls,
  dt: number,
): void => {
  player.charging =
    controls.charging &&
    !player.emergency &&
    player.cooldown <= 0 &&
    player.knockdownTime <= 0 &&
    player.curl === 0 &&
    controls.dummy === 0 &&
    player.mode !== "ascending";
  player.charge = player.charging
    ? chargePower(player.attributes, clamp(controls.charge, 0, MAX_HELD))
    : 0;
  if (player.shotTime <= 0)
    player.shotDraw +=
      (player.charge - player.shotDraw) * (1 - Math.exp(-16 * dt));
};

const updateHuman = (
  state: Simulation,
  player: Player,
  controls: Controls,
  dt: number,
): void => {
  updateHumanMovement(state, player, controls, dt);
  const automaticDummy =
    player.dummy !== 0 && controls.dummy === 0 && controls.forward > 0;
  if (automaticDummy) player.dummyBurstUntil = 0;
  const forward = forwardVector(player.yaw);
  const underwater = player.position.y < SURFACE_HEIGHT - 0.07;
  updateHumanCharge(player, controls, dt);
  updateCradle(state, player, dt, automaticDummy);
  if (player.grab) {
    player.grab.elapsed += dt;
    player.grab.target.copy(state.puck.position);
    if (
      player.grab.elapsed > 0.55 ||
      !canHandlePuck(state, player) ||
      !puckInGrabReach(state, player, controls.pitch) ||
      player.curl !== 0 ||
      player.dummy !== 0 ||
      player.charging
    )
      player.grab = undefined;
  }
  if (controls.knockdown && canKnockdown(state, player)) {
    player.grab = undefined;
    player.cradle = undefined;
    player.knockdownTime = KNOCKDOWN_DURATION;
    player.knockdownCooldown = KNOCKDOWN_COOLDOWN;
    player.knockdownAttempted = false;
    player.knockdownTarget.copy(state.puck.position);
    if (state.puck.controlOwner === player.id) releaseControl(state);
  } else if (controls.knockdown && canGrabPuck(state, player, controls.pitch)) {
    player.grab = { elapsed: 0, target: state.puck.position.clone() };
    player.knockdownCooldown = 0.45;
    player.knockdownAttempted = false;
  }
  player.handling =
    player.dummy !== 0 ||
    player.knockdownTime > 0 ||
    player.charging ||
    player.grab !== undefined;
  const offset = new Vector3(
    handSide(player) * 0.13 +
      player.dummy * 0.3 +
      (player.curl === 0 ? player.lateral * 0.08 : 0),
    0,
    -STICK_REACH,
  );
  if (player.grab) {
    const seat = puckSeat(player).sub(player.stick);
    offset
      .copy(player.grab.target)
      .sub(seat)
      .sub(player.position)
      .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw)
      .setY(0);
  }
  if (player.knockdownTime > 0) {
    const elapsed = KNOCKDOWN_DURATION - player.knockdownTime;
    const target = player.knockdownTarget
      .clone()
      .sub(player.position)
      .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
    target.x = handSide(player) * 0.13;
    target.z = -0.52;
    target.y = clamp(target.y + FLOOR_HEIGHT - STICK_HEIGHT, 0.12, 0.28);
    const lift = smoothMotion(elapsed / KNOCKDOWN_HIT_TIME);
    const settle = smoothMotion(
      (elapsed - KNOCKDOWN_HIT_TIME) /
        (KNOCKDOWN_DURATION - KNOCKDOWN_HIT_TIME),
    );
    offset.lerp(target, lift * (1 - settle));
  }
  player.stickOffset.lerp(
    offset,
    1 -
      Math.exp(
        -(player.knockdownTime > 0 || player.grab
          ? 42
          : player.dummy !== 0
            ? 32
            : 12) * dt,
      ),
  );
  if (controls.shot > 0) {
    if (
      requestShot(player, shotPower(player.attributes, controls.shot), forward)
    ) {
      player.cradle = undefined;
      player.grab = undefined;
    }
  }
  if (
    player.position.y <= FLOOR_HEIGHT + 0.03 &&
    !player.emergency &&
    controls.vertical <= 0
  )
    player.mode = "playing";
  if (player.air < 24 && player.eventTime <= 0 && underwater)
    announceTo(player, "Low air", 2);
};

// The body stops this short of a loose puck, so it lies under the chest where
// a grab reaches it, in meters. Tuned with bot match trials.
const GRAB_STANDOFF = 0.34;

const prepareAI = (state: Simulation, player: Player): void => {
  player.aimYaw = undefined;
  const committed =
    state.puck.controlOwner === player.id &&
    player.plannedShot !== undefined &&
    !player.plannedShot.hold;
  player.plannedShot = undefined;
  const puck = state.puck;
  const direction = attackDirection(player.team);
  const near =
    player.position.distanceTo(puck.position) < 1.5 && player.position.y < 0.85;
  const teammateControl = teamPuckCarrier(state, player.team);
  const pursuing = state.puckChasers[player.team] === player.id;
  const carrying = puck.controlOwner === player.id;
  const ownContact =
    carrying ||
    (pursuing &&
      puck.lastTouch === player.id &&
      near &&
      state.time - puck.touchTime < 0.5);
  if (player.mode === "ascending" || player.mode === "recovering") return;
  if (ownContact) {
    const goal = new Vector3(
      clamp(puck.position.x * 0.5, -1, 1),
      0,
      direction * 12.3,
    );
    const travel = goal.sub(puck.position).setY(0).normalize();
    player.target
      .copy(puck.position)
      .addScaledVector(travel, carrying ? 2.4 : -GRAB_STANDOFF)
      .setY(FLOOR_HEIGHT);
    player.aimYaw = directionYaw(travel.x, travel.z);
    player.duty = "pressure";
    if (carrying) planCarry(state, player, committed);
  } else if (!teammateControl && pursuing) {
    player.duty = "pressure";
    const incoming = puck.position
      .clone()
      .addScaledVector(
        puck.velocity,
        botProfiles[state.difficulty].anticipation,
      );
    const angle = directionYaw(
      incoming.x - player.position.x,
      incoming.z - player.position.z,
    );
    player.target
      .copy(incoming)
      .addScaledVector(forwardVector(angle), -GRAB_STANDOFF)
      .setY(FLOOR_HEIGHT);
    player.aimYaw = angle;
  } else {
    if (player.duty === "pressure") player.duty = "support";
    player.aimYaw = directionYaw(
      puck.position.x - player.position.x,
      puck.position.z - player.position.z,
    );
  }
};

// Teammates whose air runs out within this many seconds of each other would
// head up together. The one with the least air goes early to break the group,
// once it is below this much air.
const STAGGER_SECONDS = 3;
const STAGGER_AIR = 60;

const floorTeammates = (state: Simulation, player: Player): Player[] =>
  state.players.filter(
    (other): boolean =>
      other.team === player.team &&
      other.id !== player.id &&
      !other.emergency &&
      (other.mode === "playing" || other.mode === "diving"),
  );

const breathesWithOthers = (state: Simulation, player: Player): boolean => {
  const own = airSeconds(state, player, false);
  const group = floorTeammates(state, player).filter(
    (other): boolean =>
      Math.abs(airSeconds(state, other, false) - own) < STAGGER_SECONDS,
  );
  return (
    group.length >= 2 &&
    group.every((other): boolean => airSeconds(state, other, false) >= own)
  );
};

// A surfaced player dives before its tank is full when a teammate below is
// nearly out of air or too few teammates are down to hold the floor.
const SUPPORT_AIR = 80;
const SUPPORT_SECONDS = 4;

const teamNeedsSupport = (state: Simulation, player: Player): boolean => {
  const floor = floorTeammates(state, player);
  const size = teamSize(state.formations[player.team]);
  return (
    floor.length < Math.ceil(size / 2) ||
    floor.some(
      (other): boolean =>
        other.mode === "playing" &&
        airSeconds(state, other, airEngaged(state, other)) < SUPPORT_SECONDS,
    )
  );
};

// A player stays down only with enough air to reach the puck and still play
// it for this long, in seconds. With less, the time down is wasted, so it tops
// up while play is elsewhere. Bot match trials gain most from 5 to 7 seconds.
const USEFUL_SECONDS = 6;
// Above this much air a top up gains too little to be worth the trip.
const OUT_OF_PLAY_AIR = 60;
// A player this close to the puck is already in play, in meters.
const IN_PLAY_REACH = 1.5;

const outOfPlay = (state: Simulation, player: Player): boolean => {
  if (
    player.air > OUT_OF_PLAY_AIR ||
    state.puckChasers[player.team] === player.id ||
    state.puck.controlOwner === player.id
  )
    return false;
  const reach = Math.max(
    0,
    Math.hypot(
      player.position.x - state.puck.position.x,
      player.position.z - state.puck.position.z,
    ) - IN_PLAY_REACH,
  );
  return airSeconds(state, player, false) < reach / SWIM_SPEED + USEFUL_SECONDS;
};

// While the team defends, its deepest player on the floor holds the line down
// to the safe reserve. The others top up as usual, so one threat does not
// keep the whole team down until its air runs low.
const holdsLine = (state: Simulation, player: Player): boolean => {
  const depth = (other: Player): number =>
    other.position.z * attackDirection(other.team);
  return floorTeammates(state, player).every(
    (other): boolean => depth(other) >= depth(player),
  );
};

// A player on its way up turns back to defend only with this much air. The
// safe reserve shrinks near the surface, so on its own it would send a player
// back down nearly empty.
const DIVE_BACK_AIR = 45;

const updateBotMode = (state: Simulation, player: Player): void => {
  const defending = defendingZone(state, player);
  const followThrough = followingAttack(state, player);
  const reserve = safeAirReserve(state, player);
  const airRotation = state.airRotations[player.team].find(
    (active): boolean =>
      active.incoming === player.id || active.outgoing === player.id,
  );
  const cycling = airRotation?.outgoing === player.id;
  const approach = approachAtSurface(state, player);
  const nearSurface = player.position.y > SURFACE_HEIGHT - 0.065;
  // An early top up waits until the team has room for it. Surfacing at or below
  // the safe reserve ignores the quota, so nobody is held down while short.
  const roomToSurface =
    teammatesAway(state, player) <
    surfacingQuota(teamSize(state.formations[player.team]));
  const holding = defending && holdsLine(state, player);
  // Reasons to go up early. A player on the way up keeps going while any of
  // them still holds, so it never turns back and forth at the floor.
  const earlyTopUp =
    !followThrough &&
    !airRotation &&
    roomToSurface &&
    !holding &&
    (outOfPlay(state, player) ||
      (player.air < STAGGER_AIR && breathesWithOthers(state, player)));
  if (
    (defending || followThrough) &&
    !earlyTopUp &&
    !approach &&
    !player.emergency &&
    !cycling &&
    player.mode === "ascending" &&
    player.air > Math.max(reserve + 10, DIVE_BACK_AIR)
  )
    player.mode = "diving";
  // Without room the player still surfaces at its safe reserve. The quota only
  // withholds the early top up, never the breath the player actually needs.
  const topUp = roomToSurface
    ? Math.max(reserve, player.duty === "pressure" ? 30 : 38)
    : reserve + HELD_AIR_MARGIN;
  if (
    player.mode === "playing" &&
    !followThrough &&
    (player.air <
      ((cycling && airRotation.phase === "handoff") ||
      airRotation?.incoming === player.id
        ? reserve
        : holding
          ? reserve
          : topUp) ||
      earlyTopUp ||
      (!defending && !player.wantDown && roomToSurface && player.air < 80))
  )
    player.mode = "ascending";
  if (nearSurface && player.mode === "ascending") player.mode = "recovering";
  if (
    player.mode === "recovering" &&
    !approach &&
    ((player.air >= (defending ? 68 : 80) &&
      player.wantDown &&
      state.time >= player.cycleUntil) ||
      (player.air >= SUPPORT_AIR && teamNeedsSupport(state, player)))
  )
    player.mode = "diving";
  if (player.position.y < FLOOR_HEIGHT + 0.05 && player.mode === "diving")
    player.mode = "playing";
};

// Bots send the same controls as a player and run through the player
// controller, so every movement, turn, stick and shot rule applies to them.
const updateBot = (state: Simulation, player: Player, dt: number): void => {
  const profile = botProfiles[state.difficulty];
  updateBotMode(state, player);
  const pursuing =
    state.puck.controlOwner === undefined &&
    state.puck.shotOwner === undefined &&
    state.puckChasers[player.team] === player.id;
  protectGoalApproach(state, player);
  const travel = player.target.clone().sub(player.position).setY(0);
  const distance = travel.length();
  const sprint =
    canSprint(rulesFor(state), player) &&
    shouldSprintToPuck(state, player, distance);
  const desired = travel
    .normalize()
    .multiplyScalar(
      Math.min(distance * 2.0, sprint ? profile.sprintSpeed : 1.45),
    );
  yieldToPuckChaser(state, player, desired);
  clearAscent(state, player, desired);
  // A carrier turns slowly, so a detour would force a curl. It keeps its line
  // and uses the dummy to slip past instead.
  const line = desired.clone();
  steerThroughTraffic(state, player, desired);
  if (state.puck.controlOwner === player.id) desired.copy(line);
  avoidBodies(player, state.players, desired);
  const desiredSpeed = desired.length();
  const arriving = distance < 0.07 && desiredSpeed < 0.2;
  const holdHeading = distance < 0.35 && desiredSpeed < 0.35;
  const targetYaw = player.grab
    ? player.yaw
    : !holdHeading && desiredSpeed > 0.05
      ? directionYaw(desired.x, desired.z)
      : (player.aimYaw ?? player.yaw);
  const headingError = safeGoalTurn(player, desired, targetYaw);
  const unsafeGoalHeading =
    nearOwnGoal(player) &&
    forwardVector(player.yaw).z * attackDirection(player.team) < 0;
  const controls = botControls(
    state,
    player,
    {
      desired,
      headingError,
      holdHeading,
      sprint,
      stop: arriving || player.grab !== undefined || unsafeGoalHeading,
      pursuing,
      dummy: player.dummy,
    },
    dt,
  );
  updateHuman(state, player, controls, dt);
};

const updateAir = (state: Simulation, player: Player, dt: number): void => {
  const atSurface = player.position.y >= SURFACE_HEIGHT - 0.045;
  player.air = clamp(player.air + airRate(state, player) * dt, 0, 100);
  if (atSurface) {
    if (player.mode !== "diving") player.mode = "recovering";
    if (player.emergency && player.air >= 80) {
      player.emergency = false;
      if (player.human) announceTo(player, "Ready", 2);
    }
  } else {
    if (player.air <= 0 && !player.emergency) {
      player.emergency = true;
      player.mode = "ascending";
      if (player.human) announceTo(player, "Surfacing", 3);
    }
  }
};

export const updateStick = (player: Player, dt: number): void => {
  player.previousStick.copy(player.stick);
  player.previousStickOrientation.copy(player.stickOrientation);
  player.previousStickYaw = player.stickYaw;
  const progress = shotProgress(player);
  const stroke = player.shotTime > 0 ? Math.sin(progress * Math.PI) * 0.18 : 0;
  const local = player.stickOffset.clone();
  local.z -= stroke;
  updateBladePose(player, dt);
  if (player.cradle && player.shotTime <= 0) {
    const seatOffset = puckSeat(player)
      .sub(player.stick)
      .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
    local.copy(player.cradle.target).sub(seatOffset).setY(0);
    player.stickOffset.copy(local);
  }
  local.y += STICK_HEIGHT - FLOOR_HEIGHT;
  local.x = clamp(local.x, -0.8, 0.8);
  local.z = clamp(local.z, -1.05, 0.24);
  const swimming = Math.max(
    smoothMotion((player.position.y - FLOOR_HEIGHT - 0.025) / 0.28),
    smoothMotion((Math.abs(player.bodyPitch) - 0.12) / 0.4),
  );
  if (swimming > 0) {
    const bodyRotation = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 1, 0), player.yaw)
      .multiply(
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 0, 1),
          player.bodyRoll * swimming,
        ),
      )
      .multiply(
        new Quaternion().setFromAxisAngle(
          new Vector3(1, 0, 0),
          player.bodyPitch * swimming,
        ),
      )
      .multiply(
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -player.yaw),
      );
    player.stickOrientation.premultiply(bodyRotation);
  }
  player.stick
    .copy(local)
    .applyAxisAngle(new Vector3(0, 1, 0), player.yaw)
    .add(player.position);
  const pawOrigin = FRONT_PAW.clone()
    .setX(FRONT_PAW.x * handSide(player))
    .applyAxisAngle(new Vector3(1, 0, 0), player.bodyPitch)
    .applyAxisAngle(new Vector3(0, 0, 1), player.bodyRoll)
    .applyAxisAngle(new Vector3(0, 1, 0), player.yaw)
    .add(player.position)
    .sub(
      mirrorBladePoint(player, STICK_GRIP).applyAxisAngle(
        new Vector3(0, 1, 0),
        player.stickYaw,
      ),
    );
  player.stick.lerp(pawOrigin, swimming);
  if (player.shotOrigin && player.shotTime > 0 && swimming === 0) {
    const target = shotPuckPosition(player).addScaledVector(
      player.shotDirection,
      -0.032 + 0.26 * smoothMotion((progress - SHOT_RELEASE) / 0.21),
    );
    const contactOffset = mirrorBladePoint(
      player,
      SHOT_CONTACT.clone().sub(STICK_GRIP),
    ).applyQuaternion(player.stickOrientation);
    const approach = clamp(progress / SHOT_APPROACH, 0, 1);
    const grip = player.shotGrip
      .clone()
      .add(shotTranslation(player))
      .lerp(target.sub(contactOffset), smoothMotion(approach));
    grip.add(
      new Vector3(handSide(player) * 0.09, 0.028, 0)
        .applyAxisAngle(
          new Vector3(0, 1, 0),
          directionYaw(player.shotDirection.x, player.shotDirection.z),
        )
        .multiplyScalar(Math.sin(approach * Math.PI)),
    );
    const shotStick = grip.sub(
      mirrorBladePoint(player, STICK_GRIP).applyAxisAngle(
        new Vector3(0, 1, 0),
        player.stickYaw,
      ),
    );
    player.stick.lerp(shotStick, 1 - smoothMotion((progress - 0.78) / 0.22));
  }
  const { x, y, z, w } = player.stickOrientation;
  const acrossHeight = 2 * (x * y + w * z);
  const forwardHeight = 2 * (y * z - w * x);
  const minimumBladeHeight = STICK_EDGE.reduce(
    (minimum: number, point): number =>
      Math.min(
        minimum,
        player.stick.y +
          acrossHeight * (point[0] - 0.1) * bladeMirror(player) +
          forwardHeight * (point[1] - 0.077),
      ),
    Infinity,
  );
  player.stick.y += Math.max(0, 0.011 - minimumBladeHeight);
  player.stickVelocity
    .copy(player.stick)
    .sub(player.previousStick)
    .divideScalar(dt)
    .clampLength(0, 8);
};

const stickPoint = (
  player: Player,
  point: readonly [number, number],
): Vector3 => bladePoint(player, new Vector3(point[0], 0, point[1]));

const recordTouch = (state: Simulation, player: Player): void => {
  state.puck.flightOrientation = undefined;
  const owner = state.players.find(
    (other: Player): boolean =>
      other.id === (state.puck.controlOwner ?? state.puck.shotOwner),
  );
  if (owner && owner !== player) {
    owner.curlBlockedUntil = state.time + 0.7;
    releaseControl(state);
    state.puck.shotOwner = undefined;
  }
  state.puck.lastTouch = player.id;
  state.puck.touchTime = state.time;
  state.contacts += 1;
  if (canCarryPuck(state, player)) {
    state.puck.controlOwner = player.id;
    state.puck.controlKind = "carry";
    state.puck.velocity.copy(player.velocity).setY(0).clampLength(0, 3.5);
    player.grab = undefined;
  }
};

const canHandlePuck = (state: Simulation, player: Player): boolean =>
  player.position.y <= FLOOR_HEIGHT + 0.06 &&
  Math.abs(player.bodyPitch) < 0.18 &&
  !player.emergency &&
  player.mode !== "ascending" &&
  player.mode !== "recovering" &&
  player.shotTime <= 0 &&
  player.cooldown <= 0 &&
  player.knockdownTime <= 0 &&
  state.puck.position.y < 0.06 &&
  state.puck.shotOwner === undefined &&
  state.time >= player.curlBlockedUntil;

const canCarryPuck = (state: Simulation, player: Player): boolean =>
  canHandlePuck(state, player) && !isPuckContested(state, player);

const fireShot = (state: Simulation, player: Player): void => {
  const puck = state.puck;
  puck.velocity
    .copy(player.shotDirection)
    .multiplyScalar(
      (FLICK_BASE + player.shotPower * FLICK_GAIN) *
        flickScale(player.attributes),
    )
    .addScaledVector(player.velocity, 0.65);
  puck.velocity.y = 0.75 + player.shotPower * 0.85;
  puck.velocity.y *= state.physics.lift * player.shotLoft;
  puck.spin = 0;
  puck.angularVelocity.set(0, 0, 0);
  puck.orientation.copy(shotPuckOrientation(player));
  const releaseNormal = new Vector3(0, 1, 0)
    .applyQuaternion(puck.orientation)
    .setY(0)
    .normalize();
  if (player.shotLoft > 0.5)
    puck.orientation.setFromUnitVectors(new Vector3(0, 1, 0), releaseNormal);
  puck.flightOrientation = puck.orientation.clone();
  puck.shotOwner = undefined;
  releaseControl(state);
  player.curlBlockedUntil = state.time + 0.7;
  player.shotFired = true;
  state.shots += 1;
  state.playground.trace.length = 0;
  state.playground.origin.copy(puck.position);
  state.playground.peak = puck.position.y;
  state.playground.distance = 0;
};

const beginFlick = (state: Simulation, player: Player): void => {
  state.puck.shotOwner = player.id;
  releaseControl(state);
  state.puck.angularVelocity.set(0, 0, 0);
  state.puck.spin = 0;
  state.puck.flightOrientation = undefined;
  player.shotOrigin = state.puck.position.clone();
  player.shotStartPosition.copy(player.position);
  player.shotGrip.copy(bladePoint(player, STICK_GRIP));
  recordTouch(state, player);
};

const updateFlick = (state: Simulation, dt: number): void => {
  const puck = state.puck;
  const player = state.players.find(
    (candidate: Player): boolean => candidate.id === puck.shotOwner,
  );
  if (!player) return;
  const progress = shotProgress(player);
  if (player.emergency || player.shotTime <= 0) {
    puck.shotOwner = undefined;
    return;
  }
  const target = shotPuckPosition(player);
  puck.orientation.copy(shotPuckOrientation(player));
  puck.position.copy(target).setY(Math.max(puckFloorHeight(state), target.y));
  puck.velocity
    .copy(puck.position)
    .sub(puck.previous)
    .divideScalar(dt)
    .clampLength(0, 8);
  if (progress >= SHOT_RELEASE) fireShot(state, player);
};

const releaseControl = (state: Simulation): void => {
  state.puck.controlOwner = undefined;
  state.puck.controlKind = undefined;
  state.puck.controlUntil = 0;
};

const moveControlledPuck = (
  state: Simulation,
  player: Player,
  dt: number,
): void => {
  const puck = state.puck;
  const anchor = puckSeat(player).setY(PUCK_HEIGHT);
  anchor.x = clamp(
    anchor.x,
    -POOL.width / 2 + PUCK_RADIUS,
    POOL.width / 2 - PUCK_RADIUS,
  );
  anchor.z = clamp(
    anchor.z,
    -POOL.length / 2 + PUCK_RADIUS,
    POOL.length / 2 - PUCK_RADIUS,
  );
  const carried = puck.position
    .clone()
    .add(player.position)
    .sub(player.previous)
    .setY(PUCK_HEIGHT);
  puck.position.copy(carried.add(anchor.sub(carried).clampLength(0, 3.5 * dt)));
  puck.velocity
    .copy(puck.position)
    .sub(puck.previous)
    .divideScalar(dt)
    .clampLength(0, 8);
  puck.lastTouch = player.id;
  puck.touchTime = state.time;
  puck.spin = player.curlTurnSpeed * bladeMirror(player);
  puck.angularVelocity.multiplyScalar(Math.exp(-14 * dt));
  puck.orientation.slerp(
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), puck.rotation),
    1 - Math.exp(-18 * dt),
  );
};

const updatePuckControl = (state: Simulation, dt: number): void => {
  const puck = state.puck;
  if (puck.shotOwner !== undefined) return;
  const owner = state.players.find(
    (player: Player): boolean => player.id === puck.controlOwner,
  );
  if (
    owner &&
    (owner.emergency ||
      owner.mode === "ascending" ||
      owner.position.y > FLOOR_HEIGHT + 0.06 ||
      Math.abs(owner.bodyPitch) > 0.18 ||
      owner.knockdownTime > 0 ||
      isPuckContested(state, owner) ||
      owner.stick.distanceTo(puck.position) > 0.8)
  ) {
    releaseControl(state);
    return;
  }
  const candidate =
    owner ??
    state.players.find(
      (player: Player): boolean =>
        (player.curl !== 0 || player.dummy !== 0) &&
        !player.emergency &&
        player.mode !== "ascending" &&
        player.mode !== "recovering" &&
        Math.abs(player.bodyPitch) < 0.18 &&
        player.position.y <= FLOOR_HEIGHT + 0.06 &&
        !isPuckContested(state, player) &&
        player.cooldown <= 0 &&
        player.knockdownTime <= 0 &&
        state.time >= player.curlBlockedUntil &&
        puck.shotOwner === undefined &&
        player.stick.distanceTo(puck.position) <
          (player.curl !== 0 ? 0.65 : 0.27) &&
        Math.abs(player.stick.y - puck.position.y) < 0.16 &&
        puck.position.y < 0.2,
    );
  if (!candidate) return;
  if (!owner) {
    recordTouch(state, candidate);
    puck.controlOwner = candidate.id;
  }
  const activeKind = candidate.charging
    ? "charge"
    : candidate.curl !== 0
      ? "curl"
      : candidate.dummy !== 0
        ? "dummy"
        : undefined;
  if (activeKind) {
    puck.controlKind = activeKind;
    puck.controlUntil = state.time + 0.34;
  } else if (puck.controlKind !== "settling" && puck.controlKind !== "carry") {
    puck.controlKind = "settling";
    puck.controlUntil = state.time + 0.34;
  }
  if (candidate.shotTime > 0 && !candidate.shotFired) {
    beginFlick(state, candidate);
    return;
  }
  moveControlledPuck(state, candidate, dt);
  if (!activeKind && state.time >= puck.controlUntil) {
    puck.controlKind = "carry";
  }
};

const resolveKnockdowns = (state: Simulation): void => {
  for (const player of state.players) {
    if (
      player.knockdownTime <= 0 ||
      player.knockdownAttempted ||
      KNOCKDOWN_DURATION - player.knockdownTime < KNOCKDOWN_HIT_TIME
    )
      continue;
    player.knockdownAttempted = true;
    if (player.emergency || !puckInKnockdownBox(state, player)) continue;
    const puck = state.puck;
    recordTouch(state, player);
    releaseControl(state);
    puck.shotOwner = undefined;
    puck.velocity.multiplyScalar(0.4).setY(-2.6);
    puck.angularVelocity.multiplyScalar(0.2);
    player.knockdownTarget.copy(puck.position);
    announce(state, "Knockdown", 0.7);
  }
};

const resolveStickContact = (
  state: Simulation,
  player: Player,
  dt: number,
): void => {
  const puck = state.puck;
  if (
    player.position.y > 0.9 ||
    player.knockdownTime > 0 ||
    puck.controlOwner === player.id ||
    puck.shotOwner === player.id ||
    (player.shotFired && player.shotTime > 0)
  )
    return;
  if (
    player.stick.distanceToSquared(puck.position) > 0.24 ||
    Math.abs(player.stick.y - puck.position.y) > 0.15
  )
    return;
  const teammateHolding = state.players.some(
    (other): boolean =>
      other.id === (puck.controlOwner ?? puck.shotOwner) &&
      other.team === player.team,
  );
  if (teammateHolding) return;
  if (
    !player.human &&
    state.mode === "match" &&
    state.faceoff === undefined &&
    state.puckChasers[player.team] !== undefined &&
    state.puckChasers[player.team] !== player.id
  )
    return;
  for (const [index, start] of STICK_EDGE.entries()) {
    const end = STICK_EDGE.at(index + 1);
    if (!end) continue;
    const a = stickPoint(player, start);
    const b = stickPoint(player, end);
    const edge = b.sub(a);
    const t = clamp(
      puck.position.clone().sub(a).dot(edge) / edge.lengthSq(),
      0,
      1,
    );
    const closest = a.addScaledVector(edge, t);
    const localContact = new Vector3(start[0], 0, start[1]).lerp(
      new Vector3(end[0], 0, end[1]),
      t,
    );
    const previousContact = mirrorBladePoint(player, localContact)
      .applyQuaternion(player.previousStickOrientation)
      .add(
        bladeOrigin(
          player,
          player.previousStickOrientation,
          player.previousStickYaw,
        ),
      )
      .add(player.previousStick)
      .sub(player.stick);
    const contactVelocity = closest
      .clone()
      .sub(previousContact)
      .divideScalar(dt)
      .clampLength(0, 8);
    const normal = puck.position.clone().sub(closest).setY(0);
    const distance = normal.length();
    const radius = PUCK_RADIUS + 0.018;
    if (distance >= radius) continue;
    if (
      contactVelocity.y < -0.3 &&
      previousContact.y - puck.previous.y >= 0.0285 &&
      closest.y - puck.position.y <= 0.0285
    ) {
      puck.position.y = Math.max(PUCK_HEIGHT, closest.y - 0.0285);
      puck.velocity.y = Math.min(puck.velocity.y, contactVelocity.y * 0.9);
      recordTouch(state, player);
      continue;
    }
    const heightDifference = puck.position.y - closest.y;
    const verticalPenetration = 0.0285 - Math.abs(heightDifference);
    if (verticalPenetration < 0) continue;
    if (
      player.shotTime > 0 &&
      shotProgress(player) < 0.4 &&
      !player.shotFired
    ) {
      beginFlick(state, player);
      return;
    }
    if (
      Math.abs(heightDifference) > 0.001 &&
      verticalPenetration < radius - distance
    ) {
      const side = Math.sign(heightDifference);
      puck.position.y = Math.max(
        PUCK_HEIGHT,
        puck.position.y + side * verticalPenetration,
      );
      const relativeVertical = puck.velocity.y - contactVelocity.y;
      if (side * relativeVertical < 0)
        puck.velocity.y -= relativeVertical * 1.05;
      recordTouch(state, player);
      continue;
    }
    if (distance > 0.00001) normal.divideScalar(distance);
    else normal.copy(forwardVector(player.stickYaw));
    const relativeSpeed = puck.velocity
      .clone()
      .sub(contactVelocity)
      .dot(normal);
    puck.position.addScaledVector(normal, Math.min(radius - distance, 0.035));
    if (relativeSpeed < 0)
      puck.velocity.addScaledVector(normal, -relativeSpeed * 1.08);
    const tangential =
      contactVelocity.x * normal.z - contactVelocity.z * normal.x;
    puck.spin += tangential * 0.7;
    if (player.stickVelocity.y < -0.3 && puck.position.y > 0.075)
      puck.velocity.y = Math.min(
        puck.velocity.y,
        player.stickVelocity.y * 0.65,
      );
    recordTouch(state, player);
    if (puck.controlOwner === player.id) return;
  }
};

const resetPositions = (state: Simulation): void => {
  state.puckChasers = [undefined, undefined];
  state.airRotations = [[], []];
  state.strongSides = [1, -1];
  for (const player of state.players) {
    const initial = makePlayer(
      player.id,
      state.mode,
      player.handedness,
      player.human,
      state.formations[player.team],
      player.species,
    );
    Object.assign(player, initial, {
      attributes: player.attributes,
      autoCurl: player.autoCurl,
    });
    updateStick(player, 1 / 120);
    player.previousStick.copy(player.stick);
  }
  state.puck.position.set(0, PUCK_HEIGHT, state.mode === "practice" ? 1.93 : 0);
  state.puck.previous.copy(state.puck.position);
  state.puck.velocity.set(0, 0, 0);
  state.puck.lastTouch = undefined;
  state.puck.spin = 0;
  releaseControl(state);
  state.puck.touchTime = -10;
  state.puck.flightOrientation = undefined;
  state.puck.shotOwner = undefined;
  state.puck.orientation.identity();
  state.puck.previousOrientation.identity();
  state.puck.angularVelocity.set(0, 0, 0);
  state.faceoff =
    state.mode === "match"
      ? { phase: "ready", remaining: FACEOFF_COUNTDOWN + FACEOFF_SETTLE }
      : undefined;
  state.decisionTime = 0;
  syncInterpolation(state);
  state.event = "";
  state.eventTime = 0;
};

const syncInterpolation = (state: Simulation): void => {
  for (const player of state.players) {
    player.previous.copy(player.position);
    player.previousYaw = player.yaw;
    player.previousBodyPitch = player.bodyPitch;
    player.previousStick.copy(player.stick);
    player.previousStickYaw = player.stickYaw;
    player.previousStickOrientation.copy(player.stickOrientation);
    player.stickVelocity.set(0, 0, 0);
  }
  state.puck.previous.copy(state.puck.position);
  state.puck.previousOrientation.copy(state.puck.orientation);
};

export const resetPracticePuck = (state: Simulation): void => {
  const human = state.players.at(0);
  if (!human || state.mode === "match") return;
  human.dummyBurstUntil = 0;
  human.autoDummyUntil = 0;
  human.autoDummyLocked = false;
  human.shotTime = 0;
  human.shotOrigin = undefined;
  human.shotFired = false;
  human.cooldown = 0;
  human.knockdownTime = 0;
  human.knockdownCooldown = 0;
  human.charging = false;
  human.charge = 0;
  human.shotDraw = 0;
  human.cradle = undefined;
  human.grab = undefined;
  human.curl = 0;
  human.curlTurnSpeed = 0;
  human.dummy = 0;
  human.lateral = 0;
  human.bladeRotation = REST_BLADE_YAW;
  human.bladeFace = human.backhand ? 1 : 0;
  human.bladeTilt = 0;
  human.stickOffset.set(0.13 * handSide(human), 0, -STICK_REACH);
  human.velocity.set(0, 0, 0);
  updateStick(human, 1 / 120);
  human.previousStick.copy(human.stick);
  human.previousStickOrientation.copy(human.stickOrientation);
  state.puck.position.copy(puckSeat(human)).setY(PUCK_HEIGHT);
  state.puck.previous.copy(state.puck.position);
  state.puck.velocity.set(0, 0, 0);
  state.puck.lastTouch = undefined;
  state.puck.spin = 0;
  releaseControl(state);
  state.puck.flightOrientation = undefined;
  state.puck.shotOwner = undefined;
  state.puck.orientation.identity();
  state.puck.previousOrientation.identity();
  state.puck.angularVelocity.set(0, 0, 0);
  state.playground.trace.length = 0;
  state.playground.distance = 0;
  state.playground.peak = 0;
  state.playground.origin.copy(state.puck.position);
};

export const feedPracticePuck = (state: Simulation): void => {
  if (state.mode !== "playground") return;
  resetPracticePuck(state);
  const human = state.players.at(0);
  if (!human) return;
  const forward = forwardVector(human.yaw);
  state.puck.position.addScaledVector(forward, 0.8).setY(0.7);
  state.puck.previous.copy(state.puck.position);
  state.puck.velocity.copy(forward).multiplyScalar(-3.2).setY(0.5);
  state.playground.origin.copy(state.puck.position);
};

const planStrike = (state: Simulation): void => {
  if (state.faceoff?.phase !== "strike") return;
  planTeam(state, 0);
  planTeam(state, 1);
  const puck = state.puck.position;
  for (const player of state.players) {
    player.wantDown = true;
    if (player.slot !== 0) continue;
    state.puckChasers[player.team] = player.id;
    player.role = "Striker";
    player.duty = "pressure";
    // The striker heads straight at the puck and stops short on its own line,
    // as a chaser does, so it never passes beside the puck and turns back.
    const angle = directionYaw(
      puck.x - player.position.x,
      puck.z - player.position.z,
    );
    player.target
      .copy(puck)
      .addScaledVector(forwardVector(angle), -GRAB_STANDOFF)
      .setY(FLOOR_HEIGHT);
    player.aimYaw = angle;
  }
};

type MatchControls = Controls | ReadonlyMap<number, Controls>;
const idleControls = freshControls();
const playerControls = (controls: MatchControls, id: number): Controls =>
  "get" in controls ? (controls.get(id) ?? idleControls) : controls;
const clearActions = (controls: MatchControls): void => {
  const inputs = "values" in controls ? controls.values() : [controls];
  for (const input of inputs) {
    input.yawDelta = 0;
    input.shot = 0;
    input.dive = false;
    input.knockdown = false;
  }
};

const updateWallStart = (
  state: Simulation,
  controls: MatchControls,
  dt: number,
): boolean => {
  const faceoff = state.faceoff;
  if (!faceoff) return false;
  if (faceoff.phase === "strike") {
    faceoff.elapsed += dt;
    if (state.puck.lastTouch !== undefined || faceoff.elapsed > 14) {
      state.faceoff = undefined;
      state.decisionTime = 0;
    }
    return false;
  }
  faceoff.remaining = Math.max(0, faceoff.remaining - dt);
  if (faceoff.remaining <= FACEOFF_COUNTDOWN)
    announce(state, String(Math.ceil(faceoff.remaining)), 1);
  for (const player of state.players) {
    player.role = player.slot === 0 ? "Striker · at the wall" : "At the wall";
    player.air = 100;
    player.stamina = MAX_STAMINA;
    player.heartRate = REST_HEART_RATE;
    player.previous.copy(player.position);
    player.previousYaw = player.yaw;
    player.previousBodyPitch = player.bodyPitch;
    player.previousStick.copy(player.stick);
    if (player.human)
      player.yaw += playerControls(controls, player.id).yawDelta;
    updateStick(player, dt);
  }
  clearActions(controls);
  if (faceoff.remaining === 0) {
    state.faceoff = { phase: "strike", elapsed: 0 };
    planStrike(state);
    for (const player of state.players) {
      const surface = !player.human && approachAtSurface(state, player);
      player.wallReady = false;
      player.mode = surface ? "ascending" : "diving";
      player.velocity
        .copy(forwardVector(player.yaw))
        .multiplyScalar(1.7)
        .setY(surface ? 0.3 : -0.6);
      player.sprint = false;
    }
    announce(state, "Go!", 1);
  }
  return true;
};

const updatePlayerMotion = (player: Player, dt: number): void => {
  const targetPitch =
    player.mode === "diving" ? -0.65 : player.mode === "ascending" ? 0.5 : 0;
  player.bodyPitch +=
    (targetPitch - player.bodyPitch) * (1 - Math.exp(-7 * dt));
  player.bodyRoll +=
    (-player.curl * 0.2 - player.bodyRoll) * (1 - Math.exp(-9 * dt));
  player.kickPhase += dt * (player.sprint ? 13 : 4 + player.kick * 4);
};

export const stepSimulation = (
  state: Simulation,
  controls: MatchControls,
  dt: number,
): void => {
  if (state.finished) return;
  state.time += dt;
  state.eventTime = Math.max(0, state.eventTime - dt);
  for (const player of state.players)
    player.eventTime = Math.max(0, player.eventTime - dt);
  if (state.restartTime > 0) {
    for (const player of state.players) {
      if (player.human)
        player.yaw += playerControls(controls, player.id).yawDelta * 1.3;
    }
    state.restartTime = Math.max(0, state.restartTime - dt);
    if (state.restartTime === 0) resetPositions(state);
    syncInterpolation(state);
    clearActions(controls);
    return;
  }
  if (updateWallStart(state, controls, dt)) return;
  if (state.mode === "match") {
    state.seconds = Math.max(0, state.seconds - dt);
    if (state.seconds === 0) {
      state.finished = true;
      return;
    }
  }
  state.decisionTime -= dt;
  if (state.decisionTime <= 0 && state.mode === "match") {
    if (state.faceoff?.phase === "strike") planStrike(state);
    else {
      coachTeam(state, 0);
      coachTeam(state, 1);
      planTeam(state, 0);
      planTeam(state, 1);
      coordinatePuckPursuit(state, 0);
      coordinatePuckPursuit(state, 1);
      for (const player of state.players)
        if (!player.human) prepareAI(state, player);
    }
    state.decisionTime =
      botProfiles[state.difficulty].decisionPeriod *
      (state.botNoise ? 0.6 + 0.8 * state.botNoise() : 1);
    if (state.botNoise)
      for (const player of state.players)
        if (!player.human) {
          player.target.x += (state.botNoise() - 0.5) * 0.3;
          player.target.z += (state.botNoise() - 0.5) * 0.3;
        }
  }
  for (const player of state.players) {
    player.previous.copy(player.position);
    player.previousYaw = player.yaw;
    player.previousBodyPitch = player.bodyPitch;
    if (player.human)
      updateHuman(state, player, playerControls(controls, player.id), dt);
    else updateBot(state, player, dt);
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.knockdownCooldown = Math.max(0, player.knockdownCooldown - dt);
    player.knockdownTime = Math.max(0, player.knockdownTime - dt);
    player.shotTime = Math.max(0, player.shotTime - dt);
    if (state.mode !== "playground") {
      updateHeart(state, player, dt);
      updateStamina(rulesFor(state), player, dt);
      updateAir(state, player, dt);
    }
    updatePlayerMotion(player, dt);
  }
  resolveBodies(state.players, dt, false);
  resolveBodies(state.players, dt, false);
  pushWeakerBodies(state.players);
  for (const player of state.players) {
    player.position.addScaledVector(player.velocity, dt);
    player.position.x = clamp(player.position.x, -7.18, 7.18);
    player.position.z = clamp(player.position.z, -12.1, 12.1);
    player.position.y = clamp(player.position.y, FLOOR_HEIGHT, SURFACE_HEIGHT);
    if (player.position.y === FLOOR_HEIGHT)
      player.velocity.y = Math.max(0, player.velocity.y);
    if (player.position.y === SURFACE_HEIGHT)
      player.velocity.y = Math.min(0, player.velocity.y);
  }
  resolveBodies(state.players, dt, true);
  for (const player of state.players) {
    if (player.shotTime > 0 && shotProgress(player) < 0.05)
      resolveStickContact(state, player, dt);
    updateStick(player, dt);
  }
  advancePuck(state, dt);
  if (state.restartTime === 0) {
    updatePuckControl(state, dt);
    resolveKnockdowns(state);
    for (const player of state.players) resolveStickContact(state, player, dt);
    updateFlick(state, dt);
  }
  if (state.mode === "playground" && state.puck.velocity.lengthSq() > 0.01) {
    const lab = state.playground;
    lab.peak = Math.max(lab.peak, state.puck.position.y);
    lab.distance = Math.hypot(
      state.puck.position.x - lab.origin.x,
      state.puck.position.z - lab.origin.z,
    );
    if (
      !lab.trace.at(-1) ||
      (lab.trace.at(-1)?.distanceToSquared(state.puck.position) ?? 0) > 0.0036
    ) {
      lab.trace.push(state.puck.position.clone());
      if (lab.trace.length > 180) lab.trace.shift();
    }
  }
  clearActions(controls);
  if (state.restartTime > 0) syncInterpolation(state);
};

export const predictPlayerMovement = (
  state: Simulation,
  player: Player,
  controls: Controls,
  dt: number,
): void => {
  if (state.finished) return;
  if (state.restartTime > 0 || state.faceoff?.phase === "ready") {
    player.yaw += controls.yawDelta * (state.restartTime > 0 ? 1.3 : 1);
    return;
  }
  updateHumanMovement(state, player, controls, dt);
  updateHumanCharge(player, controls, dt);
  updatePlayerMotion(player, dt);
  if (state.puck.controlOwner === player.id) updateCradle(state, player, dt);
  player.position.addScaledVector(player.velocity, dt);
  player.position.x = clamp(player.position.x, -7.18, 7.18);
  player.position.z = clamp(player.position.z, -12.1, 12.1);
  player.position.y = clamp(player.position.y, FLOOR_HEIGHT, SURFACE_HEIGHT);
  if (player.position.y === FLOOR_HEIGHT)
    player.velocity.y = Math.max(0, player.velocity.y);
  if (player.position.y === SURFACE_HEIGHT)
    player.velocity.y = Math.min(0, player.velocity.y);
  updateStick(player, dt);
};

export const predictOwnedPuck = (
  state: Simulation,
  player: Player,
  dt: number,
): boolean => {
  if (
    state.finished ||
    state.restartTime > 0 ||
    state.faceoff?.phase === "ready" ||
    state.puck.controlOwner !== player.id ||
    state.puck.shotOwner !== undefined ||
    !canCarryPuck(state, player) ||
    player.stick.distanceTo(state.puck.position) > 0.8
  )
    return false;
  moveControlledPuck(state, player, dt);
  return true;
};
