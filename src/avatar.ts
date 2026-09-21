import {
  type AnimationClip,
  Bone,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import {
  createFinClearance,
  type FinClearance,
  keepFinsAboveFloor,
} from "./fin-clearance";
import {
  createFirstPersonArms,
  type FirstPersonArm,
} from "./first-person-arms";
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
  bendDirection: Vector3;
};
export type Avatar = {
  root: Group;
  model: Object3D;
  bones: Map<string, Bone>;
  arms: Map<string, Arm>;
  motion: SwimMotion;
  firstPersonArms: Map<string, FirstPersonArm>;
  finClearance: FinClearance;
  visibility: string;
  maxArmStretch: number;
  floorLift: number;
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
  let maxArmStretch = Number.POSITIVE_INFINITY;
  let floorLift = 0;
  model.traverse((object): void => {
    if (typeof object.userData.maxArmStretch === "number")
      maxArmStretch = object.userData.maxArmStretch;
    if (typeof object.userData.floorLift === "number")
      floorLift = object.userData.floorLift;
    if (object instanceof Bone)
      bones.set(object.name.replaceAll(".", ""), object);
  });
  const arms = new Map<string, Arm>();
  for (const side of ["L", "R"]) {
    const upper = bones.get(`arm${side}`),
      lower = bones.get(`forearm${side}`),
      paw = bones.get(`paw${side}`);
    if (upper && lower && paw && upper.parent) {
      const start = upper.getWorldPosition(new Vector3());
      const end = paw.getWorldPosition(new Vector3()).sub(start).normalize();
      const bendDirection = lower
        .getWorldPosition(new Vector3())
        .sub(start)
        .projectOnPlane(end)
        .normalize()
        .transformDirection(upper.parent.matrixWorld.clone().invert());
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
        bendDirection,
      });
    }
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
    maxArmStretch,
    floorLift,
  };
};

const aimDirection = new Vector3();
const aimAxis = new Vector3();
const aimInverse = new Matrix4();
const aimRotation = new Quaternion();
const reachStart = new Vector3();
const reachDelta = new Vector3();
const reachPole = new Vector3();
const reachElbow = new Vector3();
const reachEnd = new Vector3();
const reachDirection = new Vector3();
const reachScale = new Vector3();
const reachMatrix = new Matrix3();
const gripTarget = new Vector3();
const gripDelta = new Vector3();
const gripShoulder = new Vector3();
const gripOffset = new Vector3();
const freeTarget = new Vector3();

const aimBone = (bone: Bone, direction: Vector3): void => {
  if (!bone.parent) return;
  const localDirection = aimDirection
    .copy(direction)
    .transformDirection(aimInverse.copy(bone.parent.matrixWorld).invert());
  const current = aimAxis.set(0, 1, 0).applyQuaternion(bone.quaternion);
  bone.quaternion.premultiply(
    aimRotation.setFromUnitVectors(current, localDirection),
  );
  bone.updateMatrixWorld(true);
};

const reach = (arm: Arm, target: Vector3): void => {
  const parent = arm.upper.parent;
  if (!parent) return;
  const start = arm.upper.getWorldPosition(reachStart);
  const delta = reachDelta.copy(target).sub(start);
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
  const pole = reachPole
    .copy(arm.bendDirection)
    .transformDirection(parent.matrixWorld)
    .projectOnPlane(direction)
    .normalize();
  const along =
    (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const elbow = reachElbow
    .copy(start)
    .addScaledVector(direction, along)
    .addScaledVector(
      pole,
      Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)),
    );
  const end = reachEnd.copy(start).addScaledVector(direction, distance);
  arm.upper.scale.y = stretch;
  aimBone(arm.upper, reachDirection.copy(elbow).sub(start));
  aimBone(arm.lower, reachDirection.copy(end).sub(elbow));
  if (arm.lower.parent) {
    const inheritedScale = reachScale
      .set(0, 1, 0)
      .applyQuaternion(arm.lower.quaternion)
      .applyMatrix3(reachMatrix.setFromMatrix4(arm.lower.parent.matrixWorld))
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
  const sprintWeight = motion.actions.get("Sprint")?.getEffectiveWeight() ?? 0;
  model.rotation.set(
    (motion.pitch - (upWeight - downWeight) * 0.72) * (1 - bottom),
    -motion.turn * 0.018,
    motion.bank * (1 - bottom * 0.7),
  );
  // Keep clearance from the fixed gameplay grip when the body pitches or banks.
  model.position
    .set(
      0,
      0.045 + Math.min(0.06, downWeight * 0.14) + sprintWeight * 0.015,
      0.065,
    )
    .multiplyScalar(1 - bottom)
    .applyQuaternion(model.quaternion);
  root.position.y += floorApproach * 0.02 - bottom * (0.26 - avatar.floorLift);
  const side = player.handedness === "right" ? "R" : "L";
  const visibility = `${side}:${firstPerson}`;
  if (avatar.visibility !== visibility) {
    model.traverse((object): void => {
      if (!(object instanceof Mesh)) return;
      const equipment = /^GripPaw([LR])(?:Mitten|Cuff)$/.exec(object.name);
      if (object.name.startsWith("FirstPersonArm")) {
        object.visible = firstPerson && object.name === `FirstPersonArm${side}`;
      } else
        object.visible = equipment
          ? equipment.at(1) === side && !object.name.endsWith("Cuff")
          : !firstPerson;
    });
    avatar.visibility = visibility;
  }
  root.updateMatrixWorld(true);
  const arm = avatar.arms.get(side);
  if (!arm) return;
  const target = stick
    .localToWorld(gripTarget.copy(STICK_GRIP))
    .add(gripOffset.set(0, 0.03, 0).applyQuaternion(stick.quaternion));
  const delta = gripDelta
    .copy(target)
    .sub(arm.upper.getWorldPosition(gripShoulder));
  const maximumReach =
    (arm.upperLength + arm.lowerLength) * Math.min(3, avatar.maxArmStretch);
  const horizontalReach = Math.sqrt(
    Math.max(0.001, maximumReach ** 2 - delta.y ** 2),
  );
  const horizontalDistance = Math.hypot(delta.x, delta.z);
  if (horizontalDistance > horizontalReach) {
    root.position.add(
      delta.setY(0).multiplyScalar(1 - horizontalReach / horizontalDistance),
    );
    root.updateMatrixWorld(true);
  }
  // Compact characters follow the authoritative grip with their body, not elongated arms.
  gripOffset.copy(target).sub(arm.upper.getWorldPosition(gripShoulder));
  const naturalReach =
    (arm.upperLength + arm.lowerLength) * 0.995 * avatar.maxArmStretch;
  if (gripOffset.length() > naturalReach) {
    root.position.addScaledVector(
      gripOffset,
      (1 - naturalReach / gripOffset.length()) * (1 - floorApproach),
    );
    root.updateMatrixWorld(true);
  }
  keepFinsAboveFloor(avatar.finClearance, viewYaw);
  reach(arm, target);
  const freeArm = avatar.arms.get(side === "R" ? "L" : "R");
  if (freeArm) {
    const phase = motion.phase * Math.PI * 2;
    const activity = clamp(motion.speed / 1.3, 0, 1);
    model.localToWorld(
      freeTarget.set(
        side === "R" ? -0.15 : 0.15,
        -0.05 + Math.sin(phase - 0.8) * 0.006 * activity,
        -0.18 + Math.sin(phase) * 0.008 * activity,
      ),
    );
    freeTarget.y = Math.max(0.055, freeTarget.y);
    reach(freeArm, freeTarget);
  }
};
