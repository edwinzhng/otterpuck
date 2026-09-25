import type { SwimTurn } from "./swim-turn";
import type {
  Attributes,
  BotDifficulty,
  Formation,
  GameMode,
  Handedness,
  Species,
  Team,
  TeamSize,
} from "./types";

export type UI = {
  canvas: HTMLCanvasElement;
  menu: HTMLElement;
  hud: HTMLElement;
  pause: HTMLElement;
  start: HTMLButtonElement;
  status: HTMLElement;
  arena: HTMLSelectElement;
  species: Species;
  team: Team;
  position: number;
  difficulty: BotDifficulty;
  swimTurn: SwimTurn;
  attributes: Attributes;
  autoCurl: boolean;
  formation: Formation;
  opposition: Formation;
  teamSize: TeamSize;
  mode: GameMode;
  duration: number;
  handedness: Handedness;
  tactics: boolean;
  sound: boolean;
  music: boolean;
  map: HTMLCanvasElement;
  playerLabels: HTMLElement[];
  // Where the HUD heart is in its beat, from 0 to 1, and when it last moved.
  heartBeat: { phase: number; time: number | undefined };
  elements: {
    clock: HTMLElement;
    labReadout: HTMLElement;
    homeScore: HTMLElement;
    homeScorers: HTMLElement;
    awayScorers: HTMLElement;
    awayScore: HTMLElement;
    air: HTMLElement;
    airLabel: HTMLElement;
    stamina: HTMLElement;
    staminaValue: HTMLElement;
    heartRow: HTMLElement;
    heartRate: HTMLElement;
    event: HTMLElement;
    turnover: HTMLElement;
    turnoverTitle: HTMLElement;
    puckIndicator: HTMLElement;
    role: HTMLElement;
    handling: HTMLElement;
    fps: HTMLElement;
    tackleLog: HTMLElement;
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
