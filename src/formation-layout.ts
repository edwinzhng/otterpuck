import { Vector3 } from "three";
import { formationPositions, playerPosition } from "./positions";
import {
  attackDirection,
  clamp,
  FLOOR_HEIGHT,
  type Formation,
  type Player,
  type Simulation,
  type Team,
} from "./types";

export const positionSide = (code: string): number =>
  code.startsWith("L") ? -1 : code.startsWith("R") ? 1 : 0;

export const wallLane = (formation: Formation, slot: number): number => {
  const lanes = {
    "3-3": [-0.55, -1.8, 1.8, -3.1, 0.55, 3.1],
    "2-3-1": [-1.15, 1.15, -2.4, 0, 2.4, 3.6],
    "1-3-2": [-0.55, -1.8, 0.55, 1.8, -3.1, 3.1],
    "2-1": [-1.15, 1.15, 0],
    "1-2": [0, -1.15, 1.15],
    "1-1": [-0.8, 0.8],
  } satisfies Record<Formation, number[]>;
  return lanes[formation].at(slot) ?? 0;
};

const countingCodes = (formation: Formation, part: string): number =>
  formationPositions[formation].filter((code): boolean => code.includes(part))
    .length;

export const strongPositionSide = (state: Simulation, team: Team): number =>
  state.strongSides[team] * -attackDirection(team);

export const formationTarget = (state: Simulation, player: Player): Vector3 => {
  const direction = attackDirection(player.team);
  const formation = state.formations[player.team];
  const code = playerPosition(state, player).code;
  const side = positionSide(code);
  const strongSide = strongPositionSide(state, player.team);
  const strong = side === strongSide;
  const lateralOrigin = clamp(state.puck.position.x * -direction, -5.1, 5.1);
  const depthOrigin = clamp(state.puck.position.z * direction, -8.7, 10.3);
  const forward = code.includes("F");
  const back = code.includes("B");
  const threeBacks = countingCodes(formation, "B") === 3 && back;
  const width = forward
    ? countingCodes(formation, "F") === 2
      ? 0.95
      : 1.25
    : 1.35;
  const diagonal = threeBacks && Math.abs(lateralOrigin) > 1.4;
  const lateral = diagonal
    ? lateralOrigin - strongSide * (strong ? 0.15 : side === 0 ? 1.2 : 2.25)
    : lateralOrigin + side * (back ? 1.05 : width);
  const depth = forward
    ? 1.35 + (side === 0 ? 0.12 : 0)
    : threeBacks
      ? strong
        ? -0.7
        : side === 0
          ? -1.65
          : -2.45
      : back
        ? code === "B"
          ? -2.7
          : strong
            ? -1.8
            : -2.45
        : strong
          ? -0.6
          : -1.5;
  return new Vector3(
    clamp(lateral * -direction, -6.8, 6.8),
    FLOOR_HEIGHT,
    (depthOrigin + depth) * direction,
  );
};

export const rotationPartners = (
  state: Simulation,
  player: Player,
): Player[] => {
  const formation = state.formations[player.team];
  const code = playerPosition(state, player).code;
  const strong = strongPositionSide(state, player.team) > 0 ? "R" : "L";
  const weak = strong === "R" ? "L" : "R";
  const rosters: Record<Formation, Record<string, readonly string[]>> = {
    "3-3": {
      LF: ["CF"],
      RF: ["CF"],
      CF: [`${strong}F`, `${weak}F`],
      LB: ["CB"],
      RB: ["CB"],
      CB: [`${strong}B`],
    },
    "2-3-1": {
      LF: ["RF"],
      RF: ["LF"],
      LW: ["C"],
      RW: ["C"],
      C: [`${strong}W`],
      B: ["C"],
    },
    "1-3-2": {
      F: [`${strong}W`],
      LW: ["C"],
      RW: ["C"],
      C: [`${strong}W`],
      LB: ["RB"],
      RB: ["LB"],
    },
    "2-1": { LF: ["RF"], RF: ["LF"], B: [`${strong}F`] },
    "1-2": { F: [`${strong}B`], LB: ["RB"], RB: ["LB"] },
    "1-1": { F: ["B"], B: ["F"] },
  };
  const partners = rosters[formation];
  return (partners[code] ?? []).flatMap((partner): Player[] => {
    const teammate = state.players.find(
      (other): boolean =>
        other.team === player.team &&
        playerPosition(state, other).code === partner,
    );
    return teammate ? [teammate] : [];
  });
};
