import { type PerspectiveCamera, Vector3 } from "three";
import { confineCameraToPool } from "./camera-bounds";
import { CAMERA_OFFSET, type Simulation } from "./types";
import {
  approachGlance,
  approachHeadLift,
  glanceYaw,
  headLiftTarget,
} from "./view-effects";

export type CameraRig = {
  camera: PerspectiveCamera;
  headLift: number;
  glance: number;
  puck: { position: Vector3 };
  reviewCamera?: { position: Vector3; target: Vector3; firstPerson: boolean };
};

const axisX = new Vector3(1, 0, 0);
const axisY = new Vector3(0, 1, 0);
const offset = new Vector3();
const target = new Vector3();

export const updateWorldCamera = (
  world: CameraRig,
  state: Simulation,
  dt: number,
  active: boolean,
  pitch: number,
  alpha: number,
  liftHead: boolean,
  glance: number,
): void => {
  const human = state.players.at(0);
  if (active && human) {
    const viewYaw = human.previousYaw + (human.yaw - human.previousYaw) * alpha;
    const viewBodyPitch =
      human.previousBodyPitch +
      (human.bodyPitch - human.previousBodyPitch) * alpha;
    world.camera.position
      .lerpVectors(human.previous, human.position, alpha)
      .add(
        offset
          .copy(CAMERA_OFFSET)
          .applyAxisAngle(axisX, viewBodyPitch)
          .applyAxisAngle(axisY, viewYaw),
      );
    world.headLift = approachHeadLift(
      world.headLift,
      headLiftTarget(human, liftHead),
      dt,
    );
    world.camera.position.y += world.headLift;
    world.glance = approachGlance(world.glance, glanceYaw(glance), dt);
    world.camera.rotation.order = "YXZ";
    world.camera.rotation.set(pitch, viewYaw + world.glance, 0);
    world.camera.fov +=
      (Math.min(
        110,
        (human.sprint ? 81 : 77) + Math.max(0, 1 - world.camera.aspect) * 60,
      ) -
        world.camera.fov) *
      Math.min(1, dt * 4);
    world.camera.updateProjectionMatrix();
    if (state.mode === "playground" && state.playground.camera === "side") {
      target.copy(world.puck.position).lerp(human.stick, 0.3);
      world.camera.position
        .copy(target)
        .add(offset.set(1.3, 0.65, 0.4).applyAxisAngle(axisY, human.yaw));
      world.camera.fov = 56;
      confineCameraToPool(world.camera);
      world.camera.lookAt(target);
      world.camera.updateProjectionMatrix();
    } else confineCameraToPool(world.camera);
  } else {
    world.headLift = 0;
    world.camera.position.set(10.3, 7.6, 15.7);
    world.camera.lookAt(-1.2, 2.2, -3.6);
  }
  if (world.reviewCamera) {
    if (!world.reviewCamera.firstPerson) {
      world.camera.position.copy(world.reviewCamera.position);
      world.camera.lookAt(world.reviewCamera.target);
    }
    world.camera.fov = world.reviewCamera.firstPerson ? 77 : 48;
    world.camera.updateProjectionMatrix();
    if (world.reviewCamera.firstPerson) confineCameraToPool(world.camera);
  }
};
