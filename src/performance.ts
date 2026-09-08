export type FrameMetrics = {
  fps: number;
  p95: number;
  cpu: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  samples: number;
};
export const createFrameMeter = (): {
  sample: (
    frame: number,
    cpu: number,
    render: { calls: number; triangles: number },
    memory: { geometries: number; textures: number },
  ) => FrameMetrics;
  reset: () => void;
} => {
  const frames: number[] = [],
    work: number[] = [];
  return {
    reset: (): void => {
      frames.length = 0;
      work.length = 0;
    },
    sample: (frame, cpu, render, memory): FrameMetrics => {
      if (frame > 0 && frame < 250) {
        frames.push(frame);
        work.push(cpu);
      }
      if (frames.length > 600) {
        frames.shift();
        work.shift();
      }
      const sorted = [...frames].sort((a, b): number => a - b);
      const average = (values: number[]): number =>
        values.reduce((sum, value): number => sum + value, 0) /
        Math.max(1, values.length);
      return {
        fps: 1000 / Math.max(1, average(frames)),
        p95: sorted.at(Math.floor(sorted.length * 0.95)) ?? 0,
        cpu: average(work),
        calls: render.calls,
        triangles: render.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
        samples: frames.length,
      };
    },
  };
};
