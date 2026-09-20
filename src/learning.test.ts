import { describe, expect, test } from "bun:test";
import {
  advanceProgress,
  beginProgress,
  type LessonId,
  lessonFeedback,
  lessonIds,
  savedLesson,
} from "./learning-progress";
import { prepareLesson } from "./learning-setup";
import {
  createSimulation,
  resetPracticePuck,
  stepSimulation,
} from "./simulation";
import { freshControls, STEP } from "./types";

const exercise = (id: LessonId): { passed: boolean; value: number } => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Missing player");
  prepareLesson(state, id);
  const progress = beginProgress(state);
  const controls = freshControls();
  const result = { passed: false, value: 0 };
  for (const frame of Array.from({ length: 1200 }, (_, i): number => i)) {
    if (id === "swim") controls.forward = 1;
    if (id === "glance") controls.glance = frame < 10 ? -1 : 1;
    if (id === "grab" && frame === 12) controls.knockdown = true;
    if (id === "flick") controls.shot = frame === 60 || frame === 240 ? 0.7 : 0;
    if (id === "flick" && frame === 180) resetPracticePuck(state);
    if (id === "curl") controls.curl = 1;
    if (id === "reverse") controls.curl = -1;
    if (id === "dummy") {
      controls.dummy = 1;
      controls.dummyMode = true;
      controls.forward = 1;
      controls.lateral = 1;
    }
    if (id === "rise") controls.vertical = 1;
    if (id === "dive") controls.vertical = -1;
    const attemptedGrab = controls.knockdown;
    stepSimulation(state, controls, STEP);
    result.value = advanceProgress(
      id,
      progress,
      state,
      attemptedGrab,
      controls.glance,
    );
    if (result.value >= 1) {
      result.passed = true;
      break;
    }
  }
  return result;
};
const exercised: readonly LessonId[] = [
  "swim",
  "glance",
  "grab",
  "flick",
  "curl",
  "reverse",
  "dummy",
  "rise",
  "dive",
];
describe("learning exercises", () => {
  for (const id of exercised)
    test(id + " completes through gameplay", () =>
      expect(exercise(id).passed).toBe(true),
    );
  test("idle cannot complete puck skills", () => {
    const s = createSimulation("2-3-1", "2-3-1", "playground");
    for (const id of ["grab", "flick", "curl", "reverse", "dummy"] as const) {
      const p = beginProgress(s);
      expect(advanceProgress(id, p, s)).toBe(0);
    }
  });
  test("every lesson is practised", () => {
    for (const id of lessonIds) expect(exercised.includes(id)).toBe(true);
  });
  test("progress restoration rejects malformed values", () => {
    expect(savedLesson(String(lessonIds.length - 1))).toBe(
      lessonIds.length - 1,
    );
    for (const v of ["-1", String(lessonIds.length), "NaN", "1.5", null])
      expect(savedLesson(v)).toBe(0);
  });
});

test("success stays visible for 2.5 active seconds and survives further movement", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const progress = beginProgress(state);
  expect(lessonFeedback(progress, 2, 1)).toEqual({
    success: true,
    hint: false,
    advance: false,
  });
  expect(lessonFeedback(progress, 4.49, 0)).toEqual({
    success: true,
    hint: false,
    advance: false,
  });
  expect(lessonFeedback(progress, 4.5, 0)).toEqual({
    success: true,
    hint: false,
    advance: true,
  });
});
test("hints appear after ten active seconds and reset for a fresh attempt", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const progress = beginProgress(state);
  expect(lessonFeedback(progress, 9.99, 0).hint).toBe(false);
  expect(lessonFeedback(progress, 10, 0.5).hint).toBe(true);
  expect(lessonFeedback(progress, 11, 1).hint).toBe(false);
  state.time = 30;
  const retry = beginProgress(state);
  expect(lessonFeedback(retry, 30, 0).hint).toBe(false);
  expect(lessonFeedback(retry, 30, 0).success).toBe(false);
});
test("each curl requires 360 degrees in the correct direction", (): void => {
  for (const [id, direction] of [
    ["curl", 1],
    ["reverse", -1],
  ] as const) {
    const state = createSimulation("2-3-1", "2-3-1", "playground");
    const player = state.players.at(0);
    if (!player) throw new Error("Missing player");
    const progress = beginProgress(state);
    player.curl = direction;
    state.puck.controlOwner = player.id;
    for (const unused of Array.from({ length: 7 })) {
      void unused;
      player.yaw += (direction * Math.PI) / 4;
      expect(advanceProgress(id, progress, state)).toBeLessThan(1);
    }
    player.yaw += (direction * Math.PI) / 4;
    expect(advanceProgress(id, progress, state)).toBeCloseTo(1, 8);
  }
});
test("each flick fills exactly half the progress bar on release", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const progress = beginProgress(state);
  state.shots += 1;
  expect(advanceProgress("flick", progress, state)).toBe(0.5);
  state.shots += 1;
  expect(advanceProgress("flick", progress, state)).toBe(1);
});
test("dummy succeeds as soon as its sprint burst starts", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Missing player");
  const progress = beginProgress(state);
  player.dummy = 1;
  state.puck.controlOwner = player.id;
  player.position.z -= 2;
  expect(advanceProgress("dummy", progress, state)).toBeLessThan(1);
  player.sprint = true;
  player.dummyBurstUntil = 2;
  state.time = 1;
  expect(advanceProgress("dummy", progress, state)).toBe(1);
  state.time = 2;
  expect(advanceProgress("dummy", progress, state)).toBe(1);
  player.sprint = false;
  expect(advanceProgress("dummy", progress, state)).toBe(1);
});

test("grab starts loose even after carrying the puck through swim", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Missing player");
  state.puck.controlOwner = player.id;
  state.puck.controlKind = "carry";
  player.position.z = -3;
  prepareLesson(state, "grab");
  expect(state.puck.controlOwner).toBeUndefined();
  expect(state.puck.shotOwner).toBeUndefined();
  const progress = beginProgress(state);
  for (const unused of Array.from({ length: 60 })) {
    void unused;
    stepSimulation(state, freshControls(), STEP);
    expect(advanceProgress("grab", progress, state)).toBe(0);
  }
  expect(state.puck.controlOwner).toBeUndefined();
  expect(state.puck.position.z).toBeCloseTo(player.position.z - 0.8, 3);
});
