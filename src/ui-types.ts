import type {
  BotDifficulty,
  Formation,
  GameMode,
  Handedness,
  Ruleset,
  Species,
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
  position: number;
  difficulty: BotDifficulty;
  ruleset: Ruleset;
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
    labReadout: HTMLElement;
    homeScore: HTMLElement;
    awayScore: HTMLElement;
    air: HTMLElement;
    airLabel: HTMLElement;
    stamina: HTMLElement;
    event: HTMLElement;
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
