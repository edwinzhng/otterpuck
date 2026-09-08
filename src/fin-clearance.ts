import {
  type Bone,
  Box3,
  type Object3D,
  Quaternion,
  SkinnedMesh,
  Vector3,
} from "three";

type FinBounds = { bone: Bone; corners: Vector3[] };
export type FinClearance = { thigh: Bone; bounds: FinBounds[] }[];

export const createFinClearance = (
  model: Object3D,
  bones: Map<string, Bone>,
): FinClearance => {
  const bounds = new Map<Bone, Box3>();
  const point = new Vector3();
  model.traverse((mesh): void => {
    if (!(mesh instanceof SkinnedMesh)) return;
    const positions = mesh.geometry.getAttribute("position");
    const indices = mesh.geometry.getAttribute("skinIndex");
    const weights = mesh.geometry.getAttribute("skinWeight");
    for (const index of Array.from(
      { length: positions.count },
      (_, index): number => index,
    )) {
      for (const component of [0, 1, 2, 3]) {
        if (weights.getComponent(index, component) <= 0) continue;
        const boneIndex = indices.getComponent(index, component);
        const bone = mesh.skeleton.bones.at(boneIndex);
        const inverse = mesh.skeleton.boneInverses.at(boneIndex);
        if (
          !bone ||
          !inverse ||
          !/^(thigh|shin|foot|finTip)[LR]$/.test(bone.name)
        )
          continue;
        const box = bounds.get(bone) ?? new Box3();
        point
          .fromBufferAttribute(positions, index)
          .applyMatrix4(mesh.bindMatrix)
          .applyMatrix4(inverse);
        box.expandByPoint(point);
        bounds.set(bone, box);
      }
    }
  });
  return ["L", "R"].flatMap((side): FinClearance => {
    const thigh = bones.get(`thigh${side}`);
    if (!thigh) return [];
    return [
      {
        thigh,
        bounds: [...bounds]
          .filter(([bone]): boolean => bone.name.endsWith(side))
          .map(
            ([bone, box]): FinBounds => ({
              bone,
              corners: [box.min.x, box.max.x].flatMap((x): Vector3[] =>
                [box.min.y, box.max.y].flatMap((y): Vector3[] =>
                  [box.min.z, box.max.z].map(
                    (z): Vector3 => new Vector3(x, y, z),
                  ),
                ),
              ),
            }),
          ),
      },
    ];
  });
};

const hip = new Vector3();
const point = new Vector3();
const axis = new Vector3();
const rotation = new Quaternion();
const parentRotation = new Quaternion();

export const keepFinsAboveFloor = (legs: FinClearance, yaw: number): void => {
  for (const { thigh, bounds } of legs) {
    if (!thigh.parent) continue;
    thigh.getWorldPosition(hip);
    const correction = bounds.reduce(
      (angle, { bone, corners }): number =>
        corners.reduce((angle, corner): number => {
          point.copy(corner).applyMatrix4(bone.matrixWorld);
          if (point.y >= 0.035) return angle;
          const height = 0.008 + 0.027 * Math.exp((point.y - 0.035) / 0.027);
          point.sub(hip);
          const behind = Math.sin(yaw) * point.x + Math.cos(yaw) * point.z;
          if (behind <= 0.005) return angle;
          const radius = Math.hypot(point.y, behind);
          const required =
            Math.asin(Math.max(-1, Math.min(1, (height - hip.y) / radius))) -
            Math.atan2(point.y, behind);
          return Math.max(angle, required);
        }, angle),
      0,
    );
    if (correction <= 0) continue;
    thigh.parent.getWorldQuaternion(parentRotation).invert();
    axis.set(-Math.cos(yaw), 0, Math.sin(yaw)).applyQuaternion(parentRotation);
    thigh.quaternion.premultiply(rotation.setFromAxisAngle(axis, correction));
    thigh.updateMatrixWorld(true);
  }
};
