export const GOAL_BACK = 12.47;
export const GOAL_PROFILE = [
  [0.36, 0.004, 1.125],
  [0.18, 0.018, 1.125],
  [0.165, 0.018, 1.125],
  [0.14, 0.006, 1.125],
  [0.035, 0.006, 1.125],
  [0.015, 0.145, 1.125],
] as const;
export const goalRampHeight = (depth: number): number =>
  0.004 + (0.36 - depth) * (0.014 / 0.18);
export const GOAL_VERTICES: readonly (readonly number[])[] = [
  ...[-1, 1].flatMap((side): number[][] =>
    GOAL_PROFILE.map(([depth, height, width]): number[] => [
      side * width,
      depth,
      height,
    ]),
  ),
  [-1.345, 0.035, goalRampHeight(0.035)],
  [-1.345, 0.14, goalRampHeight(0.14)],
  [1.345, 0.035, goalRampHeight(0.035)],
  [1.345, 0.14, goalRampHeight(0.14)],
  [-1.125, 0.035, goalRampHeight(0.035)],
  [-1.125, 0.14, goalRampHeight(0.14)],
  [1.125, 0.035, goalRampHeight(0.035)],
  [1.125, 0.14, goalRampHeight(0.14)],
];
export const GOAL_FACES: readonly (readonly number[])[] = [
  [0, 1, 7, 6],
  [1, 2, 8, 7],
  [2, 3, 9, 8],
  [3, 4, 10, 9],
  [4, 5, 11, 10],
  [5, 16, 12],
  [16, 17, 13, 12],
  [17, 0, 13],
  [17, 1, 0],
  [4, 3, 17, 16],
  [3, 2, 1, 17],
  [11, 14, 18],
  [18, 14, 15, 19],
  [19, 15, 6],
  [19, 6, 7],
  [10, 18, 19, 9],
  [9, 19, 7, 8],
];
export const goalContact = (
  x: number,
  z: number,
): { height: number; slope: number; lateralSlope: number } => {
  const depth = GOAL_BACK - Math.abs(z);
  if (depth < 0.015 || depth > 0.36 || Math.abs(x) > 1.345)
    return { height: 0, slope: 0, lateralSlope: 0 };
  for (const face of GOAL_FACES) {
    const a = GOAL_VERTICES.at(face.at(0) ?? -1);
    if (!a) continue;
    for (const index of Array.from(
      { length: face.length - 2 },
      (_, i): number => i + 1,
    )) {
      const b = GOAL_VERTICES.at(face.at(index) ?? -1);
      const c = GOAL_VERTICES.at(face.at(index + 1) ?? -1);
      if (!b || !c) continue;
      const [ax = 0, az = 0, ay = 0] = a;
      const [bx = 0, bz = 0, by = 0] = b;
      const [cx = 0, cz = 0, cy = 0] = c;
      const det = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
      if (Math.abs(det) < 1e-9) continue;
      const u = ((x - ax) * (cz - az) - (cx - ax) * (depth - az)) / det;
      const v = ((bx - ax) * (depth - az) - (x - ax) * (bz - az)) / det;
      if (u < -1e-7 || v < -1e-7 || u + v > 1.0000001) continue;
      return {
        height: ay + u * (by - ay) + v * (cy - ay) + 0.002,
        lateralSlope: ((by - ay) * (cz - az) - (cy - ay) * (bz - az)) / det,
        slope: ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / det,
      };
    }
  }
  return { height: 0, slope: 0, lateralSlope: 0 };
};
