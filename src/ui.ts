import { depthGuidance } from "./depth";
import { getElement } from "./dom";

export { getElement } from "./dom";
export { createUI } from "./ui-setup";

import { handlingLabel, puckReaction } from "./handling";
import type { Input } from "./input";
import { playerPosition, projectPlayerLabel } from "./positions";
import type {
  BotDifficulty,
  Formation,
  GameMode,
  Handedness,
  Player,
  Simulation,
  Species,
} from "./types";
import type { World } from "./world";

export type UI = {
  canvas: HTMLCanvasElement;
  menu: HTMLElement;
  hud: HTMLElement;
  pause: HTMLElement;
  start: HTMLButtonElement;
  status: HTMLElement;
  arena: HTMLSelectElement;
  species: Species;
  position: number;
  difficulty: BotDifficulty;
  formation: Formation;
  opposition: Formation;
  mode: GameMode;
  duration: number;
  handedness: Handedness;
  tactics: boolean;
  sound: boolean;
  music: boolean;
  map: HTMLCanvasElement;
  playerLabels: HTMLElement[];
  elements: {
    clock: HTMLElement;
    homeScore: HTMLElement;
    awayScore: HTMLElement;
    air: HTMLElement;
    airLabel: HTMLElement;
    event: HTMLElement;
    role: HTMLElement;
    handling: HTMLElement;
    fps: HTMLElement;
    charge: HTMLElement;
    matchLabel: HTMLElement;
    knockdown: HTMLElement;
    reactionLabel: HTMLElement;
    stickControls: HTMLElement;
    bottomGuidance: HTMLElement;
    bottomTitle: HTMLElement;
    bottomDetail: HTMLElement;
    descendCue: HTMLElement;
  };
};

const drawMap = (ui: UI, state: Simulation): void => {
  const context = ui.map.getContext("2d");
  if (!context) return;
  const scale = ui.map.width / 17;
  const mapX = (x: number): number => (x + 8.5) * scale;
  const mapY = (z: number): number => (z + 13.3) * scale;
  context.clearRect(0, 0, 320, 500);
  context.fillStyle = "rgba(4,43,54,0.48)";
  context.fillRect(mapX(-7.5), mapY(-12.5), 15 * scale, 25 * scale);
  context.strokeStyle = "rgba(216,242,230,0.25)";
  context.lineWidth = 1.2;
  context.strokeRect(mapX(-7.5), mapY(-12.5), 15 * scale, 25 * scale);
  context.beginPath();
  context.moveTo(mapX(-7.5), mapY(0));
  context.lineTo(mapX(7.5), mapY(0));
  context.stroke();
  context.fillStyle = "#ffac8a";
  context.fillRect(mapX(-1.5), mapY(-12.5), 3 * scale, 4);
  context.fillStyle = "#bcecda";
  context.fillRect(mapX(-1.5), mapY(12.5) - 4, 3 * scale, 4);
  if (ui.tactics) {
    for (const player of state.players.filter(
      (p: Player): boolean => p.team === state.players.at(0)?.team,
    )) {
      context.strokeStyle = "rgba(207,240,147,0.45)";
      context.setLineDash([3, 5]);
      context.beginPath();
      context.moveTo(mapX(player.position.x), mapY(player.position.z));
      context.lineTo(mapX(player.target.x), mapY(player.target.z));
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = "rgba(224,244,238,.55)";
      context.font = "11px system-ui";
      context.fillText(
        player.duty,
        mapX(player.target.x) + 5,
        mapY(player.target.z) - 6,
      );
    }
  }
  for (const player of state.players) {
    const x = mapX(player.position.x);
    const y = mapY(player.position.z);
    context.strokeStyle = player.human
      ? "#dcf994"
      : player.team === 0
        ? "#63c8ff"
        : "#ff888f";
    context.fillStyle = context.strokeStyle;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, player.human ? 10 : 8, 0, Math.PI * 2);
    if (player.position.y < 1) context.fill();
    else context.stroke();
    if (player.human) {
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(
        x - Math.sin(player.yaw) * 11,
        y - Math.cos(player.yaw) * 11,
      );
      context.stroke();
      context.beginPath();
      context.arc(x, y, 11, 0, Math.PI * 2);
      context.stroke();
    }
    context.font = "800 18px system-ui";
    context.textAlign = "center";
    context.lineWidth = 4;
    context.strokeStyle = "#071827";
    const code =
      player.team === state.players.at(0)?.team
        ? playerPosition(state, player).code
        : "";
    const labelY = player.position.z < -11 ? y + 25 : y - 12;
    context.strokeText(code, x, labelY);
    context.fillStyle = player.team === 0 ? "#d5ffff" : "#ffd2bb";
    context.fillText(code, x, labelY);
    context.textAlign = "start";
  }
  context.fillStyle = "#fff2bd";
  context.beginPath();
  context.arc(
    mapX(state.puck.position.x),
    mapY(state.puck.position.z),
    3,
    0,
    Math.PI * 2,
  );
  context.fill();
};

export const renderPlayerLabels = (
  ui: UI,
  state: Simulation,
  world: World,
  alpha: number,
): void => {
  for (const [id, label] of ui.playerLabels.entries()) {
    const player = state.players.at(id);
    const point =
      state.mode === "match" &&
      player &&
      !player.human &&
      player.team === state.players.at(0)?.team
        ? projectPlayerLabel(player, world.camera, alpha)
        : undefined;
    label.classList.toggle("hidden", !point);
    if (!point || !player) continue;
    const position = playerPosition(state, player);
    if (label.textContent !== position.name) label.textContent = position.name;
    label.title = position.name;
    label.classList.toggle("beaver", player.team === 1);
    label.style.left = `${(point.x + 1) * 50}%`;
    label.style.top = `${(1 - point.y) * 50}%`;
  }
};

export const updateUI = (
  ui: UI,
  state: Simulation,
  input: Input,
  world: World,
): void => {
  const player = state.players.at(0);
  if (!player) return;
  const minutes = Math.floor(state.seconds / 60);
  const seconds = Math.floor(state.seconds % 60)
    .toString()
    .padStart(2, "0");
  ui.elements.clock.textContent =
    state.mode !== "match"
      ? "∞"
      : `${minutes.toString().padStart(2, "0")}:${seconds}`;
  ui.elements.homeScore.textContent = String(state.scores.at(0));
  ui.elements.awayScore.textContent = String(state.scores.at(1));
  ui.elements.air.textContent = String(Math.ceil(player.air));
  ui.elements.airLabel.textContent = player.emergency
    ? "Recovering"
    : player.mode === "recovering"
      ? "Breathing"
      : "Air";
  ui.hud.style.setProperty("--air", `${player.air}%`);
  ui.hud.classList.toggle("low-air", player.air < 26);
  ui.elements.role.textContent =
    state.mode !== "match" ? "PRACTICE" : playerPosition(state, player).code;
  ui.elements.role.title = player.role;
  ui.elements.handling.textContent =
    player.charging ||
    player.curl !== 0 ||
    player.grab ||
    player.puckMove ||
    player.dummy !== 0
      ? handlingLabel(state, player)
      : "";
  const guidance = depthGuidance(player);
  ui.elements.stickControls.classList.toggle("hidden", guidance !== undefined);
  ui.elements.bottomGuidance.classList.toggle("hidden", guidance === undefined);
  if (guidance) {
    ui.elements.bottomTitle.textContent = guidance.title;
    ui.elements.bottomDetail.textContent =
      world.headLift > 0.25 && !player.emergency
        ? input.touch.enabled
          ? "Release Rise to lower your head · Dive to descend"
          : "Release Space to lower your head · Ctrl to dive"
        : input.touch.enabled
          ? guidance.detail.replace("Space", "Rise").replace("Ctrl", "Dive")
          : guidance.detail;
    ui.elements.descendCue.classList.toggle("hidden", !guidance.descend);
  }
  ui.elements.event.textContent = state.eventTime > 0 ? state.event : "";
  const reaction = puckReaction(state, player, input.controls.pitch);
  ui.elements.knockdown.classList.toggle("hidden", reaction === undefined);
  ui.elements.reactionLabel.textContent =
    reaction === "grab" ? "Grab" : "Knock down";
  ui.elements.event.classList.toggle("visible", state.eventTime > 0);
  ui.elements.fps.textContent = `${Math.round(world.frameRate)} FPS`;
  ui.elements.charge.style.setProperty(
    "--charge",
    `${input.controls.charge * 100}%`,
  );
  ui.elements.charge.classList.toggle("visible", input.controls.charging);
  input.touch.update(state);
  if (state.mode === "playground")
    getElement("#lab-readout", HTMLElement).textContent =
      `${state.playground.slowMotion ? "¼× · " : ""}${state.puck.velocity.length().toFixed(1)} m/s · ${state.playground.peak.toFixed(2)} m lift · ${state.playground.distance.toFixed(1)} m range`;
  drawMap(ui, state);
};
