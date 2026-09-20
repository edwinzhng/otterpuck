import { setText } from "./dom";
import type { TackleEvent } from "./tackle-events";
import type { Simulation } from "./types";
import type { UI } from "./ui-types";

const HOLD = 1;
const FADE = 0.2;

export type TurnoverBanner = {
  render: (ui: UI, state: Simulation, events: readonly TackleEvent[]) => void;
};

// Show only turnovers that involve the local player. Other events stay in the log.
export const turnoverOutcome = (
  state: Simulation,
  event: TackleEvent,
): "won" | "lost" | undefined => {
  const self = state.players.at(0);
  if (!self) return undefined;
  if (event.carrierId === self.id) return "lost";
  return event.takerId === self.id || event.sandwichIds.includes(self.id)
    ? "won"
    : undefined;
};

export const createTurnoverBanner = (): TurnoverBanner => ({
  render: (ui, state, events): void => {
    const banner = ui.elements.turnover;
    // Events are newest first. Skip newer events that do not involve the local player.
    const latest = events.find(
      (event): boolean => turnoverOutcome(state, event) !== undefined,
    );
    const elapsed = latest ? state.time - latest.time : HOLD;
    const outcome = latest ? turnoverOutcome(state, latest) : undefined;
    const showing =
      latest !== undefined &&
      outcome !== undefined &&
      state.mode === "match" &&
      elapsed >= 0 &&
      elapsed < HOLD;
    banner.classList.toggle("visible", showing);
    if (!showing || !latest || !outcome) return;
    if (banner.dataset.outcome !== outcome) banner.dataset.outcome = outcome;
    setText(
      ui.elements.turnoverTitle,
      outcome === "won" ? "Puck won" : "Puck lost",
    );
    const remaining = HOLD - elapsed;
    banner.style.setProperty(
      "--turnover-fade",
      String(Math.min(1, remaining / FADE)),
    );
  },
});
