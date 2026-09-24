// Turn rules shared by the player controller and the bot driver. Bots send the
// same controls as a player, so both must read one set of limits.

// Curl rate in radians per second. A full curl takes 2*PI/CURL_TURN_SPEED
// seconds, so 4.189 gives a 1.5 second curl.
export const CURL_TURN_SPEED = 4.189;
// Turn limit while the player carries the puck. Turn radius is swim speed
// divided by this rate, so a lower value forces a wider arc around the puck.
export const CARRY_TURN_SPEED = 1.5;
// Base turn limit for swimming without the puck. The player setting scales it.
const SWIM_TURN_SPEED = 2.795;
const FREE_SWIM_TURN_SPEED = 3.6;
// Turn limit at the surface, where the puck is not played. It allows 1.5 full
// turns per second, fast enough to reorient before the next dive.
export const SURFACE_TURN_SPEED = 1.5 * 2 * Math.PI;
// A turn with the puck faster than this, without forward swimming, hands the
// puck over to a curl. Sprinting forward uses the higher rate for a dummy.
export const HARD_TURN_RATE = 2.6;
export const HARD_TURN_FORWARD_RATE = 4.1;
// A curl ends when the requested turn falls below this rate.
export const HARD_TURN_RELEASE = 1.6;
export const POINTER_TURN_GAIN = 1.45;
export const FREE_SWIM_POINTER_TURN_GAIN = 2.05;
// Normal swim and sprint speeds in meters per second.
export const SWIM_SPEED = 1.55;
export const SPRINT_SPEED = 2.9;

export const swimTurnLimit = (
  swimTurn: number,
  carrying: boolean,
  underwater: boolean,
): number =>
  underwater
    ? carrying
      ? CARRY_TURN_SPEED * swimTurn
      : Math.max(FREE_SWIM_TURN_SPEED, SWIM_TURN_SPEED * swimTurn)
    : SURFACE_TURN_SPEED;

export const pointerTurnGain = (carrying: boolean): number =>
  carrying ? POINTER_TURN_GAIN : FREE_SWIM_POINTER_TURN_GAIN;
