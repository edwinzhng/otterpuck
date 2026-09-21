import { playerPosition } from "./positions";
import type { Simulation } from "./types";

export const drawMap = (
  map: HTMLCanvasElement,
  state: Simulation,
  tactics: boolean,
): void => {
  const context = map.getContext("2d");
  if (!context) return;
  const scale = map.width / 17;
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
  if (tactics) {
    for (const player of state.players) {
      if (player.team !== state.players.at(0)?.team) continue;
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
        ? "#202b36"
        : "#ffffff";
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
    context.fillStyle = player.team === 0 ? "#202b36" : "#ffffff";
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
