import type { Ruleset } from "./types";

// Heart rate model, in beats per minute. The heart moves toward a target set
// by effort and slows back toward rest, so it converges instead of climbing
// without end. Air use and refill follow the heart rate.
export type HeartRules = {
  rest: number;
  swim: number;
  sprint: number;
  // Playing the puck and curling add to the target on top of swimming.
  handling: number;
  curl: number;
  // Time constants, in seconds. The heart rises slowly while swimming and
  // faster in a sprint. Fitness shortens the fall back to rest.
  swimRise: number;
  sprintRise: number;
  fall: number;
  // Air use underwater at rest, in percent per second. Each `airGrowth` beats
  // above rest multiplies it by e.
  restAirUse: number;
  airGrowth: number;
  // Each `refillFalloff` beats above rest divide the surface refill by e.
  refillFalloff: number;
};

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
  // Only rulesets with a heart rate model it. Without one, air follows kick
  // effort and stamina.
  heart: HeartRules | undefined;
};

export const RULESETS: Record<Ruleset, Rules> = {
  alternative: {
    sprintGate: true,
    sprintFloor: 15,
    sprintDrain: 14,
    idleDrain: 0,
    kickDrain: 2.2,
    recovery: 5,
    surfaceRecovery: 8,
    surfaceSprint: 0.5,
    emergencyRecovery: 0.45,
    airSupply: 0.48,
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
    // A full tank lasts about 40 s at 70, 15 s at 120 and 5 s at 180.
    heart: {
      rest: 70,
      swim: 120,
      sprint: 180,
      handling: 15,
      curl: 30,
      swimRise: 10,
      sprintRise: 4,
      fall: 6,
      restAirUse: 2.5,
      airGrowth: 52.5,
      refillFalloff: 100,
    },
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
    heart: undefined,
  },
};
