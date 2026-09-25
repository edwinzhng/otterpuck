import { Vector3 } from "three";
import { airSeconds, FINISH_AIR, FINISH_RANGE, TRAY_DEPTH } from "./bots";
import { FLICK_BASE, FLICK_GAIN } from "./flick";
import { chargeTimeScale, flickScale } from "./player-profile";
import { SWIM_SPEED } from "./swim-limits";
import {
  angleDifference,
  attackDirection,
  clamp,
  directionYaw,
  FLOOR_HEIGHT,
  forwardVector,
  type Player,
  PUCK_HEIGHT,
  type Simulation,
} from "./types";
import { underwaterAirUse } from "./vitals";

// A player flick scores from 1.15 m to 2.65 m in front of the goal tray. Power
// must grow with distance: 0.35 at 1.2 m up to full power at 2.65 m. Measured
// by flicking a carried puck at the tray from each distance.
const SHOT_NEAREST = 1.15;
const SHOT_FARTHEST = 2.3;
// The carrier stops this far from the tray, inside the best part of the range.
const SHOT_SPOT = 1.6;
// A carried puck rides about this far ahead of the body, in meters.
const PUCK_LEAD = 0.45;
export const goalShotPower = (distance: number): number =>
  clamp(0.35 + (distance - 1.2) * 0.45, 0.22, 1);
// The carrier's own speed carries into the flick. Fired on the move, a shot
// flies like a standing shot from this much closer per m/s of speed toward
// the tray, in seconds. Lone bot carriers score every time from 0.15 to 0.25.
const MOVING_SHOT_LEAD = 0.2;
// A flick adds this share of the swimmer's velocity to the puck.
const CARRIED_SPEED = 0.65;
// On the way in the carrier charges to release here, in the middle of the
// range, so it does not stop to charge.
const SHOT_RELEASE_REACH = 2;
// A player charges a full shot by holding the button for 0.65 s.
const FULL_CHARGE_SECONDS = 0.65;
// The carrier brakes when its charge would end this close to the near end of
// the range, in meters.
const BRAKE_MARGIN = 0.15;
// Below this speed toward the tray the carrier is not coming in, in m/s.
const APPROACH_SPEED = 0.3;

// A player flick at power 0.22 rests 1.54 m away and each 0.1 of power adds
// 0.162 m, up to 2.8 m at full power. Measured from a carried puck.
const passPower = (distance: number): number =>
  clamp(0.22 + (distance - 1.54) / 1.62, 0.22, 1);
// The measured powers above are for strength 3. Strength scales the flick's
// launch speed, so the bot picks the power that gives the same launch speed.
const strengthAdjusted = (player: Player, power: number): number =>
  clamp(
    ((FLICK_BASE + FLICK_GAIN * power) / flickScale(player.attributes) -
      FLICK_BASE) /
      FLICK_GAIN,
    0.22,
    1,
  );
const PASS_NEAREST = 0.9;
// A receiver with less air than this would soon head up with the puck.
const RECEIVER_MIN_SECONDS = 3;
const RECEIVER_FULL_SECONDS = 10;
// A pass aims where the receiver will be after this many seconds.
const PASS_LEAD = 0.3;
const PASS_FARTHEST = 2.7;
// A receiver needs this much space from the nearest opponent, in meters.
const OPEN_SPACE = 0.75;
// Each radian the carrier must turn costs this much pass value, in meters of
// progress. A turn over 1.3 rad needs a curl, which costs more again.
const TURN_COST = 0.9;
const CURL_COST = 1.2;
// An opponent this close to the puck puts the carrier under pressure.
const PRESSURE = 1.3;
// Air a carrier keeps back to turn, charge and release a pass before it must
// head up, in seconds above its safe reserve. It includes the follow through
// air the carrier stops at. Found with head to head bot matches.
const RELEASE_SECONDS = 1.2;
// Inside this distance of the tray the carrier plays for goal, and the air a
// receiver brings matters less.
const ATTACK_RANGE = 6;
// Free space around a receiver is worth this much per meter over the
// carrier's own, up to OPEN_SPACE_CAP.
const SPACE_VALUE = 0.4;
const OPEN_SPACE_CAP = 3;
// Air above this many seconds adds no more pass value. Air is worth more away
// from goal, where the receiver must carry the puck further.
const ATTACK_AIR_VALUE = 1;
const MIDFIELD_AIR_VALUE = 1.4;
// The own third ends this far from centre, as a depth in meters. A pass
// across it toward the middle loses this much value per meter, since a lost
// puck there sits in front of the own goal.
const OWN_THIRD = -4.2;
const CENTRE_RISK = 0.6;
// A carrier in its own third that is already off centre takes the puck on a
// diagonal to this side lane, where the wall covers one side of it, and swims
// it up along the wall. Distances are in meters, found with head to head bot
// matches.
const WALL_SIDE = 2;
const WALL_LANE = 6.2;
const WALL_REACHED = 5.4;
const WALL_APPROACH = 3.5;
const WALL_STRIDE = 3;
// An opponent inside this lane ahead of the puck blocks the carrier's way to
// goal, in meters.
const BLOCK_LENGTH = 2.5;
const BLOCK_WIDTH = 0.9;
// With no pass, a spent carrier flicks the puck to space. It tries
// these headings and flick lengths, in meters, and values each landing spot.
const SPACE_HEADINGS = 16;
const SPACE_LENGTHS = [1.8, 2.3, 2.8] as const;
const SPACE_X = 6.5;
const SPACE_Z = 11.8;
// A spot a teammate reaches first is worth this much per second of lead, up
// to SPACE_LEAD_CAP seconds. Each meter toward goal is worth SPACE_DEPTH.
const SPACE_LEAD_VALUE = 1;
const SPACE_LEAD_CAP = 2;
const SPACE_DEPTH = 0.35;
// An opponent this close to the flick line would cut the puck off, in meters.
const SPACE_LANE = 0.6;

const onFloor = (player: Player): boolean =>
  player.mode === "playing" &&
  !player.emergency &&
  player.position.y < FLOOR_HEIGHT + 0.2;

const turnCost = (player: Player, yaw: number): number => {
  const turn = Math.abs(angleDifference(yaw, player.yaw));
  return turn * TURN_COST + (turn > 1.3 ? CURL_COST : 0);
};

// Plans what a bot does with the puck it carries: shoot, pass or carry on.
// It sets the heading the bot turns to and the shot the driver will release.
export const planCarry = (
  state: Simulation,
  player: Player,
  committed: boolean,
): void => {
  const puck = state.puck.position;
  const direction = attackDirection(player.team);
  const tray = new Vector3(
    clamp(puck.x * 0.5, -0.8, 0.8),
    PUCK_HEIGHT,
    direction * TRAY_DEPTH,
  );
  const toGoal = tray.clone().sub(puck).setY(0);
  const goalDistance = toGoal.length();
  const goalYaw = directionYaw(toGoal.x, toGoal.z);
  const opponents = state.players.filter(
    (other): boolean => other.team !== player.team && onFloor(other),
  );
  const nearest = (point: Vector3): number =>
    opponents.reduce(
      (closest, other): number =>
        Math.min(
          closest,
          Math.hypot(other.position.x - point.x, other.position.z - point.z),
        ),
      Number.POSITIVE_INFINITY,
    );
  const pressure = nearest(puck) < PRESSURE;

  const ahead = toGoal.clone().normalize();
  const closing = Math.max(0, player.velocity.dot(ahead));
  const reach = goalDistance - closing * MOVING_SHOT_LEAD;
  // Too close to flick it in, the carrier swims the puck into the tray. A
  // carried puck that crosses the goal line scores like a shot.
  if (reach <= SHOT_NEAREST) {
    player.target.copy(tray).setY(FLOOR_HEIGHT);
    player.aimYaw = goalYaw;
    return;
  }
  // The carrier's own speed carries into the flick, so a shot on the move
  // aims off the tray to cancel the sideways part of that speed.
  const aimAt = (power: number): number => {
    const launch =
      (FLICK_BASE + FLICK_GAIN * power) * flickScale(player.attributes);
    const drift = player.velocity.clone().setY(0).multiplyScalar(CARRIED_SPEED);
    const across = drift.clone().addScaledVector(ahead, -drift.dot(ahead));
    const along = Math.sqrt(Math.max(0, launch ** 2 - across.lengthSq()));
    const aim = ahead.clone().multiplyScalar(along).sub(across);
    return directionYaw(aim.x, aim.z);
  };
  // Seconds of charge still needed to reach a power.
  const chargeLeft = (power: number): number =>
    Math.max(0, power - player.charge) *
    chargeTimeScale(player.attributes) *
    FULL_CHARGE_SECONDS;
  // In range the carrier shoots on the move and keeps swimming at the tray. It
  // brakes only when the charge would not end before the range does.
  if (reach > SHOT_NEAREST && reach < SHOT_FARTHEST) {
    const power = strengthAdjusted(player, goalShotPower(reach));
    const yaw = aimAt(power);
    player.plannedShot = { yaw, power };
    player.aimYaw = yaw;
    const braking =
      reach - closing * chargeLeft(power) < SHOT_NEAREST + BRAKE_MARGIN;
    player.target.copy(braking ? player.position : tray).setY(FLOOR_HEIGHT);
    return;
  }

  // A forward near the end of its breath with a defender in its way plays the
  // puck back to its support rather than leave it behind. With the way open it
  // pushes on to the end, and in its own half it never passes back.
  const depth = puck.z * direction;
  const breath = airSeconds(state, player, true);
  const blocked = opponents.some((other): boolean => {
    const offset = other.position.clone().sub(puck).setY(0);
    const along = offset.dot(ahead);
    return (
      along > 0 &&
      along < BLOCK_LENGTH &&
      Math.abs(offset.x * ahead.z - offset.z * ahead.x) < BLOCK_WIDTH
    );
  });
  // With the way open the carrier starts to charge on the way in, late enough
  // that the charge ends as it reaches the middle of the range.
  const release = strengthAdjusted(player, goalShotPower(SHOT_RELEASE_REACH));
  if (
    !blocked &&
    reach >= SHOT_FARTHEST &&
    closing > APPROACH_SPEED &&
    (player.charging ||
      (reach - SHOT_RELEASE_REACH) / closing <= chargeLeft(release))
  ) {
    const yaw = aimAt(release);
    player.plannedShot = { yaw, power: release, hold: true };
    player.aimYaw = yaw;
    player.target.copy(tray).setY(FLOOR_HEIGHT);
    return;
  }
  // An attacker is spent when it has too little air left to turn, charge and
  // release a pass and a defender is in its way, or its air cannot take the
  // puck to a shot at all. Near the goal it may use its air down to the finish
  // reserve.
  const finishSeconds =
    Math.max(0, player.air - FINISH_AIR) /
    underwaterAirUse(state, player, true, 1);
  const carrySpeed = Math.max(closing, SWIM_SPEED);
  const outOfAir =
    breath < Math.max(0, goalDistance - FINISH_RANGE) / carrySpeed ||
    finishSeconds <
      Math.max(0, reach - SHOT_RELEASE_REACH) / carrySpeed +
        chargeLeft(release);
  const spent = depth > 0 && (blocked || outOfAir) && breath < RELEASE_SECONDS;
  const attacking = goalDistance < ATTACK_RANGE;
  const airFraction = (time: number): number =>
    Math.min(time, RECEIVER_FULL_SECONDS) / RECEIVER_FULL_SECONDS;
  const ownSpace = Math.min(OPEN_SPACE_CAP, nearest(puck));
  const ownAir = airFraction(breath);
  const option = (other: Player, desperate: boolean) => {
    const lead = other.position
      .clone()
      .addScaledVector(other.velocity, PASS_LEAD);
    const distance = Math.hypot(lead.x - puck.x, lead.z - puck.z);
    if (distance < PASS_NEAREST || (!desperate && distance > PASS_FARTHEST))
      return [];
    const space = nearest(lead);
    if (!desperate && space < OPEN_SPACE) return [];
    // A pass goes to a teammate with air to keep playing.
    const time = airSeconds(state, other, false);
    if (time < RECEIVER_MIN_SECONDS) return [];
    const yaw = directionYaw(lead.x - puck.x, lead.z - puck.z);
    const progress = (lead.z - puck.z) * direction;
    const inward =
      depth < OWN_THIRD ? Math.max(0, Math.abs(puck.x) - Math.abs(lead.x)) : 0;
    return [
      {
        yaw,
        power: strengthAdjusted(
          player,
          passPower(Math.min(distance, PASS_FARTHEST)),
        ),
        value:
          progress +
          (Math.min(OPEN_SPACE_CAP, space) - ownSpace) * SPACE_VALUE +
          (airFraction(time) - ownAir) *
            (attacking ? ATTACK_AIR_VALUE : MIDFIELD_AIR_VALUE) -
          inward * CENTRE_RISK -
          turnCost(player, yaw),
      },
    ];
  };
  const teammates = state.players.filter(
    (other): boolean =>
      other.team === player.team && other.id !== player.id && onFloor(other),
  );
  const best = (desperate: boolean) =>
    teammates
      .flatMap((other) => option(other, desperate))
      .sort((a, b): number => b.value - a.value)
      .at(0);
  // A pass must gain the team something. Pressure lowers the bar, and a
  // spent carrier takes any open pass, or failing that any pass at all.
  const pass = best(false) ?? (spent ? best(true) : undefined);
  const bar = spent
    ? Number.NEGATIVE_INFINITY
    : committed
      ? -1
      : pressure
        ? -0.6
        : 0.8;
  if (pass && pass.value > bar) {
    player.plannedShot = { yaw: pass.yaw, power: pass.power };
    player.aimYaw = pass.yaw;
    return;
  }
  // A spent carrier with no pass does not take the puck up with it. It flicks
  // the puck where a teammate gets to it first, or at least deep.
  const flick = spent ? spaceFlick(state, player, teammates) : undefined;
  if (flick) {
    player.plannedShot = flick;
    player.aimYaw = flick.yaw;
    return;
  }
  // In its own third an off-centre carrier takes the puck to the wall and up
  // along it.
  if (depth < OWN_THIRD && Math.abs(puck.x) > WALL_SIDE) {
    const side = Math.sign(puck.x) || state.strongSides[player.team] || 1;
    const alongWall = Math.abs(puck.x) > WALL_REACHED;
    player.target.set(
      side * WALL_LANE,
      FLOOR_HEIGHT,
      puck.z + direction * (alongWall ? WALL_STRIDE : WALL_APPROACH),
    );
    player.aimYaw = directionYaw(
      player.target.x - puck.x,
      player.target.z - puck.z,
    );
    return;
  }

  // Carry the puck to the shooting spot. The puck rides ahead of the body, so
  // the body stops short of the spot.
  player.target
    .copy(tray)
    .addScaledVector(toGoal.clone().normalize(), -(SHOT_SPOT + PUCK_LEAD))
    .setY(FLOOR_HEIGHT);
  player.aimYaw = goalYaw;
};

// Picks where to flick a puck the carrier cannot keep: a spot a teammate
// reaches before any opponent, as deep toward goal as it can be. With no such
// spot, the deepest one wins, so the team at least gains space.
const spaceFlick = (
  state: Simulation,
  player: Player,
  teammates: readonly Player[],
): { yaw: number; power: number } | undefined => {
  const puck = state.puck.position;
  const direction = attackDirection(player.team);
  const opponents = state.players.filter(
    (other): boolean => other.team !== player.team && onFloor(other),
  );
  const arrival = (players: readonly Player[], spot: Vector3): number =>
    players.reduce(
      (soonest, other): number =>
        Math.min(
          soonest,
          Math.hypot(other.position.x - spot.x, other.position.z - spot.z) /
            SWIM_SPEED,
        ),
      Number.POSITIVE_INFINITY,
    );
  let chosen: { yaw: number; power: number; value: number } | undefined;
  for (let index = 0; index < SPACE_HEADINGS; index += 1) {
    const yaw = (index / SPACE_HEADINGS) * Math.PI * 2;
    const heading = forwardVector(yaw);
    // Stay out of the line of any opponent.
    const cut = opponents.some((other): boolean => {
      const offset = other.position.clone().sub(puck).setY(0);
      const along = offset.dot(heading);
      return (
        along > 0 &&
        along < SPACE_LENGTHS[SPACE_LENGTHS.length - 1] &&
        Math.abs(offset.x * heading.z - offset.z * heading.x) < SPACE_LANE
      );
    });
    if (cut) continue;
    for (const length of SPACE_LENGTHS) {
      const spot = puck.clone().addScaledVector(heading, length);
      if (Math.abs(spot.x) > SPACE_X || Math.abs(spot.z) > SPACE_Z) continue;
      // With nobody on one side the lead is undefined, so it counts as none.
      const lead =
        clamp(
          arrival(opponents, spot) - arrival(teammates, spot),
          -SPACE_LEAD_CAP,
          SPACE_LEAD_CAP,
        ) || 0;
      const value =
        lead * SPACE_LEAD_VALUE +
        (spot.z - puck.z) * direction * SPACE_DEPTH -
        turnCost(player, yaw);
      if (!chosen || value > chosen.value)
        chosen = {
          yaw,
          power: strengthAdjusted(player, passPower(length)),
          value,
        };
    }
  }
  return chosen && { yaw: chosen.yaw, power: chosen.power };
};
