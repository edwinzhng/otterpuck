import { Vector3 } from "three";
import { RULESETS } from "./rules";
import { puckProtection } from "./shielding";
import { bladePoint } from "./stick";
import {
  CAMERA_OFFSET,
  type Controls,
  clamp,
  FLOOR_HEIGHT,
  handSide,
  type Player,
  PUCK_RADIUS,
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

const CHALLENGE_REACH = PUCK_RADIUS + 0.04;
const MOST_SHIELDED = 0.42;
const SEALED = 0.88;

const bladeChallengesPuck = (
  state: Simulation,
  player: Player,
  reach: number,
): boolean => {
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
      a.addScaledVector(edge, fraction).distanceToSquared(puck) < reach ** 2
    );
  });
};

// More cover reduces the challenge range. Full cover blocks the challenge.
const challengeReach = (
  state: Simulation,
  player: Player,
  other: Player,
): number => {
  const covered =
    puckProtection(state, player, other) * RULESETS[state.ruleset].shielding;
  return covered > SEALED ? 0 : CHALLENGE_REACH * (1 - covered * MOST_SHIELDED);
};

export const isPuckContested = (state: Simulation, player: Player): boolean =>
  state.players.some(
    (other: Player): boolean =>
      other.team !== player.team &&
      !other.emergency &&
      other.mode !== "ascending" &&
      other.mode !== "recovering" &&
      other.position.y < 0.85 &&
      bladeChallengesPuck(state, other, challengeReach(state, player, other)),
  );

export const pollMovement = (controls: Controls, keys: Set<string>): void => {
  const sideways = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
  controls.forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  controls.lateral = sideways;
  controls.dummy = controls.dummyMode ? sideways : 0;
  controls.vertical =
    Number(keys.has("Space")) -
    Number(keys.has("ControlLeft") || keys.has("ControlRight"));
  controls.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
  controls.glance = Number(keys.has("KeyE")) - Number(keys.has("KeyQ"));
};

export const handlingLabel = (state: Simulation, player: Player): string => {
  if (player.grab) return "GRAB PUCK";
  if (player.charging) return "CHARGING SHOT";
  if (player.knockdownTime > 0) return "KNOCKDOWN";
  if (player.curl !== 0)
    return player.curl > 0 ? "REGULAR CURL" : "REVERSE CURL";
  if (player.dummy !== 0)
    return player.dummy < 0 ? "DUMMY LEFT" : "DUMMY RIGHT";
  if (state.puck.controlOwner === player.id) return "PUCK CONTROL";
  if (puckInMoveReach(state, player) && isPuckContested(state, player))
    return "CONTESTED";
  return "READY";
};
