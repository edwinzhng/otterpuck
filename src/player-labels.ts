import { type PerspectiveCamera, Vector3 } from "three";
import { playerPosition, projectPlayerLabel, teamSize } from "./positions";
import { projectPuckDirection } from "./puck-indicator";
import type { Simulation } from "./types";
import type { UI } from "./ui-types";

const indicatorPosition = new Vector3();
const labelPosition = new Vector3();

export const renderPlayerLabels = (
  ui: UI,
  state: Simulation,
  camera: PerspectiveCamera,
  alpha: number,
  pixelRatio: number,
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
  for (const [id, label] of ui.playerLabels.entries()) {
    const player = state.players.at(id);
    const point =
      showPositions &&
      state.mode === "match" &&
      player &&
      !player.human &&
      player.team === state.players.at(0)?.team
        ? projectPlayerLabel(player, camera, alpha, labelPosition)
        : undefined;
    label.classList.toggle("hidden", !point);
    if (!point || !player) continue;
    const position = playerPosition(state, player);
    if (label.textContent !== position.name) label.textContent = position.name;
    label.title = position.name;
    label.classList.toggle("team-white", player.team === 1);
    label.style.transform = `translate(${((point.x + 1) * width) / 2}px, ${((1 - point.y) * height) / 2}px) translate(-50%, -50%)`;
  }
};
