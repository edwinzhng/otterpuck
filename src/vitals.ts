import {
  airRefillScale,
  airUseScale,
  staminaDrainScale,
} from "./player-profile";
import { RULESETS, type Rules } from "./rules";
import {
  MAX_STAMINA,
  type Player,
  type Simulation,
  SURFACE_HEIGHT,
} from "./types";

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
      (player.emergency ? rules.emergencyRecovery : 1);
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

// Air a player uses underwater, in percent per second. Play on the puck costs
// more than swimming. `kick` is the swimming effort from 0 to 1.
export const underwaterAirUse = (
  state: Simulation,
  player: Player,
  engaged: boolean,
  kick = Math.min(1, player.kick),
): number => {
  const rules = RULESETS[state.ruleset];
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
    return (
      ((rules.airBase + rules.airStamina * stamina) *
        airRefillScale(player.attributes)) /
      rules.airSupply
    );
  return -underwaterAirUse(state, player, airEngaged(state, player));
};
