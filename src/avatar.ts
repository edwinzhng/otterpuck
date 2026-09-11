import {
  type AnimationClip,
  Bone,
  Group,
  Matrix3,
  Mesh,
  type Object3D,
  Quaternion,
  type SkinnedMesh,
  Vector3,
} from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import {
  createFinClearance,
  type FinClearance,
  keepFinsAboveFloor,
} from "./fin-clearance";
import { createFirstPersonArms } from "./first-person-arms";
import { createSwimMotion, type SwimMotion, updateSwimMotion } from "./motion";
import { shareCharacterSkeleton } from "./skeletons";
import { STICK_GRIP } from "./stick";
import { clamp, FLOOR_HEIGHT, type Player } from "./types";

type Arm = {
  upper: Bone;
  lower: Bone;
  paw: Bone;
  upperLength: number;
  lowerLength: number;
  lowerPosition: Vector3;
  pawPosition: Vector3;
  upperRotation: Quaternion;
  lowerRotation: Quaternion;
  pawRotation: Quaternion;
};
export type Avatar = {
  root: Group;
  model: Object3D;
  bones: Map<string, Bone>;
  arms: Map<string, Arm>;
  motion: SwimMotion;
  firstPersonArms: Map<string, SkinnedMesh[]>;
  finClearance: FinClearance;
  visibility: string;
};

export const createAvatar = (
  template: Object3D,
  clips: AnimationClip[],
): Avatar => {
  const root = new Group();
  const model = clone(template);
  shareCharacterSkeleton(model);
  root.add(model);
  root.updateMatrixWorld(true);
  const bones = new Map<string, Bone>();
  model.traverse((object): void => {
    if (object instanceof Bone)
      bones.set(object.name.replaceAll(".", ""), object);
  });
  const arms = new Map<string, Arm>();
  for (const side of ["L", "R"]) {
    const upper = bones.get(`arm${side}`),
      lower = bones.get(`forearm${side}`),
      paw = bones.get(`paw${side}`);
    if (upper && lower && paw)
      arms.set(side, {
        upper,
        lower,
        paw,
        upperLength: upper
          .getWorldPosition(new Vector3())
          .distanceTo(lower.getWorldPosition(new Vector3())),
        lowerLength: lower
          .getWorldPosition(new Vector3())
          .distanceTo(paw.getWorldPosition(new Vector3())),
        lowerPosition: lower.position.clone(),
        pawPosition: paw.position.clone(),
        upperRotation: upper.quaternion.clone(),
        lowerRotation: lower.quaternion.clone(),
        pawRotation: paw.quaternion.clone(),
      });
  }
  return {
    root,
    model,
    bones,
    arms,
    motion: createSwimMotion(model, clips),
    finClearance: createFinClearance(model, bones),
    firstPersonArms: createFirstPersonArms(model),
    visibility: "",
  };
};

const aimBone = (bone: Bone, direction: Vector3): void => {
  if (!bone.parent) return;
  const localDirection = direction
    .clone()
    .transformDirection(bone.parent.matrixWorld.clone().invert());
  const current = new Vector3(0, 1, 0).applyQuaternion(bone.quaternion);
  bone.quaternion.premultiply(
    new Quaternion().setFromUnitVectors(current, localDirection),
  );
  bone.updateMatrixWorld(true);
};

const reach = (arm: Arm, target: Vector3, side: number, yaw: number): void => {
  const start = arm.upper.getWorldPosition(new Vector3());
  const delta = target.clone().sub(start);
  const stretch = Math.max(
    1,
    delta.length() / ((arm.upperLength + arm.lowerLength) * 0.995),
  );
  const upperLength = arm.upperLength * stretch;
  const lowerLength = arm.lowerLength * stretch;
  const distance = clamp(
    delta.length(),
    0.005,
    (upperLength + lowerLength) * 0.995,
  );
  const direction = delta.normalize();
  const pole = new Vector3(side, 0.1, 0.15)
    .applyAxisAngle(new Vector3(0, 1, 0), yaw)
    .projectOnPlane(direction)
    .normalize();
  const along =
    (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const elbow = start
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(
      pole,
      Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)),
    );
  const end = start.clone().addScaledVector(direction, distance);
  arm.upper.scale.y = stretch;
  aimBone(arm.upper, elbow.clone().sub(start));
  aimBone(arm.lower, end.clone().sub(elbow));
  if (arm.lower.parent) {
    const inheritedScale = new Vector3(0, 1, 0)
      .applyQuaternion(arm.lower.quaternion)
      .applyMatrix3(new Matrix3().setFromMatrix4(arm.lower.parent.matrixWorld))
      .length();
    arm.lower.scale.y = stretch / inheritedScale;
    arm.lower.updateMatrixWorld(true);
  }
  if (arm.paw.parent) arm.paw.position.copy(arm.paw.parent.worldToLocal(end));
  arm.paw.updateMatrixWorld(true);
};

export const poseAvatar = (
  avatar: Avatar,
  player: Player,
  stick: Object3D,
  time: number,
  alpha: number,
  firstPerson = false,
): void => {
  const { root, model, bones, motion } = avatar;
  root.position.lerpVectors(player.previous, player.position, alpha);
  const viewYaw =
    player.previousYaw + (player.yaw - player.previousYaw) * alpha;
  root.rotation.set(0, viewYaw, 0);
  model.position.set(0, 0, 0);
  for (const arm of avatar.arms.values()) {
    arm.upper.scale.set(1, 1, 1);
    arm.lower.scale.set(1, 1, 1);
    arm.lower.position.copy(arm.lowerPosition);
    arm.paw.position.copy(arm.pawPosition);
    arm.upper.quaternion.copy(arm.upperRotation);
    arm.lower.quaternion.copy(arm.lowerRotation);
    arm.paw.quaternion.copy(arm.pawRotation);
  }
  updateSwimMotion(motion, bones, player, time);
  const floorApproach = 1 - clamp((root.position.y - FLOOR_HEIGHT) / 0.4, 0, 1);
  const bottom =
    floorApproach * (1 - clamp(Math.abs(player.bodyPitch) / 0.6, 0, 1));
  const upWeight = motion.actions.get("SwimUp")?.getEffectiveWeight() ?? 0;
  const downWeight = motion.actions.get("SwimDown")?.getEffectiveWeight() ?? 0;
  model.rotation.set(
    (motion.pitch - (upWeight - downWeight) * 0.28) * (1 - bottom),
    -motion.turn * 0.018,
    motion.bank * (1 - bottom * 0.7),
  );
  root.position.y += floorApproach * 0.02 - bottom * 0.26;
  const side = player.handedness === "right" ? "R" : "L";
  const visibility = `${side}:${firstPerson}`;
  if (avatar.visibility !== visibility) {
    model.traverse((object): void => {
      if (!(object instanceof Mesh)) return;
      const equipment = /^GripPaw([LR])(?:Mitten|Cuff)$/.exec(object.name);
      if (object.name.startsWith("FirstPersonArm")) {
        object.visible = firstPerson && object.name === `FirstPersonArm${side}`;
      } else
        object.visible = equipment ? equipment.at(1) === side : !firstPerson;
    });
    avatar.visibility = visibility;
  }
  root.updateMatrixWorld(true);
  const arm = avatar.arms.get(side);
  if (!arm) return;
  const target = stick
    .localToWorld(STICK_GRIP.clone())
    .add(new Vector3(0, 0.03, 0).applyQuaternion(stick.quaternion));
  const delta = target.clone().sub(arm.upper.getWorldPosition(new Vector3()));
  const maximumReach = (arm.upperLength + arm.lowerLength) * 3;
  const horizontalReach = Math.sqrt(
    Math.max(0.001, maximumReach ** 2 - delta.y ** 2),
  );
  const horizontalDistance = Math.hypot(delta.x, delta.z);
  if (horizontalDistance > horizontalReach)
    root.position.add(
      delta.setY(0).multiplyScalar(1 - horizontalReach / horizontalDistance),
    );
  root.updateMatrixWorld(true);
  keepFinsAboveFloor(avatar.finClearance, viewYaw);
  reach(arm, target, side === "R" ? 1 : -1, viewYaw);
  const freeArm = avatar.arms.get(side === "R" ? "L" : "R");
  if (freeArm && bottom > 0.001) {
    const restingPaw = new Vector3(side === "R" ? -0.15 : 0.15, 0, -0.26)
      .applyAxisAngle(new Vector3(0, 1, 0), viewYaw)
      .add(root.position)
      .setY(0.055);
    const freeTarget = freeArm.paw
      .getWorldPosition(new Vector3())
      .lerp(restingPaw, bottom);
    reach(freeArm, freeTarget, side === "R" ? -1 : 1, viewYaw);
  }
};
