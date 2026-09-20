import type { Player, Simulation } from "./types";

export const announce = (
  state: Simulation,
  message: string,
  duration = 3,
): void => {
  state.event = message;
  state.eventTime = duration;
};

// Store private events on the player. Simulation events are visible to all players.
export const announceTo = (
  player: Player,
  message: string,
  duration = 3,
): void => {
  player.event = message;
  player.eventTime = duration;
};
