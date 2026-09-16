import { type PerspectiveCamera, Vector3 } from "three";
import type { Formation, Player, Simulation, TeamSize } from "./types";

export const formationPositions = {
  "3-3": ["CF", "LF", "RF", "LB", "CB", "RB"],
  "2-3-1": ["LF", "RF", "LW", "C", "RW", "B"],
  "1-3-2": ["F", "LW", "C", "RW", "LB", "RB"],
  "2-1": ["LF", "RF", "B"],
  "1-2": ["F", "LB", "RB"],
  "1-1": ["F", "B"],
} as const satisfies Record<Formation, readonly string[]>;

export const TEAM_SIZES = [6, 3, 2] as const satisfies readonly TeamSize[];

const sizeRosters = {
  6: ["2-3-1", "1-3-2", "3-3"],
  3: ["2-1", "1-2"],
  2: ["1-1"],
} as const satisfies Record<TeamSize, readonly Formation[]>;

export const sizeFormations = (size: TeamSize): readonly Formation[] =>
  sizeRosters[size];

export const teamSize = (formation: Formation): TeamSize =>
  TEAM_SIZES.find((size): boolean =>
    sizeRosters[size].some((candidate): boolean => candidate === formation),
  ) ?? 6;

export const sizeLabel = (size: TeamSize): string => `${size}v${size}`;

export const defaultFormation = (size: TeamSize): Formation =>
  sizeRosters[size].at(0) ?? "2-3-1";

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
