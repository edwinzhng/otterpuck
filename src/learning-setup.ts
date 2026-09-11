import type { LessonId } from "./learning-progress";
import { resetPracticePuck } from "./simulation";
import {
  FLOOR_HEIGHT,
  PUCK_HEIGHT,
  type Simulation,
  SURFACE_HEIGHT,
} from "./types";
export const prepareLesson = (state: Simulation, id: LessonId): void => {
  const player = state.players.at(0);
  if (!player) return;
  player.position.set(0, id === "dive" ? SURFACE_HEIGHT : FLOOR_HEIGHT, 2);
  player.previous.copy(player.position);
  player.yaw = 0;
  player.previousYaw = 0;
  player.bodyPitch = 0;
  player.previousBodyPitch = 0;
  player.mode = "playing";
  player.air = 100;
  player.curlBlockedUntil = 0;
  resetPracticePuck(state);
  if (id === "grab") {
    state.puck.position.set(
      player.position.x,
      PUCK_HEIGHT,
      player.position.z - 0.8,
    );
    state.puck.previous.copy(state.puck.position);
    state.playground.origin.copy(state.puck.position);
  }
};
