import {
  airRefillScale,
  airUseScale,
  heartRecoveryScale,
  staminaDrainScale,
} from "./player-profile";
import { RULESETS, type Rules } from "./rules";
import {
  clamp,
  MAX_STAMINA,
  type Player,
  type Simulation,
  SURFACE_HEIGHT,
} from "./types";

// Share of the stamina recovery a player gets at its heart rate: all of it at
// rest, half of it at the sprint maximum. Without a heart model it is all of
// it. Half stays, so a steady swim still earns stamina back slowly.
const calmness = (rules: Rules, player: Player): number =>
  rules.heart
    ? 0.5 +
      0.5 *
        clamp(
          (rules.heart.sprint - player.heartRate) /
            (rules.heart.sprint - rules.heart.rest),
          0,
          1,
        )
    : 1;

export const staminaRate = (rules: Rules, player: Player): number => {
  const atSurface = player.position.y >= SURFACE_HEIGHT - 0.045;
  const effort =
    ((player.sprint ? rules.sprintDrain : rules.idleDrain) +
      rules.kickDrain * Math.min(1, player.kick)) *
    staminaDrainScale(player.attributes);
  const spent = atSurface
    ? player.sprint
      ? effort * rules.surfaceSprint
      : 0
    : effort;
  const regained = player.sprint
    ? 0
    : (atSurface ? rules.surfaceRecovery : rules.recovery) *
      (player.emergency ? rules.emergencyRecovery : 1) *
      calmness(rules, player);
  return regained - spent;
};

export const airEngaged = (state: Simulation, player: Player): boolean =>
  player.handling ||
  player.curl !== 0 ||
  player.shotTime > 0 ||
  player.cooldown > 0 ||
  state.puck.controlOwner === player.id ||
  (state.puck.lastTouch === player.id &&
    state.time - state.puck.touchTime < 1.2);

// Where the heart is heading and how fast, as a time constant in seconds.
// Effort sets the target: rest when still, up to the swim rate with a full
// kick and the sprint rate in a sprint. Playing the puck and curling add to
// it. Undefined for a ruleset without a heart model.
export const heartDrive = (
  state: Simulation,
  player: Player,
): { target: number; seconds: number } | undefined => {
  const heart = RULESETS[state.ruleset].heart;
  if (!heart) return undefined;
  const effort = player.sprint
    ? heart.sprint
    : heart.rest + (heart.swim - heart.rest) * Math.min(1, player.kick);
  const target = Math.min(
    heart.sprint,
    effort +
      (airEngaged(state, player) ? heart.handling : 0) +
      (player.curl !== 0 ? heart.curl : 0),
  );
  const seconds =
    target >= player.heartRate
      ? player.sprint
        ? heart.sprintRise
        : heart.swimRise
      : heart.fall / heartRecoveryScale(player.attributes);
  return { target, seconds };
};

// Heart rate change right now, in beats per minute per second.
export const heartRateChange = (state: Simulation, player: Player): number => {
  const heart = heartDrive(state, player);
  return heart ? (heart.target - player.heartRate) / heart.seconds : 0;
};

// Air a player uses underwater, in percent per second. With a heart model it
// follows the heart rate, and playing the puck costs more because it raises
// the heart. Without one, play on the puck costs more than swimming and
// `kick` is the swimming effort from 0 to 1.
export const underwaterAirUse = (
  state: Simulation,
  player: Player,
  engaged: boolean,
  kick = Math.min(1, player.kick),
  heartRate = player.heartRate,
): number => {
  const rules = RULESETS[state.ruleset];
  if (rules.heart)
    return (
      rules.heart.restAirUse *
      Math.exp((heartRate - rules.heart.rest) / rules.heart.airGrowth) *
      airUseScale(player.attributes)
    );
  const stamina = player.stamina / MAX_STAMINA;
  const air = rules.airDrain;
  const drain = engaged
    ? air.engaged + Math.abs(player.curl) * air.curl
    : air.idle + kick * air.kick;
  return (
    ((drain + (1 - stamina) * rules.spentAirDrain) *
      airUseScale(player.attributes)) /
    (0.75 * rules.airSupply)
  );
};

export const airRate = (state: Simulation, player: Player): number => {
  const rules = RULESETS[state.ruleset];
  const stamina = player.stamina / MAX_STAMINA;
  if (player.position.y >= SURFACE_HEIGHT - 0.045)
    return rules.heart
      ? ((rules.airBase + rules.airStamina) *
          airRefillScale(player.attributes) *
          Math.exp(
            -(player.heartRate - rules.heart.rest) / rules.heart.refillFalloff,
          )) /
          rules.airSupply
      : ((rules.airBase + rules.airStamina * stamina) *
          airRefillScale(player.attributes)) /
          rules.airSupply;
  return -underwaterAirUse(state, player, airEngaged(state, player));
};
