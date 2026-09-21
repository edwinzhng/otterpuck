import { depthGuidance } from "./depth";
import { setText } from "./dom";
import { handlingLabel, puckReaction } from "./handling";
import type { Input } from "./input";
import { drawMap } from "./minimap";
import type { HudValues } from "./multiplayer/hud";
import { playerPosition } from "./positions";
import type { Simulation } from "./types";
import type { UI } from "./ui-types";

export { getElement } from "./dom";
export { createUI } from "./ui-setup";
export type { UI } from "./ui-types";

export const updateHudValues = (
  ui: UI,
  state: Simulation,
  values?: HudValues,
): void => {
  const player = state.players.at(0);
  if (!player) return;
  const remaining = values?.seconds ?? state.seconds;
  const air = values?.air ?? player.air;
  const stamina = values?.stamina ?? player.stamina;
  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60)
    .toString()
    .padStart(2, "0");
  setText(
    ui.elements.clock,
    state.mode !== "match"
      ? "∞"
      : `${minutes.toString().padStart(2, "0")}:${seconds}`,
  );
  setText(ui.elements.air, String(Math.ceil(air)));
  setText(
    ui.elements.airLabel,
    player.emergency
      ? "Recovering"
      : player.mode === "recovering"
        ? "Breathing"
        : "Air",
  );
  ui.hud.style.setProperty("--air", `${air}%`);
  ui.hud.classList.toggle("low-air", air < 26);
  ui.hud.style.setProperty("--stamina", `${stamina}%`);
  setText(ui.elements.staminaValue, String(Math.ceil(stamina)));
  ui.elements.stamina.classList.toggle("spent", stamina < 25);
};

export const updateUI = (
  ui: UI,
  state: Simulation,
  input: Input,
  world: { headLift: number; frameRate: number },
): void => {
  const player = state.players.at(0);
  if (!player) return;
  setText(ui.elements.homeScore, String(state.scores.at(0)));
  setText(ui.elements.awayScore, String(state.scores.at(1)));
  setText(
    ui.elements.role,
    state.mode !== "match" ? "PRACTICE" : playerPosition(state, player).code,
  );
  ui.elements.role.title = player.role;
  setText(
    ui.elements.handling,
    player.charging || player.curl !== 0 || player.grab || player.dummy !== 0
      ? handlingLabel(state, player)
      : "",
  );
  const guidance = depthGuidance(player);
  ui.elements.stickControls.classList.toggle("hidden", guidance !== undefined);
  ui.elements.bottomGuidance.classList.toggle("hidden", guidance === undefined);
  if (guidance) {
    setText(ui.elements.bottomTitle, guidance.title);
    setText(ui.elements.bottomDetail, guidance.detail);
    ui.elements.descendCue.classList.toggle("hidden", !guidance.descend);
  }
  const celebrating = state.restartTime > 0 && state.eventTime > 0;
  // A goal event has priority. A private player event has the next priority.
  const announcement = celebrating
    ? "GOAL!"
    : player.eventTime > 0
      ? player.event
      : state.eventTime > 0
        ? state.event
        : "";
  setText(ui.elements.event, announcement);
  ui.elements.event.classList.toggle("countdown", /^[123]$/.test(announcement));
  ui.elements.event.classList.toggle("goal-celebration", celebrating);
  ui.elements.event.classList.toggle(
    "white-goal",
    celebrating && state.event === "White scores",
  );
  ui.elements.event.dataset.score = celebrating
    ? `${state.scores.at(0)} — ${state.scores.at(1)}`
    : "";
  ui.elements.event.dataset.team = celebrating ? state.event : "";
  const reaction =
    state.restartTime > 0
      ? undefined
      : puckReaction(state, player, input.controls.pitch);
  ui.elements.knockdown.classList.toggle("hidden", reaction === undefined);
  setText(
    ui.elements.reactionLabel,
    reaction === "grab" ? "Grab" : "Knock down",
  );
  ui.elements.event.classList.toggle("visible", announcement !== "");
  if (document.body.classList.contains("show-performance"))
    setText(ui.elements.fps, `${Math.round(world.frameRate)} FPS`);
  ui.elements.charge.style.setProperty(
    "--charge",
    `${input.controls.charge * 100}%`,
  );
  ui.elements.charge.classList.toggle("visible", input.controls.charging);
  input.touch.update(state);
  if (state.mode === "playground")
    setText(
      ui.elements.labReadout,
      `${state.playground.slowMotion ? "¼× · " : ""}${state.puck.velocity.length().toFixed(1)} m/s · ${state.playground.peak.toFixed(2)} m lift · ${state.playground.distance.toFixed(1)} m range`,
    );
  drawMap(ui.map, state, ui.tactics);
};
