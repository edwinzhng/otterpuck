import {
  type AnimationAction,
  type AnimationClip,
  AnimationMixer,
  type Bone,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import { angleDifference, clamp, type Player } from "./types";

export type SwimMotion = {
  mixer: AnimationMixer;
  actions: Map<string, AnimationAction>;
  time: number | undefined;
  yaw: number | undefined;
  turn: number;
  tailTurn: number;
  speed: number;
  acceleration: number;
  pitch: number;
  bank: number;
  phase: number;
};

export const createSwimMotion = (
  model: Object3D,
  clips: AnimationClip[],
): SwimMotion => {
  const mixer = new AnimationMixer(model);
  return {
    mixer,
    actions: new Map(
      clips.map((clip): [string, AnimationAction] => {
        const action = mixer.clipAction(clip);
        action.setEffectiveWeight(clip.name === "Float" ? 1 : 0).play();
        return [clip.name, action];
      }),
    ),
    time: undefined,
    yaw: undefined,
    turn: 0,
    tailTurn: 0,
    speed: 0,
    acceleration: 0,
    pitch: 0,
    bank: 0,
    phase: 0,
  };
};

const turnAxis = new Vector3(0, 0, 1);
const pitchAxis = new Vector3(1, 0, 0);
const offset = new Quaternion();
const bend = (
  bones: Map<string, Bone>,
  name: string,
  axis: Vector3,
  angle: number,
): void => {
  bones.get(name)?.quaternion.multiply(offset.setFromAxisAngle(axis, angle));
};

export const updateSwimMotion = (
  motion: SwimMotion,
  bones: Map<string, Bone>,
  player: Player,
  time: number,
): void => {
  const dt = clamp(time - (motion.time ?? time - 1 / 60), 0, 0.08);
  const speed = player.velocity.length();
  const turn = clamp(
    angleDifference(player.yaw, motion.yaw ?? player.yaw) /
      Math.max(dt, 1 / 240),
    -4,
    4,
  );
  const follow = 1 - Math.exp(-9 * dt);
  motion.acceleration +=
    (clamp((speed - motion.speed) / Math.max(dt, 1 / 240), -8, 8) -
      motion.acceleration) *
    follow;
  motion.speed = speed;
  motion.turn += (turn - motion.turn) * follow;
  motion.tailTurn += (motion.turn - motion.tailTurn) * (1 - Math.exp(-4 * dt));
  motion.pitch += (player.bodyPitch - motion.pitch) * (1 - Math.exp(-12 * dt));
  motion.bank +=
    (clamp(-motion.turn * 0.13 + player.bodyRoll, -0.38, 0.38) - motion.bank) *
    (1 - Math.exp(-7 * dt));
  motion.time = time;
  motion.yaw = player.yaw;
  const activity = player.wallReady ? 0 : clamp(speed / 1.3, 0, 1);
  const kicking = clamp(player.kick * 1.3, 0, 1) * activity;
  const vertical = clamp(Math.abs(player.velocity.y) / 1.4, 0, 0.85);
  const sprint = player.sprint ? kicking : 0;
  const braking = clamp(-motion.acceleration * 0.045, 0, 0.28);
  const turning = clamp((Math.abs(motion.turn) - 0.12) / 0.9, 0, 0.9) * kicking;
  const weights: Record<string, number> = {
    Float: (1 - activity) * (1 - braking),
    Glide: activity * (1 - kicking),
    Swim: kicking * (1 - vertical) * (1 - sprint) * (1 - turning),
    Sprint: sprint * (1 - vertical) * (1 - turning),
    SwimUp: player.velocity.y > 0 ? kicking * vertical * (1 - turning) : 0,
    SwimDown: player.velocity.y < 0 ? kicking * vertical * (1 - turning) : 0,
    BankLeft: motion.turn > 0 ? turning : 0,
    BankRight: motion.turn < 0 ? turning : 0,
    Brake: braking,
    Reach: player.handling ? 0.08 : 0,
  };
  const total = Object.values(weights).reduce(
    (sum, value): number => sum + value,
    0,
  );
  for (const [name, action] of motion.actions) {
    const target = (weights[name] ?? 0) / Math.max(1, total);
    const blended =
      action.getEffectiveWeight() +
      (target - action.getEffectiveWeight()) * (1 - Math.exp(-8 * dt));
    action.setEffectiveWeight(
      Math.abs(blended - target) < 0.001 ? target : blended,
    );
  }
  motion.phase = (motion.phase + dt / (1.6 - sprint * 0.4)) % 1;
  for (const [name, action] of motion.actions) {
    if (
      [
        "Swim",
        "Sprint",
        "SwimUp",
        "SwimDown",
        "BankLeft",
        "BankRight",
      ].includes(name)
    )
      action.time = motion.phase * action.getClip().duration;
    else action.time = (action.time + dt) % action.getClip().duration;
  }
  motion.mixer.update(0);
  bend(bones, "head", turnAxis, motion.turn * 0.033);
  bend(bones, "neck", turnAxis, motion.turn * 0.025);
  bend(bones, "chest", turnAxis, motion.turn * 0.02);
  bend(bones, "spineMid", turnAxis, -motion.turn * 0.016);
  bend(bones, "spine", turnAxis, -motion.turn * 0.026);
  const pitchLead = clamp(player.bodyPitch - motion.pitch, -0.3, 0.3);
  bend(bones, "neck", pitchAxis, pitchLead * 0.45);
  bend(bones, "chest", pitchAxis, pitchLead * 0.35);
  for (const [index, name] of [
    "tail01",
    "tail02",
    "tail03",
    "tail04",
    "tail05",
  ].entries()) {
    bend(bones, name, turnAxis, -motion.tailTurn * (0.022 + index * 0.003));
    bend(bones, name, pitchAxis, -pitchLead * 0.08);
  }
  for (const [index, name] of ["tuftL", "tuftR"].entries())
    bend(
      bones,
      name,
      pitchAxis,
      Math.sin(time * 2.3 - index - motion.tailTurn * 0.4) *
        (0.009 + activity * 0.01),
    );
};
