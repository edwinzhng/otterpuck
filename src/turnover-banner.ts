import { setText } from "./dom";
import type { TackleEvent } from "./tackle-events";
import type { Simulation } from "./types";
import type { UI } from "./ui-types";

const HOLD = 1.5;
const POP = 0.12;
const FADE = 0.25;

export type TurnoverBanner = {
  render: (ui: UI, state: Simulation, events: readonly TackleEvent[]) => void;
};

// Only the local player's own turnovers reach the banner: the puck taken off
// them, taken by them, or won by the pincer they closed. A teammate losing it
// across the pool is left to the tackle log.
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
    // Newest first, so the first match is the local player's latest turnover;
    // a teammate's steal logged on top of it must not cut ours short.
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
      outcome === "won" ? "PUCK WON" : "TACKLED",
    );
    setText(ui.elements.turnoverDetail, latest.label);
    const remaining = HOLD - elapsed;
    banner.style.setProperty(
      "--turnover-pop",
      String(Math.min(1, elapsed / POP)),
    );
    banner.style.setProperty(
      "--turnover-fade",
      String(Math.min(1, remaining / FADE)),
    );
  },
});
