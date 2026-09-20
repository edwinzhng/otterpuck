import type { AudioCue } from "./audio-events";

export type SynthEffect = Exclude<AudioCue["kind"], "dive" | "surface">;

const envelope = (t: number, duration: number, release = 12): number =>
  Math.min(1, t / 0.006) *
  Math.exp(-Math.max(0, t - duration * 0.58) * release) *
  Math.min(1, Math.max(0, duration - t) / 0.04);

const arcadeTone = (t: number, frequency: number, duration: number): number => {
  if (t >= duration) return 0;
  const phase = t * Math.PI * 2 * frequency;
  return (
    (Math.sin(phase) * 0.2 + Math.sin(phase * 2) * 0.055) *
    envelope(t, duration, 18)
  );
};

const airHorn = (
  t: number,
  frequency: number,
  duration: number,
  brightness: number,
): number => {
  if (t < 0 || t >= duration) return 0;
  const phase = frequency * t * Math.PI * 2;
  const harmonic = (detune: number): number =>
    Array.from({ length: 11 }, (_, index): number => index + 1).reduce(
      (sum, multiple): number =>
        sum +
        Math.sin(phase * detune * multiple + multiple * 0.08) *
          (1 / multiple ** (0.72 + (1 - brightness) * 0.5)),
      0,
    );
  const body = harmonic(1) + harmonic(1.0045) * 0.36;
  const attack = Math.min(1, t / 0.045);
  const release = Math.min(1, Math.max(0, duration - t) / 0.18);
  const pressure = 0.9 + Math.min(1, t / 0.4) * 0.1;
  return Math.tanh(body * 1.35) * 0.42 * attack * release * pressure;
};

export const effectSamples = (
  kind: SynthEffect,
  variation: number,
  sampleRate: number,
): Float32Array => {
  const duration =
    kind === "tap"
      ? 0.11
      : kind === "shot"
        ? 0.3
        : kind === "countdown"
          ? 0.48
          : kind === "go"
            ? 0.82
            : 2;
  const random = { value: 1987 + variation * 7919, low: 0 };
  const pitch = 0.94 + variation * 0.04;
  return Float32Array.from(
    { length: Math.ceil(duration * sampleRate) },
    (_, index): number => {
      const t = index / sampleRate;
      if (kind === "countdown")
        return (
          arcadeTone(t, 440, duration) + arcadeTone(t, 220, duration) * 0.48
        );
      if (kind === "go")
        return (
          arcadeTone(t, 880, duration) + arcadeTone(t, 440, duration) * 0.62
        );
      random.value = (Math.imul(random.value, 1664525) + 1013904223) >>> 0;
      const noise = random.value / 2147483648 - 1;
      random.low += (noise - random.low) * 0.18;
      const attack = Math.min(1, t / 0.002);
      const click = (noise - random.low) * Math.exp(-t * 105) * 0.54;
      const body =
        (Math.sin(t * 2 * Math.PI * 280 * pitch) * 0.28 +
          Math.sin(t * 2 * Math.PI * 730 * pitch) * 0.17) *
        Math.exp(-t * 70);
      const tap = (click + body) * attack;
      if (kind === "tap") return tap;
      if (kind === "shot")
        return (
          tap * 0.85 +
          random.low *
            Math.sin(Math.min(1, t / 0.3) * Math.PI) *
            Math.exp(-t * 10) *
            1.7
        );
      const profile = [
        { frequency: 196, brightness: 0.9, breath: 0.065 },
        { frequency: 175, brightness: 1.15, breath: 0.085 },
        { frequency: 247, brightness: 0.72, breath: 0.05 },
      ][variation % 3] ?? { frequency: 196, brightness: 0.9, breath: 0.065 };
      const air =
        random.low *
        profile.breath *
        Math.min(1, t / 0.025) *
        Math.min(1, Math.max(0, duration - t) / 0.14);
      return airHorn(t, profile.frequency, duration, profile.brightness) + air;
    },
  );
};

export const createEffectBuffers = (
  context: BaseAudioContext,
): Map<string, AudioBuffer> => {
  const buffers = new Map<string, AudioBuffer>();
  for (const kind of ["tap", "shot", "countdown", "go", "goal"] as const)
    for (const variation of [0, 1, 2]) {
      const samples = effectSamples(kind, variation, context.sampleRate);
      const buffer = context.createBuffer(
        1,
        samples.length,
        context.sampleRate,
      );
      buffer.getChannelData(0).set(samples);
      buffers.set(`${kind}-${variation}`, buffer);
    }
  return buffers;
};
