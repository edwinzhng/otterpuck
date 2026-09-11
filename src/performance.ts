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
  sample: (frame: number, cpu: number) => void;
  read: (
    render: { calls: number; triangles: number },
    memory: { geometries: number; textures: number },
  ) => FrameMetrics;
  reset: () => void;
} => {
  const frames = new Float64Array(600);
  const work = new Float64Array(600);
  const state = { cursor: 0, count: 0, frameTotal: 0, workTotal: 0 };
  return {
    reset: (): void => {
      frames.fill(0);
      work.fill(0);
      Object.assign(state, {
        cursor: 0,
        count: 0,
        frameTotal: 0,
        workTotal: 0,
      });
    },
    sample: (frame, cpu): void => {
      if (!(frame > 0 && frame < 250 && Number.isFinite(cpu) && cpu >= 0))
        return;
      state.frameTotal += frame - (frames.at(state.cursor) ?? 0);
      state.workTotal += cpu - (work.at(state.cursor) ?? 0);
      frames[state.cursor] = frame;
      work[state.cursor] = cpu;
      state.cursor = (state.cursor + 1) % frames.length;
      state.count = Math.min(state.count + 1, frames.length);
    },
    read: (render, memory): FrameMetrics => {
      const sorted = frames.slice(0, state.count).sort();
      return {
        fps: state.count
          ? 1000 / Math.max(1, state.frameTotal / state.count)
          : 0,
        p95: sorted.at(Math.floor(state.count * 0.95)) ?? 0,
        cpu: state.workTotal / Math.max(1, state.count),
        calls: render.calls,
        triangles: render.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
        samples: state.count,
      };
    },
  };
};
