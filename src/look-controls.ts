import { MathUtils, type Vector3 } from "three";
import { pointerTurnGain } from "./swim-limits";
import { angleDifference, type Controls, clamp } from "./types";

export const PITCH_MIN = -1.15;
export const PITCH_MAX = 1.05;
// Free look stops short of a full turn so the view cannot lose the body.
const FREE_LOOK_YAW = (150 * Math.PI) / 180;
const LOOK_RESPONSE = 11;
const SEEK_RESPONSE = 12;
const SEEK_DONE = 0.03;
// A turn that the swim limits block stops trying after this many seconds.
const SEEK_TIMEOUT = 1.2;
// When an opponent has the puck, the body turn slows from SEEK_FAR metres
// down to a quarter speed at SEEK_CLOSE. Inside SEEK_CLOSE a press makes one
// turn to where the puck was and does not follow it, so a carrier's dekes
// still have to be read with the mouse.
const SEEK_FAR = 5;
const SEEK_CLOSE = 2;
const SEEK_CLOSE_RESPONSE = 0.25;

// Camera-only view state. Free look turns the view away from the body heading
// and never enters the controls that go to the simulation.
export type Look = {
  free: boolean;
  yaw: number;
  pitch: number;
  seeking: boolean;
  seekHeld: boolean;
  seekTime: number;
  seekPoint: Vector3 | undefined;
};

export const freshLook = (): Look => ({
  free: false,
  yaw: 0,
  pitch: 0,
  seeking: false,
  seekHeld: false,
  seekTime: 0,
  seekPoint: undefined,
});

export const moveLook = (
  look: Look,
  controls: Controls,
  yaw: number,
  pitch: number,
): void => {
  look.seeking = look.seekHeld;
  if (look.free) {
    look.yaw = clamp(look.yaw + yaw, -FREE_LOOK_YAW, FREE_LOOK_YAW);
    look.pitch = clamp(
      look.pitch + pitch,
      PITCH_MIN - controls.pitch,
      PITCH_MAX - controls.pitch,
    );
    return;
  }
  controls.yawDelta += yaw;
  controls.pitch = clamp(controls.pitch + pitch, PITCH_MIN, PITCH_MAX);
};

export const aimAt = (
  from: Vector3,
  to: Vector3,
): { yaw: number; pitch: number } => {
  const x = to.x - from.x;
  const z = to.z - from.z;
  return {
    yaw: Math.atan2(-x, -z),
    pitch: clamp(
      Math.atan2(to.y - from.y, Math.hypot(x, z)),
      PITCH_MIN,
      PITCH_MAX,
    ),
  };
};

type Seek = {
  bodyYaw: number;
  camera: Vector3;
  puck: Vector3;
  carrying: boolean;
  // An opponent controls the puck.
  contested: boolean;
};

// Turn the view to the puck. Free look turns only the camera. Otherwise the
// body turns through yawDelta, so the swim turn limits still apply.
export const updateLook = (
  look: Look,
  controls: Controls,
  dt: number,
  seek?: Seek,
): void => {
  if (look.seeking && seek) {
    const distance = seek.camera.distanceTo(seek.puck);
    const limited = seek.contested && !look.free;
    if (limited && distance < SEEK_CLOSE) look.seekPoint ??= seek.puck.clone();
    const aim = aimAt(seek.camera, look.seekPoint ?? seek.puck);
    const response =
      limited && !look.seekPoint
        ? SEEK_RESPONSE *
          MathUtils.lerp(
            SEEK_CLOSE_RESPONSE,
            1,
            MathUtils.smoothstep(distance, SEEK_CLOSE, SEEK_FAR),
          )
        : SEEK_RESPONSE;
    const step = 1 - Math.exp(-response * dt);
    const offset = look.free ? look : { yaw: 0, pitch: 0 };
    const yawError = angleDifference(aim.yaw, seek.bodyYaw + offset.yaw);
    const pitchError = aim.pitch - (controls.pitch + offset.pitch);
    look.seekTime += dt;
    if (look.free) {
      look.yaw = clamp(
        look.yaw + yawError * step,
        -FREE_LOOK_YAW,
        FREE_LOOK_YAW,
      );
      look.pitch += pitchError * step;
    } else {
      controls.yawDelta +=
        (yawError * step) / (1.3 * pointerTurnGain(seek.carrying));
      controls.pitch = clamp(
        controls.pitch + pitchError * step,
        PITCH_MIN,
        PITCH_MAX,
      );
    }
    const aligned =
      Math.abs(yawError) < SEEK_DONE && Math.abs(pitchError) < SEEK_DONE;
    const held = look.seekHeld && !look.seekPoint;
    if (!held && (aligned || look.seekTime > SEEK_TIMEOUT)) {
      look.seeking = false;
      // A close turn needs a fresh press, even while the button is held.
      if (look.seekPoint) look.seekHeld = false;
      look.seekPoint = undefined;
    }
  }
  if (look.free) return;
  const back = Math.exp(-LOOK_RESPONSE * Math.max(0, dt));
  look.yaw = Math.abs(look.yaw * back) < 0.001 ? 0 : look.yaw * back;
  look.pitch = Math.abs(look.pitch * back) < 0.001 ? 0 : look.pitch * back;
};

export const startSeek = (look: Look): void => {
  look.seeking = true;
  look.seekHeld = true;
  look.seekTime = 0;
  look.seekPoint = undefined;
};
