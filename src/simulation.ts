import { Quaternion, Vector3 } from "three";
import {
  nearOwnGoal,
  protectGoalApproach,
  safeGoalTurn,
} from "./bot-goal-safety";
import {
  botProfiles,
  coordinatePuckPursuit,
  defendingZone,
  followingAttack,
  safeAirReserve,
  shouldSprintToPuck,
  steerThroughTraffic,
  teamPuckCarrier,
  yieldToPuckChaser,
} from "./bots";
import { avoidBodies, resolveBodies } from "./collisions";
import { wallLane } from "./formation-layout";
import { planTeam } from "./formations";
import { advancePuck, puckFloorHeight } from "./puck-physics";
import { RULESETS, type Rules } from "./rules";
import { announce } from "./simulation-events";

export {
  goalSurfaceHeight,
  puckFloorHeight,
  puckInsideGoal,
} from "./puck-physics";
export { announce } from "./simulation-events";

import {
  availablePuckMove,
  canGrabPuck,
  canKnockdown,
  frontPuckPosition,
  isPuckContested,
  KNOCKDOWN_DURATION,
  KNOCKDOWN_HIT_TIME,
  puckInGrabReach,
  puckInKnockdownBox,
  puckInMoveReach,
  puckMoveOffset,
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
  angleDifference,
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
  type Player,
  POOL,
  PUCK_HEIGHT,
  PUCK_RADIUS,
  type PuckMoveKind,
  type Ruleset,
  type Simulation,
  STICK_EDGE,
  STICK_HEIGHT,
  STICK_REACH,
  SURFACE_HEIGHT,
  type Team,
} from "./types";

const makePlayer = (
  id: number,
  mode: GameMode,
  handedness: Handedness = "right",
  human = id === 0,
  formation: Formation = "2-3-1",
): Player => {
  const team: Team = id < 6 ? 0 : 1;
  const slot = id % 6;
  const direction = attackDirection(team);
  const wallReady = mode === "match";
  const position = wallReady
    ? new Vector3(wallLane(formation, slot) * -direction, 1.9, -direction * 12)
    : new Vector3(0, FLOOR_HEIGHT, 3);
  return {
    id,
    team,
    slot,
    human,
    handedness,
    position,
    previous: position.clone(),
    previousYaw: team === 0 ? 0 : Math.PI,
    previousBodyPitch: 0,
    dummyBurstUntil: 0,
    velocity: new Vector3(),
    yaw: team === 0 ? 0 : Math.PI,
    aimYaw: undefined,
    evadeSide: 0,
    evadeUntil: 0,
    evadeTarget: position.clone(),
    air: 100,
    stamina: MAX_STAMINA,
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
    dummy: 0,
    lateral: 0,
    cradle: undefined,
    grab: undefined,
    puckMove: undefined,
    puckMoveCooldown: 0,
    puckWorkHeld: false,
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
  const humanTeam = selection.species === "beaver" ? 1 : 0;
  const humanId = humanTeam * 6 + clamp(Math.round(selection.position), 0, 5);
  const roster =
    mode === "match"
      ? Array.from({ length: 12 }, (_, id): number => id)
      : [humanId];
  const state: Simulation = {
    difficulty: selection.difficulty,
    ruleset,
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
          (id < 6 ? 0 : 1) === humanTeam ? formation : opposition,
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
    seconds: duration,
    duration,
    time: 0,
    decisionTime: 0,
    restartTime: 0,
    faceoff: mode === "match" ? { phase: "ready", remaining: 3 } : undefined,
    finished: false,
    mode,
    backLeads: [5, 11],
    puckChasers: [undefined, undefined],
    airRotations: [[], []],
    strongSides: [1, -1],
    event: mode === "match" ? "3" : "",
    eventTime: 4,
    contacts: 0,
    shots: 0,
  };
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
  player.puckMove = undefined;
  player.puckWorkHeld = false;
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
    player.knockdownTime > 0 ||
    player.puckMove !== undefined
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

const updateCradle = (state: Simulation, player: Player, dt: number): void => {
  if (
    !canCarryPuck(state, player) ||
    player.puckMove ||
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
    if (
      cradle.elapsed >= SWERVE_PULL_DURATION &&
      cradle.elapsed - dt < SWERVE_PULL_DURATION
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
      .lerp(pulled, smoothMotion(cradle.elapsed / SWERVE_PULL_DURATION))
      .lerp(extended, swerveExtension(player));
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

const staminaFraction = (player: Player): number =>
  player.stamina / MAX_STAMINA;

const canSprint = (rules: Rules, player: Player): boolean =>
  !rules.sprintGate || player.stamina > (player.sprint ? 0 : rules.sprintFloor);

const updateStamina = (rules: Rules, player: Player, dt: number): void => {
  const atSurface = player.position.y >= SURFACE_HEIGHT - 0.045;
  const effort =
    (player.sprint ? rules.sprintDrain : rules.idleDrain) +
    rules.kickDrain * Math.min(1, player.kick);
  const spent = atSurface
    ? player.sprint
      ? effort * rules.surfaceSprint
      : 0
    : effort;
  const regained = player.sprint
    ? 0
    : (atSurface ? rules.surfaceRecovery : rules.recovery) *
      (player.emergency ? rules.emergencyRecovery : 1);
  player.stamina = clamp(
    player.stamina + (regained - spent) * dt,
    0,
    MAX_STAMINA,
  );
};

const CURL_TURN_SPEED = 2.795;
const TURN_RESPONSE = 9;
const HARD_TURN_RATE = 2.6;
const HARD_TURN_RELEASE = 1.6;

const bodyTurnRate = (controls: Controls): number =>
  controls.lateral * (controls.sprint && controls.forward > 0 ? 2.08 : 2.47);

const turnDemand = (controls: Controls, dt: number): number =>
  (controls.yawDelta * 1.3) / dt - bodyTurnRate(controls);

const turningHard = (player: Player): boolean =>
  Math.abs(player.turnRate) >
  (player.curl === 0 ? HARD_TURN_RATE : HARD_TURN_RELEASE);

const autoCurlDirection = (
  rules: Rules,
  state: Simulation,
  player: Player,
  controls: Controls,
): number =>
  rules.autoCurl &&
  state.puck.controlOwner === player.id &&
  !controls.charging &&
  !controls.dummyMode &&
  !player.puckMove &&
  !player.grab &&
  turningHard(player)
    ? Math.sign(player.turnRate) * bladeMirror(player)
    : 0;

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
  player.turnRate +=
    (turnDemand(controls, dt) - player.turnRate) *
    (1 - Math.exp(-TURN_RESPONSE * dt));
  const curl =
    controls.curl !== 0
      ? controls.curl
      : autoCurlDirection(rules, state, player, controls);
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
  player.dummy = curl === 0 ? controls.dummy : 0;
  player.lateral = locomotion.lateral;
  player.curlTurnSpeed +=
    (curl * CURL_TURN_SPEED - player.curlTurnSpeed) *
    (1 - Math.exp(-(curl === 0 ? 34 : 24) * dt));
  if (Math.abs(player.curlTurnSpeed) < 0.01) player.curlTurnSpeed = 0;
  const steer =
    controls.yawDelta * 1.3 * (curl === 0 ? 1 : rules.curlMouseTurn) -
    bodyTurnRate(locomotion) * dt +
    player.curlTurnSpeed * bladeMirror(player) * dt;
  player.yaw +=
    !rules.autoCurl || (curl === 0 && state.puck.controlOwner !== player.id)
      ? steer
      : clamp(steer, -CURL_TURN_SPEED * dt, CURL_TURN_SPEED * dt);
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
  const speed = player.sprint ? 2.9 : 1.55;
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
  player.charge = player.charging ? clamp(controls.charge, 0, 1) : 0;
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
  const forward = forwardVector(player.yaw);
  const underwater = player.position.y < SURFACE_HEIGHT - 0.07;
  updateHumanCharge(player, controls, dt);
  if (player.charging && player.puckMove) endPuckMove(state, player);
  if (controls.pushPull && !player.puckWorkHeld && !player.charging) {
    const kind = availablePuckMove(state, player);
    if (kind) beginPuckMove(state, player, kind);
  }
  player.puckWorkHeld = controls.pushPull;
  if (
    player.puckMove &&
    (!puckInMoveReach(state, player) ||
      player.curl !== 0 ||
      player.dummy !== 0 ||
      Math.abs(angleDifference(player.yaw, player.puckMove.yaw)) > 0.55)
  )
    endPuckMove(state, player);
  if (player.puckMove) player.puckMove.elapsed += dt;
  updateCradle(state, player, dt);
  if (player.grab) {
    player.grab.elapsed += dt;
    player.grab.target.copy(state.puck.position);
    if (
      player.grab.elapsed > 0.55 ||
      !canHandlePuck(state, player) ||
      !puckInGrabReach(state, player, controls.pitch) ||
      player.puckMove ||
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
    player.knockdownCooldown = 0.55;
    player.knockdownAttempted = false;
    player.knockdownTarget.copy(state.puck.position);
    if (state.puck.controlOwner === player.id) releaseControl(state);
  } else if (controls.knockdown && canGrabPuck(state, player, controls.pitch)) {
    player.grab = { elapsed: 0, target: state.puck.position.clone() };
    player.knockdownCooldown = 0.45;
  }
  player.handling =
    player.dummy !== 0 ||
    player.knockdownTime > 0 ||
    player.charging ||
    player.puckMove !== undefined ||
    player.grab !== undefined;
  const offset = new Vector3(
    handSide(player) * 0.13 +
      player.dummy * 0.3 +
      (player.curl === 0 ? player.lateral * 0.08 : 0),
    0,
    -STICK_REACH,
  );
  offset.copy(puckMoveOffset(state, player, offset));
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
        -(player.knockdownTime > 0 || player.puckMove || player.grab
          ? 42
          : player.dummy !== 0
            ? 32
            : 12) * dt,
      ),
  );
  if (controls.shot > 0) {
    if (player.puckMove) endPuckMove(state, player);
    if (requestShot(player, controls.shot, forward)) {
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
  if (player.air < 24 && state.eventTime <= 0 && underwater)
    announce(state, "Low air", 2);
};

const prepareAI = (state: Simulation, player: Player): void => {
  player.aimYaw = undefined;
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
      .addScaledVector(travel, carrying ? 2.4 : -0.34)
      .setY(FLOOR_HEIGHT);
    player.aimYaw = directionYaw(travel.x, travel.z);
    player.duty = "pressure";
    const distanceToGoal = 12.5 - puck.position.z * direction;
    const receiver = state.players
      .filter(
        (other: Player): boolean =>
          other.team === player.team &&
          other.id !== player.id &&
          other.mode === "playing" &&
          (other.position.z - puck.position.z) * direction > 0.5 &&
          other.position.y < FLOOR_HEIGHT + 0.2 &&
          other.position.distanceTo(puck.position) < 2.7,
      )
      .sort(
        (a: Player, b: Player): number =>
          b.position.z * direction - a.position.z * direction,
      )
      .at(0);
    if (distanceToGoal < 3.9 && player.cooldown <= 0)
      requestShot(
        player,
        clamp(distanceToGoal * 0.16, 0.18, 0.62),
        travel,
        0.04,
      );
    else if (
      receiver &&
      (player.air < 48 || (player.cooldown <= 0 && state.time % 2 < 0.2))
    ) {
      requestShot(
        player,
        clamp(
          0.35 + (receiver.position.distanceTo(puck.position) - 1) * 0.35,
          0.35,
          0.8,
        ),
        receiver.position
          .clone()
          .addScaledVector(receiver.velocity, 0.25)
          .sub(puck.position),
      );
    }
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
      .addScaledVector(forwardVector(angle), -0.34)
      .add(
        new Vector3(Math.cos(angle), 0, -Math.sin(angle)).multiplyScalar(0.16),
      )
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

const updateAI = (state: Simulation, player: Player, dt: number): void => {
  const profile = botProfiles[state.difficulty];
  const defending = defendingZone(state, player);
  const followThrough = followingAttack(state, player);
  const reserve = safeAirReserve(player);
  const airRotation = state.airRotations[player.team].find(
    (active): boolean =>
      active.incoming === player.id || active.outgoing === player.id,
  );
  const cycling = airRotation?.outgoing === player.id;
  if (
    (defending || followThrough) &&
    !player.emergency &&
    !cycling &&
    player.mode === "ascending" &&
    player.air > reserve + 10
  )
    player.mode = "diving";
  const nearSurface = player.position.y > SURFACE_HEIGHT - 0.065;
  if (
    player.mode === "playing" &&
    !followThrough &&
    (player.air <
      ((cycling && airRotation.phase === "handoff") ||
      airRotation?.incoming === player.id
        ? reserve
        : defending
          ? reserve
          : player.duty === "pressure"
            ? 30
            : 38) ||
      (!defending && !player.wantDown && player.air < 80))
  )
    player.mode = "ascending";
  if (nearSurface && player.mode === "ascending") player.mode = "recovering";
  if (
    player.mode === "recovering" &&
    player.air >= (defending ? 68 : 80) &&
    player.wantDown &&
    state.time >= player.cycleUntil
  )
    player.mode = "diving";
  if (player.position.y < FLOOR_HEIGHT + 0.05 && player.mode === "diving")
    player.mode = "playing";
  const pursuing =
    state.puck.controlOwner === undefined &&
    state.puck.shotOwner === undefined &&
    state.puckChasers[player.team] === player.id;
  const closePursuit =
    pursuing && player.position.distanceToSquared(state.puck.position) < 2.25;
  const grabbing = pursuing && canGrabPuck(state, player, -0.45);
  if (grabbing)
    player.grab = { elapsed: 0, target: state.puck.position.clone() };
  else if (player.grab) {
    player.grab.elapsed += dt;
    player.grab.target.copy(state.puck.position);
    if (
      !pursuing ||
      player.grab.elapsed > 0.55 ||
      !puckInGrabReach(state, player, -0.45)
    )
      player.grab = undefined;
  }
  protectGoalApproach(state, player);
  const travel = player.target.clone().sub(player.position).setY(0);
  const distance = travel.length();
  const resting = player.mode === "recovering" && distance < 0.7;
  player.sprint =
    canSprint(rulesFor(state), player) &&
    shouldSprintToPuck(state, player, distance);
  const speed = Math.min(
    distance * 2.0,
    player.sprint ? profile.sprintSpeed : 1.45,
  );
  const desired = travel.normalize().multiplyScalar(speed);
  yieldToPuckChaser(state, player, desired);
  steerThroughTraffic(state, player, desired);
  avoidBodies(player, state.players, desired);
  const desiredSpeed = desired.length();
  const arriving = distance < 0.07 && desiredSpeed < 0.2;
  const targetYaw = player.grab
    ? player.yaw
    : !arriving && desiredSpeed > 0.05
      ? directionYaw(desired.x, desired.z)
      : (player.aimYaw ?? player.yaw);
  const turnSpeed = profile.turnSpeed * (closePursuit ? 1.85 : 1.2);
  player.yaw += clamp(
    safeGoalTurn(player, desired, targetYaw),
    -turnSpeed * dt,
    turnSpeed * dt,
  );
  const forward = forwardVector(player.yaw);
  const alignment =
    desiredSpeed > 0.001 ? Math.max(0, desired.dot(forward) / desiredSpeed) : 0;
  const propulsion =
    arriving || player.grab ? 0 : desiredSpeed * alignment ** 2;
  const currentSpeed = Math.max(0, player.velocity.dot(forward));
  const blend = 1 - Math.exp(-profile.response * dt);
  const unsafeGoalHeading =
    nearOwnGoal(player) && forward.z * attackDirection(player.team) < 0;
  const forwardSpeed = unsafeGoalHeading
    ? 0
    : currentSpeed + (propulsion - currentSpeed) * blend;
  player.velocity.x = forward.x * forwardSpeed;
  player.velocity.z = forward.z * forwardSpeed;
  player.kick = resting ? 0.1 : Math.min(1.5, forwardSpeed / 1.4);
  const targetY =
    player.mode === "ascending" || player.mode === "recovering"
      ? SURFACE_HEIGHT
      : FLOOR_HEIGHT;
  player.velocity.y +=
    ((targetY - player.position.y) * 2.2 - player.velocity.y) *
    (1 - Math.exp(-4 * dt));
  player.curl = 0;
  const relative = state.puck.position
    .clone()
    .sub(player.position)
    .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
  const nearby =
    !teamPuckCarrier(state, player.team) &&
    (state.mode !== "match" || state.puckChasers[player.team] === player.id) &&
    relative.z < -0.3 &&
    relative.z > -1.55 &&
    Math.abs(relative.x) < 0.9;
  const targetOffset = new Vector3(
    nearby ? clamp(relative.x, -0.42, 0.42) : handSide(player) * 0.13,
    nearby ? clamp(state.puck.position.y - PUCK_HEIGHT, 0, 0.7) : 0,
    nearby ? clamp(relative.z + 0.065, -0.68, -0.36) : -STICK_REACH,
  );
  if (state.puck.controlOwner === player.id) {
    targetOffset.set(
      handSide(player) * 0.13 + player.dummy * 0.2,
      0,
      -STICK_REACH,
    );
  }
  if (player.grab) {
    const seat = puckSeat(player).sub(player.stick);
    targetOffset
      .copy(player.grab.target)
      .sub(seat)
      .sub(player.position)
      .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw)
      .setY(0);
  }
  player.stickOffset.lerp(targetOffset, 1 - Math.exp(-24 * dt));
  updateCradle(state, player, dt);
};

const updateAir = (state: Simulation, player: Player, dt: number): void => {
  const rules = rulesFor(state);
  const atSurface = player.position.y >= SURFACE_HEIGHT - 0.045;
  if (atSurface) {
    player.air = clamp(
      player.air +
        (dt * (rules.airBase + rules.airStamina * staminaFraction(player))) /
          rules.airSupply,
      0,
      100,
    );
    if (player.mode !== "diving") player.mode = "recovering";
    if (player.emergency && player.air >= 80) {
      player.emergency = false;
      if (player.human) announce(state, "Ready", 2);
    }
  } else {
    const engaged =
      player.handling ||
      player.curl !== 0 ||
      player.shotTime > 0 ||
      player.cooldown > 0 ||
      state.puck.controlOwner === player.id ||
      (state.puck.lastTouch === player.id &&
        state.time - state.puck.touchTime < 1.2);
    const air = rules.airDrain;
    const drain = engaged
      ? air.engaged +
        (player.sprint ? air.engagedSprint : 0) +
        Math.abs(player.curl) * air.curl
      : player.sprint
        ? air.sprint
        : air.idle + Math.min(1, player.kick) * air.kick;
    player.air = Math.max(
      0,
      player.air -
        (dt * (drain + (1 - staminaFraction(player)) * rules.spentAirDrain)) /
          (0.75 * rules.airSupply),
    );
    if (player.air <= 0 && !player.emergency) {
      player.emergency = true;
      player.mode = "ascending";
      if (player.human) announce(state, "Surfacing", 3);
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
  if (canCarryPuck(state, player) && player.puckMove?.phase !== "approach") {
    state.puck.controlOwner = player.id;
    state.puck.controlKind = player.puckMove?.kind ?? "carry";
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
    .multiplyScalar(2.2 + player.shotPower * 2.8)
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

const beginPuckMove = (
  state: Simulation,
  player: Player,
  kind: PuckMoveKind,
  returning = false,
): void => {
  player.puckMove = {
    kind,
    phase: "approach",
    elapsed: 0,
    yaw: player.yaw,
    startOffset: player.stickOffset.clone(),
    origin: state.puck.position.clone(),
    end: state.puck.position.clone(),
    holdOffset: new Vector3(),
    returning,
  };
  if (state.puck.controlOwner === player.id) releaseControl(state);
};

const endPuckMove = (state: Simulation, player: Player): void => {
  player.puckMove = undefined;
  player.puckMoveCooldown = 0.12;
  if (state.puck.controlOwner !== player.id) return;
  if (canCarryPuck(state, player)) state.puck.controlKind = "carry";
  else releaseControl(state);
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

const resolvePuckMoves = (state: Simulation, dt: number): void => {
  for (const player of state.players) {
    const move = player.puckMove;
    if (!move) continue;
    const puck = state.puck;
    if (move.phase === "approach") {
      if (move.elapsed < 0.15) continue;
      if (puckSeat(player).setY(PUCK_HEIGHT).distanceTo(puck.position) > 0.06) {
        if (move.elapsed > 0.65) endPuckMove(state, player);
        continue;
      }
      move.phase = "stroke";
      move.elapsed = 0;
      move.origin.copy(puck.position);
      move.end.copy(
        move.kind === "push"
          ? frontPuckPosition(player)
          : puck.position
              .clone()
              .addScaledVector(forwardVector(player.yaw), -0.2),
      );
      const localEnd = move.end
        .clone()
        .sub(player.position)
        .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
      localEnd.z = Math.min(-0.3, localEnd.z);
      move.end
        .copy(
          localEnd
            .applyAxisAngle(new Vector3(0, 1, 0), player.yaw)
            .add(player.position),
        )
        .setY(PUCK_HEIGHT);
      if (canCarryPuck(state, player)) recordTouch(state, player);
    }
    if (puck.controlOwner === player.id) moveControlledPuck(state, player, dt);
    if (move.phase === "stroke" && move.elapsed >= 0.3) {
      move.phase = "hold";
      move.holdOffset
        .copy(puck.position)
        .sub(player.position)
        .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
      if (move.returning) {
        endPuckMove(state, player);
        continue;
      }
    }
    if (move.phase === "hold" && !player.puckWorkHeld) {
      if (move.kind === "pull" && puckInMoveReach(state, player))
        beginPuckMove(state, player, "push", true);
      else endPuckMove(state, player);
    }
  }
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
  if (owner?.puckMove) return;
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
        !player.puckMove &&
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
    player.puckMove?.phase === "approach" ||
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
    );
    Object.assign(player, initial);
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
    state.mode === "match" ? { phase: "ready", remaining: 3 } : undefined;
  state.decisionTime = 0;
  syncInterpolation(state);
  announce(state, "3", 3);
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
  human.shotTime = 0;
  human.shotOrigin = undefined;
  human.shotFired = false;
  human.cooldown = 0;
  human.knockdownTime = 0;
  human.knockdownCooldown = 0;
  human.puckMove = undefined;
  human.puckMoveCooldown = 0;
  human.puckWorkHeld = false;
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
  for (const player of state.players) {
    const direction = attackDirection(player.team);
    const lead = state.players.find(
      (other: Player): boolean =>
        other.team === player.team && other.slot === 0,
    );
    if (!lead) continue;
    player.wantDown = true;
    if (player.slot === 0) {
      state.puckChasers[player.team] = player.id;
      player.role = "Striker";
      player.duty = "pressure";
      player.target.set(-direction * 0.25, FLOOR_HEIGHT, -direction * 0.34);
      player.aimYaw = directionYaw(-player.position.x, -player.position.z);
    }
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
  announce(state, String(Math.ceil(faceoff.remaining)), 1);
  for (const player of state.players) {
    player.role = player.slot === 0 ? "Striker · at the wall" : "At the wall";
    player.air = 100;
    player.stamina = MAX_STAMINA;
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
    for (const player of state.players) {
      player.wallReady = false;
      player.mode = "diving";
      player.velocity
        .copy(forwardVector(player.yaw))
        .multiplyScalar(
          player.human ? 1.7 : botProfiles[state.difficulty].sprintSpeed,
        )
        .setY(-0.6);
      player.sprint = !player.human;
    }
    announce(state, "Go!", 1);
    planStrike(state);
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
      planTeam(state, 0);
      planTeam(state, 1);
      coordinatePuckPursuit(state, 0);
      coordinatePuckPursuit(state, 1);
      for (const player of state.players)
        if (!player.human) prepareAI(state, player);
    }
    state.decisionTime = botProfiles[state.difficulty].decisionPeriod;
  }
  for (const player of state.players) {
    player.previous.copy(player.position);
    player.previousYaw = player.yaw;
    player.previousBodyPitch = player.bodyPitch;
    if (player.human)
      updateHuman(state, player, playerControls(controls, player.id), dt);
    else updateAI(state, player, dt);
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.knockdownCooldown = Math.max(0, player.knockdownCooldown - dt);
    player.puckMoveCooldown = Math.max(0, player.puckMoveCooldown - dt);
    player.knockdownTime = Math.max(0, player.knockdownTime - dt);
    player.shotTime = Math.max(0, player.shotTime - dt);
    if (state.mode !== "playground") {
      updateStamina(rulesFor(state), player, dt);
      updateAir(state, player, dt);
    }
    updatePlayerMotion(player, dt);
  }
  resolveBodies(state.players, dt, false);
  resolveBodies(state.players, dt, false);
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
    resolvePuckMoves(state, dt);
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
    player.puckMove ||
    !canCarryPuck(state, player) ||
    player.stick.distanceTo(state.puck.position) > 0.8
  )
    return false;
  moveControlledPuck(state, player, dt);
  return true;
};
