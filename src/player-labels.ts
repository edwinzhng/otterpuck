import { type PerspectiveCamera, Vector3 } from "three";
import type { PlayerNames } from "./player-names";
import { playerPosition, projectPlayerLabel, teamSize } from "./positions";
import { projectPuckDirection } from "./puck-indicator";
import type { Player, Simulation } from "./types";
import type { UI } from "./ui-types";

const indicatorPosition = new Vector3();
const labelPosition = new Vector3();

export const renderPlayerLabels = (
  ui: UI,
  state: Simulation,
  camera: PerspectiveCamera,
  alpha: number,
  pixelRatio: number,
  names: PlayerNames,
): void => {
  const width = ui.canvas.width / pixelRatio;
  const height = ui.canvas.height / pixelRatio;
  const showPositions = teamSize(state.formations[0]) !== 2;
  const direction =
    state.restartTime > 0 || state.finished
      ? undefined
      : projectPuckDirection(
          indicatorPosition.lerpVectors(
            state.puck.previous,
            state.puck.position,
            alpha,
          ),
          camera,
          width,
          height,
        );
  ui.elements.puckIndicator.classList.toggle("hidden", !direction);
  if (direction) {
    ui.elements.puckIndicator.style.transform = `translate(${direction.x}px, ${direction.y}px) rotate(${direction.angle}rad)`;
  }
  const local = state.players.at(0);
  for (const [id, label] of ui.playerLabels.entries()) {
    const player = state.players.at(id);
    const content =
      state.mode === "match" && player && player !== local
        ? labelContent(state, player, local, names, showPositions)
        : undefined;
    const point =
      content && player
        ? projectPlayerLabel(player, camera, alpha, labelPosition)
        : undefined;
    label.classList.toggle("hidden", !point);
    if (!point || !player || !content) continue;
    if (label.textContent !== content.name) label.textContent = content.name;
    label.title = content.name;
    label.classList.toggle("team-white", player.team === 1);
    // The tag is the bot's air tank. Its fill shows the air left.
    const air = content.air === undefined ? "" : String(Math.ceil(content.air));
    if (label.dataset.air !== air) {
      label.dataset.air = air;
      label.classList.toggle("air-tank", air !== "");
      label.classList.toggle("low-air", air !== "" && Number(air) < 26);
      label.style.setProperty("--air", `${air}%`);
    }
    label.style.transform = `translate(${((point.x + 1) * width) / 2}px, ${((1 - point.y) * height) / 2}px) translate(-50%, -50%)`;
  }
};

// A teammate bot shows its air and its position. The air of the other team
// stays hidden, as it is in a real match. Human players show their room name.
// A label with nothing to show is not shown.
const labelContent = (
  state: Simulation,
  player: Player,
  local: Player | undefined,
  names: PlayerNames,
  showPositions: boolean,
): { name: string; air: number | undefined } | undefined => {
  if (player.human) {
    const name = names.get(player.id);
    return name ? { name, air: undefined } : undefined;
  }
  const teammate = player.team === local?.team;
  if (!teammate) return undefined;
  return {
    name: showPositions ? playerPosition(state, player).name : "",
    air: player.air,
  };
};
