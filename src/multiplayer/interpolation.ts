import { Quaternion, Vector3 } from "three";
import { clamp, type Player, type Simulation } from "../types";

// Keep enough history for the maximum interpolation delay. A smaller buffer
// can make remote players stop when the playhead reaches the newest sample.
const SAMPLES = 24;
type Pose = {
  id: number;
  position: Vector3;
  velocity: Vector3;
  stick: Vector3;
  orientation: Quaternion;
  yaw: number;
  bodyPitch: number;
  bodyRoll: number;
  kick: number;
  kickPhase: number;
  shotDraw: number;
};
type Sample = {
  time: number;
  arrived: number;
  players: Pose[];
  puck: { position: Vector3; orientation: Quaternion };
  transition: string;
};
const createPose = (): Pose => ({
  id: 0,
  position: new Vector3(),
  velocity: new Vector3(),
  stick: new Vector3(),
  orientation: new Quaternion(),
  yaw: 0,
  bodyPitch: 0,
  bodyRoll: 0,
  kick: 0,
  kickPhase: 0,
  shotDraw: 0,
});
const copyPose = (pose: Pose, player: Player): void => {
  pose.id = player.id;
  pose.position.copy(player.position);
  pose.velocity.copy(player.velocity);
  pose.stick.copy(player.stick);
  pose.orientation.copy(player.stickOrientation);
  pose.yaw = player.yaw;
  pose.bodyPitch = player.bodyPitch;
  pose.bodyRoll = player.bodyRoll;
  pose.kick = player.kick;
  pose.kickPhase = player.kickPhase;
  pose.shotDraw = player.shotDraw;
};
const createSample = (playerCount: number): Sample => ({
  time: 0,
  arrived: 0,
  players: Array.from({ length: playerCount }, createPose),
  puck: { position: new Vector3(), orientation: new Quaternion() },
  transition: "",
});
const mix = (a: number, b: number, alpha: number): number =>
  a + (b - a) * alpha;

export const createSnapshotInterpolation = (): {
  push: (state: Simulation, arrived: number) => void;
  render: (state: Simulation, self: number, now: number) => void;
} => {
  let samples: Sample[] = [];
  const available: Sample[] = [];
  let playhead = 0;
  let renderedAt: number | undefined;
  let jitter = 0;
  return {
    push: (state, arrived): void => {
      const previous = samples.at(-1);
      if (previous && state.time === previous.time) return;
      const transition = `${state.finished}:${state.restartTime > 0}:${state.faceoff?.phase ?? "play"}`;
      if (
        !previous ||
        transition !== previous.transition ||
        state.time < previous.time ||
        state.time - previous.time > 0.25
      ) {
        available.push(...samples);
        samples = [];
        playhead = state.time;
        renderedAt = arrived;
        jitter = 0;
      } else {
        const variation = Math.abs(
          (arrived - previous.arrived) / 1000 - (state.time - previous.time),
        );
        jitter += (variation - jitter) * 0.1;
      }
      let sample =
        samples.length >= SAMPLES ? samples.shift() : available.pop();
      if (!sample || sample.players.length !== state.players.length)
        sample = createSample(state.players.length);
      sample.time = state.time;
      sample.arrived = arrived;
      sample.transition = transition;
      for (let index = 0; index < state.players.length; index += 1) {
        const player = state.players[index];
        const target = sample.players[index];
        if (player && target) copyPose(target, player);
      }
      sample.puck.position.copy(state.puck.position);
      sample.puck.orientation.copy(state.puck.orientation);
      samples.push(sample);
    },
    render: (state, self, now): void => {
      const latest = samples.at(-1);
      const first = samples.at(0);
      if (!latest || !first) return;
      const dt = Math.max(0, Math.min(0.1, (now - (renderedAt ?? now)) / 1000));
      renderedAt = now;
      const delay = clamp(0.075 + jitter * 2, 0.075, 0.15);
      const target = latest.time + (now - latest.arrived) / 1000 - delay;
      const rate = clamp(1 + (target - playhead) * 4, 0.8, 1.2);
      playhead = clamp(playhead + dt * rate, first.time, latest.time);
      let before = first;
      let after = latest;
      for (const sample of samples) {
        if (sample.time <= playhead) before = sample;
        if (sample.time >= playhead) {
          after = sample;
          break;
        }
      }
      const alpha =
        after.time > before.time
          ? clamp((playhead - before.time) / (after.time - before.time), 0, 1)
          : 1;
      for (const player of state.players) {
        if (player.id === self) continue;
        const a = before.players.find(
          (candidate) => candidate.id === player.id,
        );
        const b = after.players.find((candidate) => candidate.id === player.id);
        if (!a || !b) continue;
        player.position.lerpVectors(a.position, b.position, alpha);
        player.previous.copy(player.position);
        player.velocity.lerpVectors(a.velocity, b.velocity, alpha);
        player.stick.lerpVectors(a.stick, b.stick, alpha);
        player.previousStick.copy(player.stick);
        player.stickOrientation.slerpQuaternions(
          a.orientation,
          b.orientation,
          alpha,
        );
        player.previousStickOrientation.copy(player.stickOrientation);
        player.yaw =
          a.yaw +
          Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * alpha;
        player.previousYaw = player.yaw;
        player.bodyPitch = mix(a.bodyPitch, b.bodyPitch, alpha);
        player.previousBodyPitch = player.bodyPitch;
        player.bodyRoll = mix(a.bodyRoll, b.bodyRoll, alpha);
        player.kick = mix(a.kick, b.kick, alpha);
        player.kickPhase = mix(a.kickPhase, b.kickPhase, alpha);
        player.shotDraw = mix(a.shotDraw, b.shotDraw, alpha);
      }
      if (
        state.puck.controlOwner !== self ||
        state.puck.shotOwner !== undefined
      ) {
        state.puck.position.lerpVectors(
          before.puck.position,
          after.puck.position,
          alpha,
        );
        state.puck.previous.copy(state.puck.position);
        state.puck.orientation.slerpQuaternions(
          before.puck.orientation,
          after.puck.orientation,
          alpha,
        );
        state.puck.previousOrientation.copy(state.puck.orientation);
      }
    },
  };
};
