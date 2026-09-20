import { effectSamples, type SynthEffect } from "../src/audio-effects";

const sampleRate = 44_100;

const wave = (samples: Float32Array): Uint8Array => {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index++)
      bytes[offset + index] = value.charCodeAt(index);
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index): void => {
    view.setInt16(
      44 + index * 2,
      Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
      true,
    );
  });
  return bytes;
};

const renderTimeline = async (
  path: string,
  segments: ReadonlyArray<{
    at: number;
    kind: SynthEffect;
    variation: number;
  }>,
): Promise<void> => {
  const rendered = segments.map(({ at, kind, variation }) => ({
    at: Math.round(at * sampleRate),
    samples: effectSamples(kind, variation, sampleRate),
  }));
  const samples = new Float32Array(
    rendered.reduce(
      (length, segment): number =>
        Math.max(length, segment.at + segment.samples.length),
      0,
    ),
  );
  for (const segment of rendered) samples.set(segment.samples, segment.at);
  await Bun.write(path, wave(samples));
};

await renderTimeline("/tmp/otterpuck-faceoff-v3.wav", [
  { at: 0, kind: "countdown", variation: 0 },
  { at: 1, kind: "countdown", variation: 0 },
  { at: 2, kind: "countdown", variation: 0 },
  { at: 3, kind: "go", variation: 0 },
]);
await renderTimeline("/tmp/otterpuck-goal-a-single.wav", [
  { at: 0, kind: "goal", variation: 0 },
]);
await renderTimeline("/tmp/otterpuck-goal-b-double.wav", [
  { at: 0, kind: "goal", variation: 1 },
]);
await renderTimeline("/tmp/otterpuck-goal-c-deep.wav", [
  { at: 0, kind: "goal", variation: 2 },
]);
await renderTimeline("/tmp/otterpuck-goal-v4-arena.wav", [
  { at: 0, kind: "goal", variation: 0 },
]);
await renderTimeline("/tmp/otterpuck-goal-v5-brass.wav", [
  { at: 0, kind: "goal", variation: 0 },
]);
await renderTimeline("/tmp/otterpuck-goal-v6-foghorn.wav", [
  { at: 0, kind: "goal", variation: 0 },
]);
await renderTimeline("/tmp/otterpuck-goal-v7-buzzy.wav", [
  { at: 0, kind: "goal", variation: 0 },
]);
await renderTimeline("/tmp/otterpuck-goal-v8-high-buzz.wav", [
  { at: 0, kind: "goal", variation: 0 },
]);
await renderTimeline("/tmp/otterpuck-goal-v9-airhorn-a.wav", [
  { at: 0, kind: "goal", variation: 0 },
]);
await renderTimeline("/tmp/otterpuck-goal-v9-airhorn-b.wav", [
  { at: 0, kind: "goal", variation: 1 },
]);
await renderTimeline("/tmp/otterpuck-goal-v9-airhorn-c.wav", [
  { at: 0, kind: "goal", variation: 2 },
]);
await renderTimeline("/tmp/otterpuck-goal-v10-selected.wav", [
  { at: 0, kind: "goal", variation: 1 },
]);
await renderTimeline("/tmp/otterpuck-goal-v11-steady.wav", [
  { at: 0, kind: "goal", variation: 1 },
]);
