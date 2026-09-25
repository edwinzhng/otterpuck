import { RULESETS } from "../rules";
import { clamp, REST_HEART_RATE, type Simulation } from "../types";
import { airRate, heartRateChange, staminaRate } from "../vitals";

export type HudValues = {
  air: number;
  stamina: number;
  heartRate: number;
  seconds: number;
};

// Presentation only: never feed extrapolated vitals or time into gameplay.
export const createHudPresentation = (): {
  push: (state: Simulation, now: number) => void;
  read: (now: number) => HudValues | undefined;
} => {
  const anchor: HudValues = {
    air: 100,
    stamina: 100,
    heartRate: REST_HEART_RATE,
    seconds: 0,
  };
  const rates: HudValues = { air: 0, stamina: 0, heartRate: 0, seconds: 0 };
  const error: HudValues = { air: 0, stamina: 0, heartRate: 0, seconds: 0 };
  const display: HudValues = { ...anchor };
  let received: number | undefined;
  let transition = "";
  const read = (now: number): HudValues | undefined => {
    if (received === undefined) return undefined;
    // Brief packet gaps are normal; a disconnected clock must not run forever.
    const age = clamp((now - received) / 1000, 0, 2);
    const correction = Math.exp(-age / 0.18);
    display.air = clamp(
      anchor.air + rates.air * age + error.air * correction,
      0,
      100,
    );
    display.stamina = clamp(
      anchor.stamina + rates.stamina * age + error.stamina * correction,
      0,
      100,
    );
    // The heart converges, so a straight line past a short gap is close enough.
    display.heartRate = Math.max(
      0,
      anchor.heartRate + rates.heartRate * age + error.heartRate * correction,
    );
    const seconds = Math.max(
      0,
      anchor.seconds + rates.seconds * age + error.seconds * correction,
    );
    display.seconds =
      rates.seconds < 0 ? Math.min(display.seconds, seconds) : seconds;
    return display;
  };
  return {
    read,
    push: (state, now): void => {
      const player = state.players[0];
      if (!player) return;
      const key = `${player.id}:${state.finished}:${state.restartTime > 0}:${state.faceoff?.phase === "ready"}:${state.mode}`;
      const previous = read(now);
      const snap =
        !previous ||
        key !== transition ||
        now - (received ?? now) > 2000 ||
        Math.abs(state.seconds - display.seconds) > 2;
      error.air = snap ? 0 : display.air - player.air;
      error.stamina = snap ? 0 : display.stamina - player.stamina;
      error.heartRate = snap ? 0 : display.heartRate - player.heartRate;
      error.seconds = snap ? 0 : display.seconds - state.seconds;
      anchor.air = player.air;
      anchor.stamina = player.stamina;
      anchor.heartRate = player.heartRate;
      anchor.seconds = state.seconds;
      if (snap) Object.assign(display, anchor);
      const running =
        !state.finished &&
        state.restartTime <= 0 &&
        state.faceoff?.phase !== "ready";
      rates.air =
        running && state.mode !== "playground" ? airRate(state, player) : 0;
      rates.stamina =
        running && state.mode !== "playground"
          ? staminaRate(RULESETS[state.ruleset], player)
          : 0;
      rates.heartRate =
        running && state.mode !== "playground"
          ? heartRateChange(state, player)
          : 0;
      rates.seconds = running && state.mode === "match" ? -1 : 0;
      received = now;
      transition = key;
    },
  };
};
