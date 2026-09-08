import { clamp, type Simulation, SURFACE_HEIGHT } from "./types";

export type AudioCue = {
  kind: "tap" | "shot" | "dive" | "surface" | "goal";
  strength: number;
  gain: number;
  pan: number;
};

export type AudioEventTracker = {
  reset: (state: Simulation) => void;
  sample: (state: Simulation) => AudioCue[];
};

export const createAudioEventTracker = (): AudioEventTracker => {
  const previous: {
    contacts: number;
    shots: number;
    goals: number;
    time: number;
    touch: number | undefined;
    tapAt: number;
    splashAt: number;
    surface: boolean;
    speed: number;
  } = {
    contacts: 0,
    shots: 0,
    goals: 0,
    time: 0,
    touch: undefined,
    tapAt: -1,
    splashAt: -1,
    surface: false,
    speed: 0,
  };
  const reset = (state: Simulation): void => {
    const human = state.players.find((player): boolean => player.human);
    Object.assign(previous, {
      contacts: state.contacts,
      shots: state.shots,
      goals: state.scores[0] + state.scores[1],
      time: state.time,
      touch: state.puck.lastTouch,
      tapAt: -1,
      splashAt: -1,
      surface: human
        ? human.wallReady || human.position.y > SURFACE_HEIGHT - 0.08
        : false,
      speed: state.puck.velocity.length(),
    });
  };
  return {
    reset,
    sample: (state): AudioCue[] => {
      const human = state.players.find((player): boolean => player.human);
      if (!human) return [];
      if (
        state.time < previous.time ||
        state.contacts < previous.contacts ||
        state.shots < previous.shots
      ) {
        reset(state);
        return [];
      }
      const cues: AudioCue[] = [];
      const offset = state.puck.position.clone().sub(human.position);
      const distance = offset.length();
      const gain = distance > 8 ? 0 : 1 / (1 + distance * distance * 0.32);
      const pan = clamp(
        (offset.x * Math.cos(human.yaw) - offset.z * Math.sin(human.yaw)) / 3,
        -0.85,
        0.85,
      );
      const speed = state.puck.velocity.length();
      const shot = state.shots > previous.shots;
      const contact = state.contacts > previous.contacts;
      if (shot && gain > 0) {
        cues.push({
          kind: "shot",
          strength: clamp(speed / 5, 0.35, 1),
          gain,
          pan,
        });
        previous.tapAt = state.time;
      } else if (contact && state.time - previous.tapAt >= 0.12 && gain > 0) {
        const actor = state.players.find(
          (player): boolean => player.id === state.puck.lastTouch,
        );
        const newTouch = previous.touch !== state.puck.lastTouch;
        const impact = Math.max(
          Math.abs(speed - previous.speed),
          actor?.stickVelocity.length() ?? 0,
        );
        const held = state.puck.controlOwner === state.puck.lastTouch;
        if (newTouch || (!held && impact > 0.35)) {
          cues.push({
            kind: "tap",
            strength: clamp(impact / 4, 0.3, 1),
            gain,
            pan,
          });
          previous.tapAt = state.time;
        }
      }
      if (human.wallReady) previous.surface = true;
      else if (previous.surface && human.position.y < SURFACE_HEIGHT - 0.2) {
        if (state.time - previous.splashAt > 0.65) {
          cues.push({
            kind: "dive",
            strength: clamp(Math.abs(human.velocity.y) / 1.8, 0.55, 1),
            gain: 1,
            pan: 0,
          });
          previous.splashAt = state.time;
        }
        previous.surface = false;
      } else if (
        !previous.surface &&
        human.position.y > SURFACE_HEIGHT - 0.055
      ) {
        if (state.time - previous.splashAt > 0.65) {
          cues.push({ kind: "surface", strength: 0.6, gain: 1, pan: 0 });
          previous.splashAt = state.time;
        }
        previous.surface = true;
      }
      const goals = state.scores[0] + state.scores[1];
      if (goals > previous.goals)
        cues.push({ kind: "goal", strength: 1, gain: 1, pan: 0 });
      Object.assign(previous, {
        contacts: state.contacts,
        shots: state.shots,
        goals,
        time: state.time,
        touch: state.puck.lastTouch,
        speed,
      });
      return cues;
    },
  };
};
