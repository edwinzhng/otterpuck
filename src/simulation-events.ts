import type { Simulation } from "./types";

export const announce = (
  state: Simulation,
  message: string,
  duration = 3,
): void => {
  state.event = message;
  state.eventTime = duration;
};
