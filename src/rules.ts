import type { Ruleset } from "./types";

export type Rules = {
  sprintGate: boolean;
  sprintFloor: number;
  sprintDrain: number;
  idleDrain: number;
  kickDrain: number;
  recovery: number;
  surfaceRecovery: number;
  surfaceSprint: number;
  emergencyRecovery: number;
  airSupply: number;
  airDrain: {
    idle: number;
    kick: number;
    engaged: number;
    curl: number;
  };
  airBase: number;
  airStamina: number;
  spentAirDrain: number;
  carveDrag: number;
  autoCurl: boolean;
  shielding: number;
  curlMouseTurn: number;
};

export const RULESETS: Record<Ruleset, Rules> = {
  alternative: {
    sprintGate: true,
    sprintFloor: 15,
    sprintDrain: 14,
    idleDrain: 0,
    kickDrain: 2.2,
    recovery: 6.4,
    surfaceRecovery: 10.5,
    surfaceSprint: 0.5,
    emergencyRecovery: 0.45,
    airSupply: 0.6,
    airDrain: {
      idle: 1.5,
      kick: 0.75,
      engaged: 3.8,
      curl: 0.44,
    },
    airBase: 4.2,
    airStamina: 8.8,
    spentAirDrain: 0,
    carveDrag: 0.12,
    autoCurl: true,
    shielding: 1,
    curlMouseTurn: 0.3,
  },
  original: {
    sprintGate: false,
    sprintFloor: 0,
    sprintDrain: 1.5,
    idleDrain: 0.2,
    kickDrain: 0,
    recovery: 0,
    surfaceRecovery: 10,
    surfaceSprint: 0,
    emergencyRecovery: 1,
    airSupply: 1,
    airDrain: {
      idle: 1.5,
      kick: 1.3,
      engaged: 5.2,
      curl: 0.6,
    },
    airBase: 10,
    airStamina: 3,
    spentAirDrain: 0.3,
    carveDrag: 0,
    autoCurl: false,
    shielding: 0,
    curlMouseTurn: 1,
  },
};
