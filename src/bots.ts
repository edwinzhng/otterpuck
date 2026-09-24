import { Vector3 } from "three";
import { positionSide, strongPositionSide } from "./formation-layout";
import { formationPositions, playerPosition } from "./positions";
import {
  type Attributes,
  attackDirection,
  type BotDifficulty,
  clamp,
  type Player,
  type PursuitWeights,
  type Simulation,
  type Team,
} from "./types";
import { airEngaged, underwaterAirUse } from "./vitals";

// Difficulty changes decisions and effort, never the movement rules. Bots send
// player controls, so speeds and turns stay within the player limits.
// `sprintSpeed` is the top speed a bot asks for, at most the player sprint.
// `turnSpeed` is the fastest turn it asks for, in radians per second.
export const botProfiles = {
  easy: {
    sprintSpeed: 2.15,
    chaseDistance: 2.5,
    turnSpeed: 2.1,
    anticipation: 0.1,
    decisionPeriod: 0.22,
    aim: 0.3,
  },
  medium: {
    sprintSpeed: 2.5,
    chaseDistance: 1.7,
    turnSpeed: 2.7,
    anticipation: 0.18,
    decisionPeriod: 0.14,
    aim: 0.18,
  },
  hard: {
    sprintSpeed: 2.75,
    chaseDistance: 1.1,
    turnSpeed: 3.3,
    anticipation: 0.26,
    decisionPeriod: 0.1,
    aim: 0.12,
  },
  elite: {
    sprintSpeed: 2.9,
    chaseDistance: 0.75,
    turnSpeed: 3.8,
    anticipation: 0.34,
    decisionPeriod: 0.075,
    aim: 0.1,
  },
} as const satisfies Record<
  BotDifficulty,
  {
    sprintSpeed: number;
    chaseDistance: number;
    turnSpeed: number;
    anticipation: number;
    decisionPeriod: number;
    // Heading error a bot accepts before it shoots, in radians.
    aim: number;
  }
>;

// Bots spend more build points at higher difficulty. A player has 10.
export const BOT_POINTS = {
  easy: 7,
  medium: 9,
  hard: 11,
  elite: 13,
} as const satisfies Record<BotDifficulty, number>;

export type PositionRole = "forward" | "middle" | "back";
export type RoleBuilds = Record<PositionRole, Attributes>;

type Build = [strength: number, technique: number, fitness: number];
const byRole = (forward: Build, middle: Build, back: Build): RoleBuilds => {
  const build = ([strength, technique, fitness]: Build): Attributes => ({
    strength,
    technique,
    fitness,
  });
  return { forward: build(forward), middle: build(middle), back: build(back) };
};

// Found with `bun run tune:builds` and confirmed head to head. Strength is
// maxed first. Forwards then gain most from fitness, which keeps them down
// through an attack, and backs from technique, which wins the puck back.
export const botBuilds: Record<BotDifficulty, RoleBuilds> = {
  easy: byRole([5, 1, 1], [5, 1, 1], [5, 1, 1]),
  medium: byRole([5, 1, 3], [5, 2, 2], [5, 3, 1]),
  hard: byRole([5, 1, 5], [5, 4, 2], [5, 5, 1]),
  elite: byRole([5, 3, 5], [5, 5, 3], [5, 5, 3]),
};

export const positionRole = (code: string): PositionRole =>
  code.includes("F") ? "forward" : code.includes("B") ? "back" : "middle";

// Gives every bot the build for its difficulty and position. A team entry in
// `builds` replaces the shipped builds, so trials can play builds head to head.
export const applyBotBuilds = (
  state: Simulation,
  builds?: readonly [RoleBuilds, RoleBuilds],
): void => {
  for (const player of state.players) {
    if (player.human) continue;
    const table = builds?.[player.team] ?? botBuilds[state.difficulty];
    player.attributes = {
      ...table[positionRole(playerPosition(state, player).code)],
    };
  }
};

export const pursuitWeights = {
  forwardBehindPuck: 0.242,
  forwardAheadOfPuck: 1.333,
  acrossCourt: 2.872,
  keeper: 1.324,
  pressureDuty: -0.222,
  followingAttack: -0.624,
  depth: 1.059,
  // Bot trials carry no human player, so `bun run tune` cannot measure this
  // weight. Change it from play, not from a tuning run.
  humanNear: -0.357,
  coveringRotation: 4.14,
  outgoingRotation: 7.588,
  // Hysteresis keeps the current chaser until a rival is clearly closer. It
  // stops two players from swapping the chase every decision tick.
  hysteresis: 0.338,
} as const satisfies PursuitWeights;

export const defendingZone = (state: Simulation, player: Player): boolean => {
  if (state.faceoff?.phase === "strike") return true;
  const code =
    formationPositions[state.formations[player.team]].at(player.slot) ?? "C";
  const exit = code.includes("B") ? -1 : code.includes("F") ? 5 : 2;
  return state.puck.position.z * attackDirection(player.team) <= exit;
};

// Horizontal distance a player covers while it dives from the surface to the
// floor at swim speed, in meters.
const DIVE_REACH = 1.8;
// A loose or carried puck this close needs the player on the floor now, in
// meters.
const SURFACE_THREAT = 3.5;

// Swimming along the surface is as fast as swimming on the floor, and it
// refills air instead of spending it. At a swimoff only the forwards race
// straight down. The rest travel on top and dive once the dive itself covers
// the rest of the way, or once the puck comes near.
export const approachAtSurface = (
  state: Simulation,
  player: Player,
): boolean => {
  if (
    state.faceoff?.phase !== "strike" ||
    player.emergency ||
    state.puckChasers[player.team] === player.id ||
    positionRole(playerPosition(state, player).code) === "forward"
  )
    return false;
  const flat = (a: Vector3, b: Vector3): number =>
    Math.hypot(a.x - b.x, a.z - b.z);
  return (
    flat(player.position, player.target) > DIVE_REACH &&
    flat(player.position, state.puck.position) > SURFACE_THREAT
  );
};

// How many of a team may be off the floor at once for a top up. A player at or
// below its safe reserve still surfaces, so this never risks a drowning.
export const surfacingQuota = (size: number): number =>
  Math.max(1, Math.round(size / 3));

export const teammatesAway = (state: Simulation, player: Player): number =>
  state.players.filter(
    (other): boolean =>
      other.team === player.team &&
      other.id !== player.id &&
      (other.mode === "ascending" || other.mode === "recovering"),
  ).length;

// A player still counts as playing the puck for a moment after it lets go,
// and uses air faster on the way up. This covers that extra air, in percent.
const HANDLING_ASCENT_AIR = 6;

export const safeAirReserve = (state: Simulation, player: Player): number =>
  (9 +
    Math.max(0, 2.31 - player.position.y) * 3 +
    (airEngaged(state, player) ? HANDLING_ASCENT_AIR : 0)) *
  state.tactics[player.team].airBudget;

// Seconds of play a player has left before it must head up for air. It
// counts the air above the safe reserve at the rate the player would use it,
// on the puck or off it. A player on the way up or at the surface has none.
export const airSeconds = (
  state: Simulation,
  player: Player,
  engaged: boolean,
): number =>
  player.emergency ||
  player.mode === "ascending" ||
  player.mode === "recovering"
    ? 0
    : Math.max(0, player.air - safeAirReserve(state, player)) /
      underwaterAirUse(state, player, engaged, 1);

export const followingAttack = (state: Simulation, player: Player): boolean =>
  !player.emergency &&
  player.air > safeAirReserve(state, player) + 8 &&
  player.position.y < 0.8 &&
  (state.puck.controlOwner === player.id ||
    state.puck.shotOwner === player.id ||
    (state.puck.lastTouch === player.id &&
      state.time - state.puck.touchTime < 3 &&
      player.position.distanceToSquared(state.puck.position) < 25));

export const teamPuckCarrier = (
  state: Simulation,
  team: Team,
): Player | undefined => {
  const owner = state.puck.controlOwner ?? state.puck.shotOwner;
  if (owner !== undefined)
    return state.players.find(
      (player): boolean => player.id === owner && player.team === team,
    );
  return state.players.find(
    (player): boolean =>
      player.team === team &&
      player.id === state.puck.lastTouch &&
      !player.emergency &&
      player.mode === "playing" &&
      state.time - state.puck.touchTime < 0.35 &&
      player.cooldown <= 0 &&
      state.puck.position.y < 0.09 &&
      player.position.distanceToSquared(state.puck.position) < 0.81,
  );
};

// Speed a chaser closes on the puck, in meters per second, and the air it
// should still have when it gets there, in seconds.
const CHASE_SPEED = 2;
const CHASE_SPARE_SECONDS = 3;

export const coordinatePuckPursuit = (state: Simulation, team: Team): void => {
  const carrier = teamPuckCarrier(state, team);
  if (carrier) {
    state.puckChasers[team] = carrier.id;
    return;
  }
  const available = state.players.filter(
    (player): boolean =>
      player.team === team &&
      !player.emergency &&
      player.wantDown &&
      player.mode !== "ascending" &&
      player.mode !== "recovering" &&
      player.air > safeAirReserve(state, player),
  );
  const weights = state.pursuit[team];
  const cost = (player: Player): number => {
    const horizontal = Math.hypot(
      player.position.x - state.puck.position.x,
      player.position.z - state.puck.position.z,
    );
    const code = playerPosition(state, player).code;
    const side = positionSide(code);
    const strong = strongPositionSide(state, team);
    const localPuck = state.puck.position.x * -attackDirection(team);
    const acrossCourt =
      side !== 0 && Math.abs(localPuck) > 1.4 && side !== strong;
    const behindPuck =
      (player.position.z - state.puck.position.z) * attackDirection(team) <
      0.25;
    const closeContact = horizontal < 0.85 && player.position.y < 0.65;
    const rotation = state.airRotations[team].find(
      (active): boolean =>
        active.incoming === player.id || active.outgoing === player.id,
    );
    const covering = rotation?.incoming === player.id;
    const keeper =
      code === "B" ||
      (code.includes("B") &&
        (state.formations[team] !== "3-3" || side === -strong));
    const roleCost = closeContact
      ? 0
      : (code.includes("F")
          ? behindPuck
            ? weights.forwardBehindPuck
            : weights.forwardAheadOfPuck
          : 0) +
        (acrossCourt ? weights.acrossCourt : 0) +
        (keeper ? weights.keeper : 0) +
        (player.duty === "pressure" ? weights.pressureDuty : 0);
    // A chaser that would arrive with little air left would have to leave
    // the puck again. Each missing second counts as a meter of distance.
    const spare = airSeconds(state, player, true) - horizontal / CHASE_SPEED;
    const shortOfAir = Math.max(0, CHASE_SPARE_SECONDS - spare);
    return (
      horizontal +
      shortOfAir +
      (followingAttack(state, player) ? weights.followingAttack : 0) +
      Math.max(0, player.position.y - 0.4) * weights.depth +
      (player.human && horizontal < 1 ? weights.humanNear : 0) +
      roleCost +
      (covering &&
      (rotation.phase === "handoff" ||
        player.target.distanceTo(state.puck.position) > 1.5)
        ? weights.coveringRotation
        : 0) +
      (rotation?.outgoing === player.id && rotation.phase !== "handoff"
        ? weights.outgoingRotation
        : 0)
    );
  };
  const best = available.reduce<Player | undefined>(
    (closest, player): Player =>
      !closest || cost(player) < cost(closest) ? player : closest,
    undefined,
  );
  const previous = available.find(
    (player): boolean => player.id === state.puckChasers[team],
  );
  state.puckChasers[team] =
    previous && best && cost(previous) <= cost(best) + weights.hysteresis
      ? previous.id
      : best?.id;
};

export const yieldToPuckChaser = (
  state: Simulation,
  player: Player,
  desired: Vector3,
): void => {
  const leader =
    teamPuckCarrier(state, player.team) ??
    state.players.find(
      (other): boolean => other.id === state.puckChasers[player.team],
    );
  if (
    !leader ||
    leader === player ||
    Math.abs(leader.position.y - player.position.y) > 0.55
  )
    return;
  const away = player.position.clone().sub(leader.position).setY(0);
  const distance = away.length();
  if (distance >= 0.95) return;
  if (distance < 0.001) away.set(player.slot % 2 === 0 ? 1 : -1, 0, 0);
  away.normalize();
  const maximumSpeed = Math.max(1.2, desired.length());
  const inward = desired.dot(away);
  if (inward < 0) desired.addScaledVector(away, -inward);
  desired
    .addScaledVector(away, clamp((0.95 - distance) / 0.3, 0, 1) * 1.2)
    .clampLength(0, maximumSpeed);
};

export const steerThroughTraffic = (
  state: Simulation,
  player: Player,
  desired: Vector3,
): void => {
  player.dummy = 0;
  player.lateral = 0;
  const speed = desired.length();
  if (
    speed < 0.08 ||
    player.mode === "ascending" ||
    player.mode === "recovering"
  )
    return;
  const forward = desired.clone().divideScalar(speed);
  const right = new Vector3(-forward.z, 0, forward.x);
  const engaging =
    player.duty === "pressure" || state.puck.controlOwner === player.id;
  const obstacles = state.players.filter(
    (other): boolean =>
      other !== player &&
      Math.abs(other.position.y - player.position.y) < 0.55 &&
      other.position.distanceToSquared(player.position) < 6.25,
  );
  const blocked = obstacles.some((other): boolean => {
    const offset = other.position.clone().sub(player.position).setY(0);
    const ahead = offset.dot(forward);
    return ahead > 0.04 && ahead < 1.4 && Math.abs(offset.dot(right)) < 0.62;
  });
  if (blocked && state.time >= player.evadeUntil) {
    const laneCost = (side: number): number => {
      const probe = player.position
        .clone()
        .addScaledVector(forward, 0.7)
        .addScaledVector(right, side * 0.8);
      const wall =
        Math.abs(probe.x) > 6.95 || Math.abs(probe.z) > 11.95 ? 30 : 0;
      return (
        wall +
        obstacles.reduce(
          (cost, other): number =>
            cost + 1 / Math.max(0.08, probe.distanceToSquared(other.position)),
          0,
        )
      );
    };
    player.evadeSide = laneCost(-1) + 0.15 < laneCost(1) ? -1 : 1;
    player.evadeTarget
      .copy(player.position)
      .addScaledVector(forward, 0.7)
      .addScaledVector(right, player.evadeSide * 1.05);
    player.evadeTarget.x = clamp(player.evadeTarget.x, -6.95, 6.95);
    player.evadeTarget.z = clamp(player.evadeTarget.z, -11.95, 11.95);
    player.evadeUntil =
      state.time + (engaging ? 0.85 : clamp(1.25 / speed + 0.3, 0.7, 1.5));
  }
  if (state.time >= player.evadeUntil) return;
  const detour = player.evadeTarget.clone().sub(player.position).setY(0);
  if (detour.lengthSq() < 0.04) {
    player.evadeUntil = state.time;
    return;
  }
  const strength = Math.min(1, (player.evadeUntil - state.time) / 0.25);
  if (engaging && state.puck.controlOwner !== player.id)
    desired
      .addScaledVector(right, player.evadeSide * speed * 0.95 * strength)
      .setLength(speed);
  else desired.copy(detour).setLength(speed);
  player.lateral = player.evadeSide * strength * 0.65;
  if (state.puck.controlOwner === player.id && player.shotTime <= 0)
    player.dummy = player.evadeSide * strength;
};

// A swimmer on its way up sidesteps any body above it within this reach, in
// meters. Pushing straight up into it would stall the ascent.
const ASCENT_CLEARANCE = 0.85;
const ASCENT_LOOKAHEAD = 1.4;
const ASCENT_SIDESTEP = 1.3;

export const clearAscent = (
  state: Simulation,
  player: Player,
  desired: Vector3,
): void => {
  if (player.mode !== "ascending") return;
  const sidestep = new Vector3();
  for (const other of state.players) {
    const above = other.position.y - player.position.y;
    if (other === player || above <= 0 || above > ASCENT_LOOKAHEAD) continue;
    const away = player.position.clone().sub(other.position).setY(0);
    const distance = away.length();
    if (distance > ASCENT_CLEARANCE) continue;
    if (distance < 0.001) away.set(player.slot % 2 === 0 ? 1 : -1, 0, 0);
    sidestep.addScaledVector(
      away.normalize(),
      (ASCENT_CLEARANCE - distance) / ASCENT_CLEARANCE,
    );
  }
  if (sidestep.lengthSq() < 0.0001) return;
  desired.copy(sidestep.setLength(ASCENT_SIDESTEP));
};

export const shouldSprintToPuck = (
  state: Simulation,
  player: Player,
  distance: number,
): boolean => {
  if (
    player.mode === "ascending" ||
    player.mode === "recovering" ||
    player.air < safeAirReserve(state, player) + 10
  )
    return false;
  // Only the striker races the swimoff. The rest keep stamina for the play.
  if (state.faceoff?.phase === "strike")
    return state.puckChasers[player.team] === player.id;
  const profile = botProfiles[state.difficulty];
  const pursuit =
    player.duty === "pressure" ||
    state.puckChasers[player.team] === player.id ||
    state.puck.controlOwner === player.id;
  return (
    player.wantDown &&
    distance > (pursuit ? profile.chaseDistance : 1.8) &&
    player.air > (pursuit ? 32 : 48)
  );
};
