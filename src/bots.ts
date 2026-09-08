import { Vector3 } from "three";
import { positionSide, strongPositionSide } from "./formation-layout";
import { formationPositions, playerPosition } from "./positions";
import {
  attackDirection,
  type BotDifficulty,
  clamp,
  type Player,
  type Simulation,
  type Team,
} from "./types";

export const botProfiles = {
  easy: {
    sprintSpeed: 2.15,
    chaseDistance: 2.5,
    turnSpeed: 2.1,
    anticipation: 0.1,
    decisionPeriod: 0.22,
    response: 4,
  },
  medium: {
    sprintSpeed: 2.5,
    chaseDistance: 1.7,
    turnSpeed: 2.7,
    anticipation: 0.18,
    decisionPeriod: 0.14,
    response: 5,
  },
  hard: {
    sprintSpeed: 2.75,
    chaseDistance: 1.1,
    turnSpeed: 3.3,
    anticipation: 0.26,
    decisionPeriod: 0.1,
    response: 6,
  },
  elite: {
    sprintSpeed: 2.9,
    chaseDistance: 0.75,
    turnSpeed: 3.8,
    anticipation: 0.34,
    decisionPeriod: 0.075,
    response: 7,
  },
} as const satisfies Record<
  BotDifficulty,
  {
    sprintSpeed: number;
    chaseDistance: number;
    turnSpeed: number;
    anticipation: number;
    decisionPeriod: number;
    response: number;
  }
>;

export const defendingZone = (state: Simulation, player: Player): boolean => {
  if (state.faceoff?.phase === "strike") return true;
  const code =
    formationPositions[state.formations[player.team]].at(player.slot) ?? "C";
  const exit = code.includes("B") ? -1 : code.includes("F") ? 5 : 2;
  return state.puck.position.z * attackDirection(player.team) <= exit;
};

export const safeAirReserve = (player: Player): number =>
  12 + Math.max(0, 2.31 - player.position.y) * 3;

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
      player.air > safeAirReserve(player),
  );
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
      : (code.includes("F") ? (behindPuck ? 0.4 : 1.3) : 0) +
        (acrossCourt ? 2.2 : 0) +
        (keeper ? 2.3 : 0) +
        (player.duty === "pressure" ? -0.35 : 0);
    return (
      horizontal +
      Math.max(0, player.position.y - 0.4) * 1.5 -
      (player.human && horizontal < 1 ? 0.4 : 0) +
      roleCost +
      (covering &&
      (rotation.phase === "handoff" ||
        player.target.distanceTo(state.puck.position) > 1.5)
        ? 5
        : 0) +
      (rotation?.outgoing === player.id && rotation.phase !== "handoff"
        ? 20
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
    previous && best && cost(previous) <= cost(best) + 0.55
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

export const shouldSprintToPuck = (
  state: Simulation,
  player: Player,
  distance: number,
): boolean => {
  if (
    player.mode === "ascending" ||
    player.mode === "recovering" ||
    player.air < safeAirReserve(player) + 10
  )
    return false;
  if (state.faceoff?.phase === "strike") return true;
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
