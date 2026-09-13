import { type PerspectiveCamera, Vector3 } from "three";
import type { Formation, Player, Simulation } from "./types";

export const formationPositions = {
  "3-3": ["CF", "LF", "RF", "LB", "CB", "RB"],
  "2-3-1": ["LF", "RF", "LW", "C", "RW", "B"],
  "1-3-2": ["F", "LW", "C", "RW", "LB", "RB"],
} as const satisfies Record<Formation, readonly string[]>;

const positionNames = {
  F: "Forward",
  LF: "Left forward",
  CF: "Center forward",
  RF: "Right forward",
  LW: "Left wing",
  C: "Center",
  RW: "Right wing",
  B: "Back",
  LB: "Left back",
  CB: "Center back",
  RB: "Right back",
} as const;

export const formationChoices = (
  formation: Formation,
): { slot: number; code: string; name: string }[] =>
  formationPositions[formation].map(
    (code, slot): { slot: number; code: string; name: string } => ({
      slot,
      code,
      name: positionNames[code],
    }),
  );

export const playerPosition = (
  state: Simulation,
  player: Player,
): { code: string; name: string } => {
  const code =
    formationPositions[state.formations[player.team]].at(player.slot) ?? "F";
  return { code, name: positionNames[code] };
};

export const projectPlayerLabel = (
  player: Player,
  camera: PerspectiveCamera,
  alpha: number,
  target = new Vector3(),
): Vector3 | undefined => {
  const anchor = target.lerpVectors(player.previous, player.position, alpha);
  anchor.y += 0.3;
  const distance = anchor.distanceTo(camera.position);
  if (distance > 15 || distance < 0.65) return undefined;
  const point = anchor.project(camera);
  return point.z > -1 &&
    point.z < 1 &&
    Math.abs(point.x) < 0.95 &&
    Math.abs(point.y) < 0.93
    ? point
    : undefined;
};
