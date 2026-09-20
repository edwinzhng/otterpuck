import { expect, test } from "bun:test";
import { effectSamples } from "../src/audio-effects";
import { createAudioEventTracker } from "../src/audio-events";
import {
  createSimulation,
  requestShot,
  stepSimulation,
  updateStick,
} from "../src/simulation";
import { puckSeat } from "../src/stick";
import {
  FLOOR_HEIGHT,
  freshControls,
  PUCK_HEIGHT,
  STEP,
  SURFACE_HEIGHT,
} from "../src/types";

test("a real puck pickup and flick trigger distinct cues; a held puck stays quiet", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const human = state.players.at(0);
  if (!human) throw new Error("Missing swimmer");
  const tracker = createAudioEventTracker();
  state.puck.position.copy(puckSeat(human)).setY(PUCK_HEIGHT);
  tracker.reset(state);
  const cues = [];
  for (const unused of Array.from({ length: 60 })) {
    void unused;
    stepSimulation(state, freshControls(), STEP);
    cues.push(...tracker.sample(state));
  }
  expect(cues.filter((cue): boolean => cue.kind === "tap")).toHaveLength(1);
  expect(
    requestShot(human, 0.8, state.puck.position.clone().sub(human.position)),
  ).toBe(true);
  for (const unused of Array.from({ length: 120 })) {
    void unused;
    stepSimulation(state, freshControls(), STEP);
    cues.push(...tracker.sample(state));
  }
  expect(cues.filter((cue): boolean => cue.kind === "shot")).toHaveLength(1);
  expect(cues.filter((cue): boolean => cue.kind === "dive")).toHaveLength(0);
});

test("surface crossings trigger one splash, without repeating from head bob or silent floor diving", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const human = state.players.at(0);
  if (!human) throw new Error("Missing swimmer");
  const tracker = createAudioEventTracker();
  tracker.reset(state);
  expect(tracker.sample(state)).toEqual([]);
  human.position.y = SURFACE_HEIGHT;
  state.time = 1;
  expect(tracker.sample(state).map((cue): string => cue.kind)).toEqual([
    "surface",
  ]);
  for (const height of [
    SURFACE_HEIGHT - 0.04,
    SURFACE_HEIGHT,
    SURFACE_HEIGHT - 0.1,
  ]) {
    human.position.y = height;
    state.time += 0.5;
    expect(tracker.sample(state)).toEqual([]);
  }
  human.position.y = SURFACE_HEIGHT - 0.25;
  human.velocity.y = -1.5;
  state.time += 0.5;
  expect(tracker.sample(state).map((cue): string => cue.kind)).toEqual([
    "dive",
  ]);
  human.position.y = FLOOR_HEIGHT;
  expect(tracker.sample(state)).toEqual([]);
  tracker.reset(state);
  expect(tracker.sample(state)).toEqual([]);
});

test("contacts are spatially attenuated and throttled instead of firing at the simulation rate", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const human = state.players.at(0);
  if (!human) throw new Error("Missing swimmer");
  const tracker = createAudioEventTracker();
  human.position.set(0, FLOOR_HEIGHT, 0);
  human.yaw = 0;
  updateStick(human, STEP);
  tracker.reset(state);
  state.puck.position.set(2, PUCK_HEIGHT, 0);
  state.puck.velocity.set(3, 0, 0);
  state.puck.lastTouch = human.id;
  state.contacts++;
  state.time = 1;
  const distant = tracker.sample(state).at(0);
  expect(distant?.kind).toBe("tap");
  expect(distant?.pan).toBeGreaterThan(0);
  expect(distant?.gain).toBeLessThan(0.5);
  for (const unused of Array.from({ length: 10 })) {
    void unused;
    state.contacts++;
    state.time += STEP;
    expect(tracker.sample(state)).toEqual([]);
  }
  state.time += 0.2;
  state.shots++;
  state.contacts++;
  expect(tracker.sample(state).map((cue): string => cue.kind)).toEqual([
    "shot",
  ]);
  state.puck.position.x = 12;
  state.shots++;
  expect(tracker.sample(state)).toEqual([]);
});

test("synthesized effects have a bounded transient and a quiet tail", (): void => {
  for (const kind of [
    "click",
    "tap",
    "shot",
    "countdown",
    "go",
    "goal",
  ] as const) {
    const samples = effectSamples(kind, 1, 24000);
    expect(samples.every(Number.isFinite)).toBe(true);
    expect(
      samples.reduce(
        (peak, sample): number => Math.max(peak, Math.abs(sample)),
        0,
      ),
    ).toBeLessThan(0.95);
    const rms = Math.sqrt(
      samples.reduce((sum, sample): number => sum + sample * sample, 0) /
        samples.length,
    );
    expect(rms).toBeGreaterThan(0.015);
    expect(Math.abs(samples.at(0) ?? 1)).toBeLessThan(0.001);
    expect(Math.abs(samples.at(-1) ?? 1)).toBeLessThan(0.01);
    expect(samples.length / 24000).toBeLessThanOrEqual(2);
  }
});

test("faceoffs play each count once, then play the strike cue", (): void => {
  const state = createSimulation();
  const tracker = createAudioEventTracker();
  tracker.reset(state);
  const kinds: string[] = [];
  for (let index = 0; index < 460; index++) {
    stepSimulation(state, freshControls(), STEP);
    kinds.push(...tracker.sample(state).map((cue): string => cue.kind));
  }
  expect(kinds.filter((kind): boolean => kind === "countdown")).toHaveLength(3);
  expect(kinds.filter((kind): boolean => kind === "go")).toHaveLength(1);
});

test("water assets have immediate onset and remain short mono PCM samples", async (): Promise<void> => {
  for (const kind of ["dive", "surface"]) {
    const buffer = Buffer.from(
      await Bun.file(`public/audio/${kind}.wav`).arrayBuffer(),
    );
    expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buffer.readUInt16LE(22)).toBe(1);
    expect(buffer.readUInt32LE(24)).toBe(22050);
    const samples = Array.from(
      { length: buffer.readUInt32LE(40) / 2 },
      (_, index): number => buffer.readInt16LE(44 + index * 2) / 32768,
    );
    expect(
      samples.findIndex((sample): boolean => Math.abs(sample) > 0.015) / 22050,
    ).toBeLessThan(0.04);
    expect(samples.length / 22050).toBeLessThan(1.2);
  }
});
