import { Vector3 } from "three";
import { bladePoint, puckSeat, smoothMotion } from "./stick";
import {
  CAMERA_OFFSET,
  type Controls,
  clamp,
  FLOOR_HEIGHT,
  handSide,
  type Player,
  PUCK_RADIUS,
  type PuckMoveKind,
  type Simulation,
  STICK_EDGE,
  STICK_REACH,
} from "./types";

export const KNOCKDOWN_DURATION = 0.48;
export const KNOCKDOWN_HIT_TIME = 0.12;

export const puckInKnockdownBox = (
  state: Simulation,
  player: Player,
): boolean => {
  const local = state.puck.position
    .clone()
    .sub(player.position)
    .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
  return (
    state.puck.position.y > 0.12 &&
    Math.abs(local.x) < 0.48 &&
    local.z < -0.28 &&
    local.z > -1.25 &&
    local.y > -0.21 &&
    local.y < 0.8
  );
};

export const canKnockdown = (state: Simulation, player: Player): boolean =>
  state.restartTime === 0 &&
  !state.finished &&
  !player.wallReady &&
  !player.emergency &&
  player.shotTime <= 0 &&
  player.knockdownTime <= 0 &&
  player.knockdownCooldown <= 0 &&
  player.puckMove === undefined &&
  puckInKnockdownBox(state, player);

export const puckInGrabReach = (
  state: Simulation,
  player: Player,
  pitch: number,
): boolean => {
  const local = state.puck.position
    .clone()
    .sub(player.position)
    .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
  const sightline = local.clone().sub(CAMERA_OFFSET).normalize();
  const look = new Vector3(0, Math.sin(pitch), -Math.cos(pitch));
  const beneathChest = Math.hypot(local.x / 0.36, (local.z + 0.08) / 0.36) <= 1;
  const inFront =
    local.z < -0.18 &&
    local.z > -0.98 &&
    Math.abs(local.x) < 0.7 &&
    Math.hypot(local.x - 0.13 * handSide(player), local.z + STICK_REACH) <
      0.52 &&
    sightline.dot(look) > 0.6;
  return (
    player.position.y <= FLOOR_HEIGHT + 0.06 &&
    Math.abs(player.bodyPitch) < 0.18 &&
    state.puck.position.y < 0.06 &&
    (beneathChest || inFront)
  );
};

export const canGrabPuck = (
  state: Simulation,
  player: Player,
  pitch: number,
): boolean =>
  !player.wallReady &&
  !player.emergency &&
  player.mode !== "ascending" &&
  player.mode !== "recovering" &&
  !player.grab &&
  !player.charging &&
  player.shotTime <= 0 &&
  player.cooldown <= 0 &&
  player.knockdownTime <= 0 &&
  player.knockdownCooldown <= 0 &&
  !player.puckMove &&
  player.curl === 0 &&
  player.dummy === 0 &&
  state.puck.controlOwner === undefined &&
  state.puck.shotOwner === undefined &&
  state.time >= player.curlBlockedUntil &&
  puckInGrabReach(state, player, pitch);

export const puckReaction = (
  state: Simulation,
  player: Player,
  pitch: number,
): "grab" | "knockdown" | undefined =>
  canKnockdown(state, player)
    ? "knockdown"
    : canGrabPuck(state, player, pitch)
      ? "grab"
      : undefined;

export const puckInMoveReach = (state: Simulation, player: Player): boolean => {
  const local = state.puck.position
    .clone()
    .sub(player.position)
    .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
  return (
    !player.wallReady &&
    !player.emergency &&
    player.position.y < 0.42 &&
    player.mode !== "ascending" &&
    state.puck.position.y < 0.09 &&
    Math.abs(local.x) < 0.42 &&
    local.z > -1.25 &&
    local.z < -0.22
  );
};

export const availablePuckMove = (
  state: Simulation,
  player: Player,
): PuckMoveKind | undefined => {
  if (
    !puckInMoveReach(state, player) ||
    player.puckMove ||
    player.puckMoveCooldown > 0 ||
    player.shotTime > 0 ||
    player.cooldown > 0 ||
    player.knockdownTime > 0 ||
    player.curl !== 0 ||
    player.dummy !== 0 ||
    state.puck.shotOwner !== undefined ||
    state.time < player.curlBlockedUntil
  )
    return undefined;
  const relative = state.puck.position
    .clone()
    .sub(puckSeat(player))
    .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw);
  return relative.z > 0.045 ? "push" : "pull";
};

const bladeChallengesPuck = (state: Simulation, player: Player): boolean => {
  const puck = state.puck.position;
  if (
    Math.abs(player.stick.y - puck.y) > 0.08 ||
    player.stick.distanceToSquared(puck) > 0.25
  )
    return false;
  return STICK_EDGE.slice(0, -1).some((start, index): boolean => {
    const end = STICK_EDGE.at(index + 1);
    if (!end) return false;
    const a = bladePoint(player, new Vector3(start[0], 0, start[1]));
    const edge = bladePoint(player, new Vector3(end[0], 0, end[1])).sub(a);
    const fraction = clamp(
      puck.clone().sub(a).dot(edge) / edge.lengthSq(),
      0,
      1,
    );
    return (
      a.addScaledVector(edge, fraction).distanceToSquared(puck) <
      (PUCK_RADIUS + 0.04) ** 2
    );
  });
};

export const isPuckContested = (state: Simulation, player: Player): boolean =>
  state.players.some(
    (other: Player): boolean =>
      other.team !== player.team &&
      !other.emergency &&
      other.mode !== "ascending" &&
      other.mode !== "recovering" &&
      other.position.y < 0.85 &&
      bladeChallengesPuck(state, other),
  );

export const frontPuckPosition = (player: Player): Vector3 =>
  puckSeat(player)
    .sub(player.stick)
    .add(
      new Vector3(0.13 * handSide(player), 0, -STICK_REACH).applyAxisAngle(
        new Vector3(0, 1, 0),
        player.yaw,
      ),
    )
    .add(player.position)
    .setY(0.018);

export const puckMoveOffset = (
  state: Simulation,
  player: Player,
  rest: Vector3,
): Vector3 => {
  const move = player.puckMove;
  if (!move) return rest;
  const target =
    move.phase === "approach"
      ? state.puck.position.clone()
      : move.phase === "hold"
        ? move.holdOffset
            .clone()
            .applyAxisAngle(new Vector3(0, 1, 0), player.yaw)
            .add(player.position)
        : move.origin.clone().lerp(move.end, smoothMotion(move.elapsed / 0.22));
  const seatOffset = puckSeat(player).sub(player.stick);
  const contactOffset = target
    .sub(seatOffset)
    .sub(player.position)
    .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw)
    .setY(0);
  if (move.phase !== "approach") return contactOffset;
  const progress = clamp(move.elapsed / 0.15, 0, 1);
  const offset = move.startOffset
    .clone()
    .lerp(contactOffset, smoothMotion(progress));
  offset.x += Math.sin(progress * Math.PI) * 0.22 * handSide(player);
  offset.y = 0;
  return offset;
};

export const pollMovement = (controls: Controls, keys: Set<string>): void => {
  controls.pushPull = keys.has("KeyZ");
  const sideways = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
  controls.forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  controls.lateral = sideways;
  controls.dummy = controls.dummyMode ? sideways : 0;
  controls.vertical =
    Number(keys.has("Space")) -
    Number(keys.has("ControlLeft") || keys.has("ControlRight"));
  controls.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
  controls.curl = Number(keys.has("KeyE")) - Number(keys.has("KeyQ"));
};

export const handlingLabel = (state: Simulation, player: Player): string => {
  if (player.grab) return "GRAB PUCK";
  if (player.charging) return "CHARGING SHOT";
  if (player.knockdownTime > 0) return "KNOCKDOWN";
  if (player.puckMove)
    return player.puckMove.kind === "push" ? "PUSH FORWARD" : "PULL & HOLD";
  if (player.curl !== 0)
    return player.curl > 0 ? "REGULAR CURL" : "REVERSE CURL";
  if (player.dummy !== 0)
    return player.dummy < 0 ? "DUMMY LEFT" : "DUMMY RIGHT";
  if (state.puck.controlOwner === player.id) return "PUCK CONTROL";
  if (puckInMoveReach(state, player) && isPuckContested(state, player))
    return "CONTESTED";
  return player.backhand ? "BACKHAND" : "FOREHAND";
};
