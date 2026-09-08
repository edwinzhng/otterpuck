import { BufferGeometry, type Object3D, SkinnedMesh } from "three";

const armGeometry = new WeakMap<BufferGeometry, Map<string, BufferGeometry>>();

const closeArmBoundary = (indices: number[]): number[] => {
  const edges = new Map<string, readonly [number, number]>();
  const surfaceEdges = new Set<string>();
  for (const triangle of Array.from(
    { length: indices.length / 3 },
    (_, i): number => i,
  )) {
    const corners = indices.slice(triangle * 3, triangle * 3 + 3);
    for (const [index, start] of corners.entries()) {
      const end = corners.at((index + 1) % 3);
      if (end === undefined) continue;
      const key = `${Math.min(start, end)}:${Math.max(start, end)}`;
      surfaceEdges.add(key);
      if (edges.has(key)) edges.delete(key);
      else edges.set(key, [start, end]);
    }
  }
  const next = new Map(
    [...edges.values()].map(([start, end]): [number, number] => [start, end]),
  );
  const caps: number[] = [];
  for (const start of [...next.keys()]) {
    if (!next.has(start)) continue;
    const ring = [start];
    while (next.has(ring.at(-1) ?? -1)) {
      const last = ring.at(-1) ?? -1;
      const end = next.get(last);
      next.delete(last);
      if (end === undefined || end === start) break;
      ring.push(end);
    }
    const pivot = Math.max(
      0,
      ring.findIndex((anchor, index): boolean =>
        Array.from(
          { length: Math.max(0, ring.length - 3) },
          (_, i): number => ring.at((index + i + 2) % ring.length) ?? anchor,
        ).every(
          (other): boolean =>
            !surfaceEdges.has(
              `${Math.min(anchor, other)}:${Math.max(anchor, other)}`,
            ),
        ),
      ),
    );
    const cap = [...ring.slice(pivot), ...ring.slice(0, pivot)];
    for (const index of Array.from(
      { length: Math.max(0, ring.length - 2) },
      (_, i): number => i + 1,
    )) {
      const a = cap.at(index),
        b = cap.at(index + 1),
        anchor = cap.at(0);
      if (a !== undefined && b !== undefined && anchor !== undefined)
        caps.push(anchor, b, a);
    }
  }
  return [...indices, ...caps];
};

const isolateArm = (source: SkinnedMesh, side: string): BufferGeometry => {
  const cached =
    armGeometry.get(source.geometry) ?? new Map<string, BufferGeometry>();
  armGeometry.set(source.geometry, cached);
  const existing = cached.get(side);
  if (existing) return existing;
  const bones = new Set(
    source.skeleton.bones.flatMap((bone, index): number[] =>
      [`arm${side}`, `forearm${side}`, `paw${side}`].includes(
        bone.name.replaceAll(".", ""),
      )
        ? [index]
        : [],
    ),
  );
  const skinIndex = source.geometry.getAttribute("skinIndex");
  const skinWeight = source.geometry.getAttribute("skinWeight");
  const belongsToArm = (vertex: number): boolean =>
    (bones.has(skinIndex.getX(vertex)) ? skinWeight.getX(vertex) : 0) +
      (bones.has(skinIndex.getY(vertex)) ? skinWeight.getY(vertex) : 0) +
      (bones.has(skinIndex.getZ(vertex)) ? skinWeight.getZ(vertex) : 0) +
      (bones.has(skinIndex.getW(vertex)) ? skinWeight.getW(vertex) : 0) >
    0.12;
  const sourceIndex = source.geometry.getIndex();
  const count =
    sourceIndex?.count ?? source.geometry.getAttribute("position").count;
  const indices = Array.from({ length: count / 3 }, (_, triangle): number[] => {
    const vertices = [0, 1, 2].map(
      (corner): number =>
        sourceIndex?.getX(triangle * 3 + corner) ?? triangle * 3 + corner,
    );
    return vertices.every(belongsToArm) ? vertices : [];
  }).flat();
  const geometry = new BufferGeometry();
  for (const [name, attribute] of Object.entries(source.geometry.attributes))
    geometry.setAttribute(name, attribute);
  const positions = source.geometry.getAttribute("position");
  const vertexKeys = new Map<string, number>();
  const welded = new Map<number, number>();
  for (const index of new Set(indices)) {
    const key = [
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index),
      skinIndex.getX(index),
      skinWeight.getX(index),
      skinIndex.getY(index),
      skinWeight.getY(index),
      skinIndex.getZ(index),
      skinWeight.getZ(index),
      skinIndex.getW(index),
      skinWeight.getW(index),
    ]
      .map((value): number => Math.round(value * 100000))
      .join(":");
    const canonical = vertexKeys.get(key) ?? index;
    vertexKeys.set(key, canonical);
    welded.set(index, canonical);
  }
  geometry.setIndex(
    closeArmBoundary(
      indices.map((index): number => welded.get(index) ?? index),
    ),
  );
  geometry.boundingBox = source.geometry.boundingBox?.clone() ?? null;
  geometry.boundingSphere = source.geometry.boundingSphere?.clone() ?? null;
  cached.set(side, geometry);
  return geometry;
};

export const createFirstPersonArms = (
  model: Object3D,
): Map<string, SkinnedMesh[]> => {
  const parts = new Map<string, SkinnedMesh[]>();
  const sources: SkinnedMesh[] = [];
  model.traverse((object): void => {
    if (
      object instanceof SkinnedMesh &&
      object.name.startsWith("ContinuousCharacterMesh")
    )
      sources.push(object);
  });
  for (const side of ["L", "R"]) {
    parts.set(
      side,
      sources.flatMap((source): SkinnedMesh[] => {
        const geometry = isolateArm(source, side);
        if (!geometry.getIndex()?.count) return [];
        const mesh = new SkinnedMesh(geometry, source.material);
        mesh.name = `FirstPersonArm${side}`;
        mesh.position.copy(source.position);
        mesh.quaternion.copy(source.quaternion);
        mesh.scale.copy(source.scale);
        mesh.bindMode = source.bindMode;
        mesh.bind(source.skeleton, source.bindMatrix);
        mesh.visible = false;
        source.parent?.add(mesh);
        return [mesh];
      }),
    );
  }
  return parts;
};
