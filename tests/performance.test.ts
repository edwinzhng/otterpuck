import { expect, test } from "bun:test";
import { createFrameMeter } from "../src/performance";

const render = { calls: 219, triangles: 734965 };
const memory = { geometries: 95, textures: 25 };

test("frame statistics retain the most recent 600 valid samples across ring wraps", (): void => {
  const meter = createFrameMeter();
  const samples = Array.from({ length: 1853 }, (_, index) => ({
    frame: 10 + (index % 35),
    cpu: 1 + (index % 7),
  }));
  for (const sample of samples) meter.sample(sample.frame, sample.cpu);
  meter.sample(0, 1);
  meter.sample(250, 1);
  meter.sample(16, Number.NaN);
  const expected = samples.slice(-600);
  const measured = meter.read(render, memory);
  expect(measured.fps).toBeCloseTo(
    600000 / expected.reduce((sum, sample): number => sum + sample.frame, 0),
    8,
  );
  expect(measured.cpu).toBeCloseTo(
    expected.reduce((sum, sample): number => sum + sample.cpu, 0) / 600,
    8,
  );
  expect(measured.p95).toBe(
    expected
      .map((sample): number => sample.frame)
      .sort((a, b): number => a - b)
      .at(570) ?? 0,
  );
  expect(measured.samples).toBe(600);
  expect(measured.calls).toBe(219);
  expect(meter.read(render, memory)).toEqual(measured);
  meter.reset();
  expect(meter.read(render, memory)).toEqual({
    fps: 0,
    p95: 0,
    cpu: 0,
    samples: 0,
    ...render,
    ...memory,
  });
  meter.sample(20, 2);
  expect(meter.read(render, memory)).toEqual({
    fps: 50,
    p95: 20,
    cpu: 2,
    samples: 1,
    ...render,
    ...memory,
  });
});
