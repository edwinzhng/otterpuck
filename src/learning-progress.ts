import {
  angleDifference,
  FLOOR_HEIGHT,
  PUCK_HEIGHT,
  type Simulation,
  SURFACE_HEIGHT,
} from "./types";
export const lessonIds = [
  "swim",
  "grab",
  "shot",
  "curl",
  "reverse",
  "dummy",
  "rise",
  "dive",
] as const;
export type LessonId = (typeof lessonIds)[number];
export type LessonProgress = {
  value: number;
  lastX: number;
  lastZ: number;
  lastYaw: number;
  shots: number;
  action: boolean;
  startedAt: number;
  successAt: number | undefined;
  burstEndsAt: number | undefined;
};
export const beginProgress = (state: Simulation): LessonProgress => ({
  value: 0,
  lastX: state.players.at(0)?.position.x ?? 0,
  lastZ: state.players.at(0)?.position.z ?? 0,
  lastYaw: state.players.at(0)?.yaw ?? 0,
  shots: state.shots,
  action: false,
  startedAt: state.time,
  successAt: undefined,
  burstEndsAt: undefined,
});
export const advanceProgress = (
  id: LessonId,
  progress: LessonProgress,
  state: Simulation,
  attemptedGrab = false,
): number => {
  const player = state.players.at(0);
  if (!player) return 0;
  const distance = Math.hypot(
    player.position.x - progress.lastX,
    player.position.z - progress.lastZ,
  );
  const turn = Math.abs(angleDifference(player.yaw, progress.lastYaw));
  const owns = state.puck.controlOwner === player.id;
  if (id === "swim") progress.value += distance / 2;
  if (id === "grab") {
    progress.action ||= attemptedGrab || Boolean(player.grab);
    if (progress.action && owns) progress.value = 1;
  }
  if (id === "shot") {
    progress.action ||= state.shots > progress.shots && player.shotFired;
    if (progress.action)
      progress.value =
        state.puck.position.y <= PUCK_HEIGHT + 0.006 && player.shotTime <= 0
          ? 1
          : 0.85;
  }
  if (
    ((id === "curl" && player.curl > 0) ||
      (id === "reverse" && player.curl < 0)) &&
    owns
  )
    progress.value += turn / (Math.PI * 2);
  if (id === "dummy") {
    progress.action ||= player.dummy !== 0 && owns;
    if (progress.action && owns) {
      progress.value += distance / 1.2;
      if (player.sprint && player.dummyBurstUntil > state.time) {
        progress.burstEndsAt = player.dummyBurstUntil;
        progress.value = 1;
      }
    }
  }
  if (id === "rise")
    progress.value =
      (player.position.y - FLOOR_HEIGHT) /
      (SURFACE_HEIGHT - FLOOR_HEIGHT - 0.06);
  if (id === "dive")
    progress.value =
      (SURFACE_HEIGHT - player.position.y) /
      (SURFACE_HEIGHT - FLOOR_HEIGHT - 0.06);
  progress.lastX = player.position.x;
  progress.lastZ = player.position.z;
  progress.lastYaw = player.yaw;
  const awaitingBurst =
    id === "dummy" && (progress.burstEndsAt === undefined || !owns);
  return Math.max(0, Math.min(awaitingBurst ? 0.95 : 1, progress.value));
};
export const LESSON_SUCCESS_SECONDS = 2.5;
export const LESSON_HINT_SECONDS = 10;
export const lessonFeedback = (
  progress: LessonProgress,
  time: number,
  amount: number,
): { success: boolean; hint: boolean; advance: boolean } => {
  if (amount >= 1 && progress.successAt === undefined)
    progress.successAt = time;
  const success = progress.successAt !== undefined;
  return {
    success,
    hint: !success && time - progress.startedAt >= LESSON_HINT_SECONDS,
    advance:
      progress.successAt !== undefined &&
      time - progress.successAt >= LESSON_SUCCESS_SECONDS,
  };
};
export const savedLesson = (value: string | null): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed < lessonIds.length
    ? parsed
    : 0;
};
