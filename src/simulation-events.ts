import type { Player, Simulation } from "./types";

export const announce = (
  state: Simulation,
  message: string,
  duration = 3,
): void => {
  state.event = message;
  state.eventTime = duration;
};

// Announcements about one otter's own state belong to that otter: everyone
// shares a simulation, so putting them on it shows them to the whole room.
export const announceTo = (
  player: Player,
  message: string,
  duration = 3,
): void => {
  player.event = message;
  player.eventTime = duration;
};
