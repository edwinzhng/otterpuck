import { Vector3 } from "three";
import {
  angleDifference,
  clamp,
  handSide,
  type Player,
  type Simulation,
} from "./types";

const FRONT_GUARD = 0.95;
const INSIDE_GUARD = 0.95;
const OPEN_GUARD = 0.35;
const REGULAR_GUARD = 0.7;
const SAME_FACING = 1.8;
const OPPOSED_FACING = 0.45;
const SANDWICH_RANGE = 1.5;
const SANDWICH_FACING = 0.3;
const SANDWICH_TURN = 1;

const upAxis = new Vector3(0, 1, 0);

const localOffset = (carrier: Player, other: Player): Vector3 =>
  other.position
    .clone()
    .sub(carrier.position)
    .applyAxisAngle(upAxis, -carrier.yaw);

// Bearing of the challenger mirrored into right-handed terms, so every angle
// reads the same for either hand: 0 straight ahead, +pi/2 on the stick side.
const mirroredBearing = (carrier: Player, other: Player): number => {
  const local = localOffset(carrier, other);
  return Math.atan2(local.x * handSide(carrier), -local.z);
};

const facingAlignment = (carrier: Player, other: Player): number =>
  Math.cos(angleDifference(other.yaw, carrier.yaw));

const turning = (carrier: Player): boolean =>
  carrier.curl !== 0 || Math.abs(carrier.turnRate) > SANDWICH_TURN;

// The opponents closing from both sides at once, or none when only one side is
// covered and the carrier still has a way out.
export const sandwichPartners = (
  state: Simulation,
  carrier: Player,
): Player[] => {
  const sides = state.players.filter(
    (other: Player): boolean =>
      other.team !== carrier.team &&
      !other.emergency &&
      other.position.distanceToSquared(carrier.position) <
        SANDWICH_RANGE ** 2 &&
      facingAlignment(carrier, other) > SANDWICH_FACING,
  );
  const stickSide = sides.filter(
    (other): boolean => localOffset(carrier, other).x > 0,
  );
  const offSide = sides.filter(
    (other): boolean => localOffset(carrier, other).x < 0,
  );
  return stickSide.length > 0 && offSide.length > 0
    ? [...stickSide, ...offSide]
    : [];
};

export const inSandwich = (state: Simulation, carrier: Player): boolean =>
  sandwichPartners(state, carrier).length > 0;

// How well the carrier's body and stick cover the puck against one challenger,
// from 0 (open) to 1 (all but untouchable). Curling puts the puck on the inside
// of the blade: a reverse curl seals the stick side and leaves the other open,
// a regular curl guards both sides evenly, and the front stays covered either
// way. A challenger facing the same way as the carrier gets a far better angle
// on it than one coming head-on.
export const puckProtection = (
  state: Simulation,
  carrier: Player,
  challenger: Player,
): number => {
  if (carrier.curl === 0) return 0;
  if (turning(carrier) && inSandwich(state, carrier)) return 0;
  const bearing = mirroredBearing(carrier, challenger);
  const stickSide = Math.sin(bearing);
  const guard =
    carrier.curl < 0
      ? OPEN_GUARD + (INSIDE_GUARD - OPEN_GUARD) * (stickSide * 0.5 + 0.5)
      : REGULAR_GUARD;
  const covered =
    guard + (FRONT_GUARD - guard) * Math.max(0, Math.cos(bearing));
  const alignment = facingAlignment(carrier, challenger);
  const angle =
    alignment >= 0
      ? 1 + (SAME_FACING - 1) * alignment
      : 1 + (1 - OPPOSED_FACING) * alignment;
  return 1 - clamp((1 - covered) * angle, 0, 1);
};
