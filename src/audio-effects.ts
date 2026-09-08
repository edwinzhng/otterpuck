import type { AudioCue } from "./audio-events";

export type SynthEffect = Exclude<AudioCue["kind"], "dive" | "surface">;

export const effectSamples = (
  kind: SynthEffect,
  variation: number,
  sampleRate: number,
): Float32Array => {
  const duration = kind === "tap" ? 0.11 : kind === "shot" ? 0.3 : 0.7;
  const random = { value: 1987 + variation * 7919, low: 0 };
  const pitch = 0.94 + variation * 0.04;
  return Float32Array.from(
    { length: Math.ceil(duration * sampleRate) },
    (_, index): number => {
      const t = index / sampleRate;
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
      const shimmer =
        random.low *
        Math.sin(Math.min(1, t / 0.7) * Math.PI) *
        Math.exp(-t * 4) *
        0.8;
      const chord = [330, 495, 660].reduce((sum, hz, voice): number => {
        const elapsed = Math.max(0, t - voice * 0.055);
        return (
          sum +
          Math.sin(elapsed * Math.PI * 2 * hz) *
            Math.min(1, elapsed / 0.008) *
            Math.exp(-elapsed * 8) *
            0.13
        );
      }, 0);
      return tap + shimmer + chord;
    },
  );
};

export const createEffectBuffers = (
  context: BaseAudioContext,
): Map<string, AudioBuffer> => {
  const buffers = new Map<string, AudioBuffer>();
  for (const kind of ["tap", "shot", "goal"] as const)
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
