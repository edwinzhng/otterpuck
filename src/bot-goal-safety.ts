import type { Vector3 } from "three";
import {
  angleDifference,
  attackDirection,
  clamp,
  directionYaw,
  type Player,
  POOL,
  type Simulation,
} from "./types";
export const nearOwnGoal = (player: Player): boolean =>
  !player.human &&
  Math.abs(player.position.x) < 1.85 &&
  POOL.length / 2 + player.position.z * attackDirection(player.team) < 2.2;
export const protectGoalApproach = (
  state: Simulation,
  player: Player,
): void => {
  const direction = attackDirection(player.team);
  const puck = state.puck;
  if (
    player.human ||
    puck.controlOwner === player.id ||
    state.puckChasers[player.team] !== player.id ||
    POOL.length / 2 + puck.position.z * direction > 2.2 ||
    Math.abs(puck.position.x) > 1.6 ||
    (player.position.z - puck.position.z) * direction <= 0.18
  )
    return;
  const side =
    player.position.x === 0
      ? player.slot % 2 === 0
        ? 1
        : -1
      : Math.sign(player.position.x);
  player.target.x = side * 2.2;
  player.target.z =
    Math.abs(player.position.x) < 1.95
      ? player.position.z
      : clamp(puck.position.z - direction * 0.35, -12.1, 12.1);
};
export const safeGoalTurn = (
  player: Player,
  desired: Vector3,
  targetYaw: number,
): number => {
  if (!nearOwnGoal(player)) return angleDifference(targetYaw, player.yaw);
  const direction = attackDirection(player.team);
  const awayYaw = directionYaw(0, direction);
  const target = clamp(
    angleDifference(targetYaw, awayYaw),
    -Math.PI * 0.46,
    Math.PI * 0.46,
  );
  const current = angleDifference(player.yaw, awayYaw);
  desired.z = direction * Math.max(0, desired.z * direction);
  return target - current;
};
