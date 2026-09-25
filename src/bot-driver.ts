import { Vector3 } from "three";
import { botProfiles } from "./bots";
import { canGrabPuck, canKnockdown } from "./handling";
import { chargeTimeScale, MAX_HELD } from "./player-profile";
import {
  CARRY_TURN_SPEED,
  HARD_TURN_RATE,
  pointerTurnGain,
  SPRINT_SPEED,
  SWIM_SPEED,
  swimTurnLimit,
} from "./swim-limits";
import {
  angleDifference,
  CAMERA_OFFSET,
  type Controls,
  clamp,
  FLOOR_HEIGHT,
  forwardVector,
  freshControls,
  type Player,
  type Simulation,
  SURFACE_HEIGHT,
} from "./types";

// What the bot brain wants this step. The driver turns it into the controls
// a player would send, so bots obey every movement rule a player obeys.
export type BotIntent = {
  // Horizontal velocity the bot wants, in meters per second.
  desired: Vector3;
  // Signed heading change the bot wants, in radians.
  headingError: number;
  holdHeading: boolean;
  sprint: boolean;
  stop: boolean;
  // Only the team's chaser grabs a loose puck, so teammates never collide
  // over it.
  pursuing: boolean;
  dummy: number;
};

// A player breathes above this height. It matches the air rules.
const BREATHING_HEIGHT = SURFACE_HEIGHT - 0.04;
// Heading error the bot ignores while it holds station, in radians.
const HEADING_DEADBAND = 0.1;
// Turn rate requested per radian of heading error, in 1/s.
const TURN_GAIN = 10;
// A carry turn stays under the hand-over rate, so the bot curls only on
// purpose. The carry limit is lower still, so this costs no turn speed.
const CARRY_TURN_REQUEST = HARD_TURN_RATE * 0.9;
// A carrier this far off its heading curls round instead of arcing, in
// radians. The curl ends once the heading is close.
const CURL_START = 1.5;
const CURL_STOP = 0.5;

const CURL_REQUEST = HARD_TURN_RATE * 1.3;
// A player charges a full shot by holding the button for 0.65 s.
const FULL_CHARGE_SECONDS = 0.65;

const lookAtPuck = (state: Simulation, player: Player): number => {
  const sight = state.puck.position
    .clone()
    .sub(player.position)
    .applyAxisAngle(new Vector3(0, 1, 0), -player.yaw)
    .sub(CAMERA_OFFSET);
  return clamp(
    Math.atan2(sight.y, Math.max(0.05, Math.hypot(sight.x, -sight.z))),
    -1.15,
    1.05,
  );
};

const opponentPuck = (state: Simulation, player: Player): boolean => {
  const toucher = state.puck.shotOwner ?? state.puck.lastTouch;
  return state.players.some(
    (other): boolean => other.id === toucher && other.team !== player.team,
  );
};

export const botControls = (
  state: Simulation,
  player: Player,
  intent: BotIntent,
  dt: number,
): Controls => {
  const controls = freshControls();
  const profile = botProfiles[state.difficulty];
  const carrying = state.puck.controlOwner === player.id;
  const underwater = player.position.y < SURFACE_HEIGHT - 0.07;
  const shot = carrying ? player.plannedShot : undefined;
  const error = shot
    ? angleDifference(shot.yaw, player.yaw)
    : intent.headingError;
  const curling =
    carrying &&
    player.shotTime <= 0 &&
    !player.charging &&
    Math.abs(error) > (player.curl !== 0 ? CURL_STOP : CURL_START);
  const limit = Math.min(
    profile.turnSpeed,
    swimTurnLimit(state.swimTurn, carrying, underwater),
    carrying ? CARRY_TURN_REQUEST : Number.POSITIVE_INFINITY,
  );
  const rate = curling
    ? Math.sign(error) * CURL_REQUEST
    : player.curl !== 0 ||
        (intent.holdHeading && !shot && Math.abs(error) < HEADING_DEADBAND)
      ? 0
      : clamp(error * TURN_GAIN, -limit, limit);
  controls.yawDelta = (rate * dt) / (1.3 * pointerTurnGain(carrying));

  const forward = forwardVector(player.yaw);
  const speed = intent.desired.length();
  const alignment =
    speed > 0.001 ? Math.max(0, intent.desired.dot(forward) / speed) : 0;
  const propulsion =
    intent.stop || curling || player.curl !== 0 ? 0 : speed * alignment ** 2;
  controls.sprint = intent.sprint && propulsion > SWIM_SPEED;
  controls.forward = Math.min(
    1,
    propulsion / (controls.sprint ? SPRINT_SPEED : SWIM_SPEED),
  );

  // A recovering player keeps kicking up until it breathes, so it never
  // settles just under the surface.
  controls.vertical =
    player.mode === "ascending" ||
    (player.mode === "recovering" && player.position.y < BREATHING_HEIGHT)
      ? 1
      : player.mode === "diving" ||
          (player.mode === "playing" && player.position.y > FLOOR_HEIGHT + 0.03)
        ? -1
        : 0;
  controls.pitch = lookAtPuck(state, player);
  controls.knockdown =
    (intent.pursuing && canGrabPuck(state, player, controls.pitch)) ||
    (canKnockdown(state, player) && opponentPuck(state, player));
  if (carrying && !curling && player.curl === 0) {
    controls.dummy = intent.dummy;
    controls.dummyMode = intent.dummy !== 0;
  }

  // The bot charges while it finishes the turn, as a player does, and starts
  // late enough that the charge ends as the aim settles. A player's release
  // power is the time held, so the bot never holds longer than it must.
  const aim = profile.aim;
  if (
    shot &&
    !curling &&
    player.curl === 0 &&
    player.shotTime <= 0 &&
    player.cooldown <= 0
  ) {
    // Charge is held time as a fraction of a full player charge. Technique
    // reaches a given power with less of it.
    const quickness = chargeTimeScale(player.attributes);
    const held = player.charge * quickness + dt / FULL_CHARGE_SECONDS;
    const needed = shot.power * quickness;
    const turnTime = Math.abs(error) / (CARRY_TURN_SPEED * state.swimTurn);
    const chargeTime = Math.max(0, needed - held) * FULL_CHARGE_SECONDS;
    if (held >= needed && Math.abs(error) < aim && !shot.hold)
      controls.shot = Math.min(MAX_HELD, held);
    else if (player.charging || turnTime <= chargeTime) {
      controls.charging = true;
      controls.charge = Math.min(MAX_HELD, held);
      controls.dummy = 0;
      controls.dummyMode = false;
    }
  }
  return controls;
};
