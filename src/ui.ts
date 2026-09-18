import { depthGuidance } from "./depth";
import { setText } from "./dom";
import { handlingLabel, puckReaction } from "./handling";
import type { Input } from "./input";
import { drawMap } from "./minimap";
import { playerPosition } from "./positions";
import type { Simulation } from "./types";
import type { UI } from "./ui-types";

export { getElement } from "./dom";
export { createUI } from "./ui-setup";
export type { UI } from "./ui-types";

export const updateUI = (
  ui: UI,
  state: Simulation,
  input: Input,
  world: { headLift: number; frameRate: number },
): void => {
  const player = state.players.at(0);
  if (!player) return;
  const minutes = Math.floor(state.seconds / 60);
  const seconds = Math.floor(state.seconds % 60)
    .toString()
    .padStart(2, "0");
  setText(
    ui.elements.clock,
    state.mode !== "match"
      ? "∞"
      : `${minutes.toString().padStart(2, "0")}:${seconds}`,
  );
  setText(ui.elements.homeScore, String(state.scores.at(0)));
  setText(ui.elements.awayScore, String(state.scores.at(1)));
  setText(ui.elements.air, String(Math.ceil(player.air)));
  setText(
    ui.elements.airLabel,
    player.emergency
      ? "Recovering"
      : player.mode === "recovering"
        ? "Breathing"
        : "Air",
  );
  ui.hud.style.setProperty("--air", `${player.air}%`);
  ui.hud.classList.toggle("low-air", player.air < 26);
  ui.hud.style.setProperty("--stamina", `${player.stamina}%`);
  setText(ui.elements.staminaValue, String(Math.ceil(player.stamina)));
  ui.elements.stamina.classList.toggle("spent", player.stamina < 25);
  setText(
    ui.elements.role,
    state.mode !== "match" ? "PRACTICE" : playerPosition(state, player).code,
  );
  ui.elements.role.title = player.role;
  setText(
    ui.elements.handling,
    player.charging ||
      player.curl !== 0 ||
      player.grab ||
      player.puckMove ||
      player.dummy !== 0
      ? handlingLabel(state, player)
      : "",
  );
  const guidance = depthGuidance(player);
  ui.elements.stickControls.classList.toggle("hidden", guidance !== undefined);
  ui.elements.bottomGuidance.classList.toggle("hidden", guidance === undefined);
  if (guidance) {
    setText(ui.elements.bottomTitle, guidance.title);
    setText(
      ui.elements.bottomDetail,
      world.headLift > 0.25 && !player.emergency
        ? input.touch.enabled
          ? "Release Rise to lower your head · Dive to descend"
          : "Release Space to lower your head · Ctrl to dive"
        : input.touch.enabled
          ? guidance.detail.replace("Space", "Rise").replace("Ctrl", "Dive")
          : guidance.detail,
    );
    ui.elements.descendCue.classList.toggle("hidden", !guidance.descend);
  }
  const celebrating = state.restartTime > 0 && state.eventTime > 0;
  // A player's own announcement outranks the match-wide one, except while the
  // room is celebrating a goal.
  const announcement = celebrating
    ? "GOAL!"
    : player.eventTime > 0
      ? player.event
      : state.eventTime > 0
        ? state.event
        : "";
  setText(ui.elements.event, announcement);
  ui.elements.event.classList.toggle("goal-celebration", celebrating);
  ui.elements.event.classList.toggle(
    "beaver-goal",
    celebrating && state.event === "Beavers score",
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
