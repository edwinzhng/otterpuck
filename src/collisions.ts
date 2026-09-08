import { Vector3 } from "three";
import {
  clamp,
  FLOOR_HEIGHT,
  type Player,
  POOL,
  SURFACE_HEIGHT,
} from "./types";

const bodyRadius = (player: Player): number => (player.team === 1 ? 0.3 : 0.28);
const up = new Vector3(0, 1, 0);
const across = new Vector3(1, 0, 0);

const bodySegment = (player: Player): [Vector3, Vector3] => {
  const axis = new Vector3(0, 0, 1)
    .applyAxisAngle(across, player.bodyPitch)
    .applyAxisAngle(up, player.yaw);
  return [
    player.position.clone().addScaledVector(axis, -0.2),
    player.position.clone().addScaledVector(axis, 0.27),
  ];
};

export const bodySeparation = (player: Player, other: Player): Vector3 => {
  const [a, b] = bodySegment(player);
  const [c, d] = bodySegment(other);
  const first = b.sub(a);
  const second = d.sub(c);
  const offset = a.clone().sub(c);
  const aa = first.lengthSq();
  const bb = first.dot(second);
  const cc = second.lengthSq();
  const dd = first.dot(offset);
  const ee = second.dot(offset);
  const denominator = aa * cc - bb * bb;
  const firstGuess =
    denominator > 0.00001 ? clamp((bb * ee - cc * dd) / denominator, 0, 1) : 0;
  const secondGuess = clamp((bb * firstGuess + ee) / cc, 0, 1);
  const firstFinal = clamp((bb * secondGuess - dd) / aa, 0, 1);
  const secondFinal = clamp((bb * firstFinal + ee) / cc, 0, 1);
  return a
    .addScaledVector(first, firstFinal)
    .sub(c.addScaledVector(second, secondFinal));
};

export const avoidBodies = (
  player: Player,
  players: Player[],
  desired: Vector3,
): void => {
  for (const other of players) {
    if (
      other === player ||
      other.position.distanceToSquared(player.position) > 6.25
    )
      continue;
    const separation = bodySeparation(player, other);
    const distance = separation.length();
    const clearance = player.team === other.team ? 0.9 : 0.82;
    if (distance > clearance || distance < 0.0001) continue;
    separation.setY(0).normalize();
    const inward = desired.dot(separation);
    if (inward < 0)
      desired.addScaledVector(
        separation,
        -inward *
          clamp(
            (clearance - distance) /
              (clearance - bodyRadius(player) - bodyRadius(other)),
            0,
            1,
          ),
      );
  }
};

const contactResponse = (player: Player, normal: Vector3): Vector3 => {
  const response = normal.clone();
  const onFloor = player.position.y <= FLOOR_HEIGHT + 0.035;
  const holdingDepth =
    !player.emergency && player.mode === "playing" && player.velocity.y <= 0.05;
  if (
    (onFloor && (normal.y < 0 || holdingDepth)) ||
    (player.position.y >= SURFACE_HEIGHT - 0.003 && normal.y > 0)
  )
    response.y = 0;
  return response;
};

export const resolveBodies = (
  players: Player[],
  dt: number,
  correctPositions: boolean,
): void => {
  for (const [index, player] of players.entries()) {
    for (const other of players.slice(index + 1)) {
      if (other.position.distanceToSquared(player.position) > 6.25) continue;
      const normal = bodySeparation(player, other);
      const distance = normal.length();
      if (distance > 0.9) continue;
      if (distance < 0.00001) normal.set(player.id < other.id ? -1 : 1, 0, 0);
      else normal.divideScalar(distance);
      const inward = player.velocity.clone().sub(other.velocity).dot(normal);
      const diameter = bodyRadius(player) + bodyRadius(other);
      const gap = Math.max(0, distance - diameter - 0.012);
      const allowedInward = -gap / dt;
      const firstResponse = contactResponse(player, normal);
      const secondResponse = contactResponse(other, normal.clone().negate());
      if (inward < allowedInward) {
        const firstMobility = player.human
          ? player.velocity.dot(normal) < -0.01
            ? 0.25
            : 0
          : 1;
        const secondMobility = other.human
          ? other.velocity.dot(normal) > 0.01
            ? 0.25
            : 0
          : 1;
        const totalWeight =
          firstMobility * firstResponse.dot(normal) -
          secondMobility * secondResponse.dot(normal);
        if (totalWeight < 0.0001) continue;
        const impulse = (allowedInward - inward) / totalWeight;
        player.velocity.addScaledVector(firstResponse, impulse * firstMobility);
        other.velocity.addScaledVector(
          secondResponse,
          impulse * secondMobility,
        );
      }
      if (correctPositions && distance < diameter - 0.002) {
        const firstMobility = player.human ? 0.25 : 1;
        const secondMobility = other.human ? 0.25 : 1;
        const totalWeight =
          firstMobility * firstResponse.dot(normal) -
          secondMobility * secondResponse.dot(normal);
        if (totalWeight < 0.0001) continue;
        const correction = Math.min(
          dt * 0.65,
          (diameter - distance - 0.002) * (1 - Math.exp(-18 * dt)),
        );
        player.position.addScaledVector(
          firstResponse,
          Math.min(dt * 0.65, (correction * firstMobility) / totalWeight),
        );
        other.position.addScaledVector(
          secondResponse,
          Math.min(dt * 0.65, (correction * secondMobility) / totalWeight),
        );
      }
    }
  }
  if (correctPositions)
    for (const player of players) {
      player.position.x = clamp(
        player.position.x,
        -POOL.width / 2 + 0.32,
        POOL.width / 2 - 0.32,
      );
      player.position.z = clamp(
        player.position.z,
        -POOL.length / 2 + 0.4,
        POOL.length / 2 - 0.4,
      );
      player.position.y = clamp(
        player.position.y,
        FLOOR_HEIGHT,
        SURFACE_HEIGHT,
      );
    }
};
