import { Quaternion, Vector3 } from "three";
import { GOAL_BACK, goalContact } from "./goal-profile";
import { announce } from "./simulation-events";
import { smoothMotion } from "./stick";
import {
  POOL,
  PUCK_HEIGHT,
  PUCK_RADIUS,
  type Simulation,
  type Team,
} from "./types";

const normalScratch = new Vector3();
const angularAxis = new Vector3();
const axisY = new Vector3(0, 1, 0);
const rotation = new Quaternion();
const identity = new Quaternion();

export const goalSurfaceHeight = (x: number, z: number): number =>
  goalContact(x, z).height;

export const puckFloorHeight = (state: Simulation): number => {
  const normal = normalScratch
    .set(0, 1, 0)
    .applyQuaternion(state.puck.orientation);
  return (
    goalSurfaceHeight(state.puck.position.x, state.puck.position.z) +
    Math.abs(normal.y) * PUCK_HEIGHT +
    Math.sqrt(Math.max(0, 1 - normal.y * normal.y)) * PUCK_RADIUS
  );
};

export const puckInsideGoal = (state: Simulation): boolean => {
  const { position, orientation } = state.puck;
  const normal = normalScratch.set(0, 1, 0).applyQuaternion(orientation);
  const extent = (component: number): number =>
    Math.abs(component) * PUCK_HEIGHT +
    Math.sqrt(Math.max(0, 1 - component * component)) * PUCK_RADIUS;
  const x = extent(normal.x);
  const y = extent(normal.y);
  const z = extent(normal.z);
  return (
    Math.abs(position.x) + x <= 1.125 &&
    Math.abs(position.z) - z >= GOAL_BACK - 0.14 &&
    Math.abs(position.z) + z <= GOAL_BACK - 0.035 + 0.000001 &&
    position.y - y >= 0.006 &&
    position.y + y <= 0.145
  );
};

export const advancePuck = (state: Simulation, dt: number): void => {
  const puck = state.puck;
  puck.previous.copy(puck.position);
  puck.previousOrientation.copy(puck.orientation);
  const onFloor = puck.position.y <= puckFloorHeight(state) + 0.004;
  const speed = Math.hypot(puck.velocity.x, puck.velocity.z);
  const drag = Math.exp(
    -(1.1 + speed * 0.18 + (onFloor ? 2.8 : 0)) * dt * state.physics.drag,
  );
  if (puck.controlOwner === undefined && puck.shotOwner === undefined) {
    puck.velocity.x *= drag;
    puck.velocity.z *= drag;
    puck.velocity.y -= 3.6 * dt;
    puck.velocity.y *= Math.exp(-0.7 * dt);
    puck.position.addScaledVector(puck.velocity, dt);
    if (puck.flightOrientation) {
      const landing =
        puck.velocity.y < 0
          ? smoothMotion((0.14 - puck.position.y) / 0.095)
          : 0;
      puck.orientation.copy(puck.flightOrientation).slerp(identity, landing);
    }
    const angularSpeed = puck.angularVelocity.length();
    if (angularSpeed > 0.001)
      puck.orientation
        .premultiply(
          rotation.setFromAxisAngle(
            angularAxis.copy(puck.angularVelocity).divideScalar(angularSpeed),
            angularSpeed * dt,
          ),
        )
        .normalize();
    puck.angularVelocity.multiplyScalar(Math.exp(-dt * (onFloor ? 5.5 : 0.65)));
    if (!puck.flightOrientation && onFloor && speed < 1.4)
      puck.orientation.slerp(
        rotation.setFromAxisAngle(axisY, puck.rotation),
        1 - Math.exp(-12 * dt),
      );
  }
  if (
    Math.abs(puck.position.x) < 1.125 &&
    Math.abs(puck.position.z) > GOAL_BACK - 0.035 - PUCK_RADIUS &&
    puck.position.y < 0.145 + PUCK_RADIUS
  ) {
    puck.position.z =
      Math.sign(puck.position.z) * (GOAL_BACK - 0.035 - PUCK_RADIUS);
    puck.velocity.z =
      -Math.sign(puck.position.z) * Math.abs(puck.velocity.z) * 0.15;
  }
  const supportHeight = puckFloorHeight(state);
  const contact = goalContact(puck.position.x, puck.position.z);
  if (
    puck.controlOwner === undefined &&
    puck.shotOwner === undefined &&
    puck.position.y <= supportHeight + 0.006
  ) {
    puck.velocity.x -=
      ((3.6 * contact.lateralSlope) / (1 + contact.lateralSlope ** 2)) * dt;
    puck.velocity.z +=
      ((Math.sign(puck.position.z) * 3.6 * contact.slope) /
        (1 + contact.slope * contact.slope)) *
      dt;
  }
  if (puck.position.y < supportHeight) {
    puck.position.y = supportHeight;
    puck.velocity.y = 0;
    if (puck.flightOrientation) {
      puck.flightOrientation = undefined;
      puck.orientation.identity();
      puck.position.y = puckFloorHeight(state);
    }
  }
  if (Math.abs(puck.position.x) > POOL.width / 2 - PUCK_RADIUS) {
    puck.position.x =
      Math.sign(puck.position.x) * (POOL.width / 2 - PUCK_RADIUS);
    puck.velocity.x *= -0.4;
  }
  if (puck.position.y > POOL.depth - PUCK_HEIGHT) {
    puck.position.y = POOL.depth - PUCK_HEIGHT;
    puck.velocity.y = -Math.abs(puck.velocity.y) * 0.25;
  }
  if (Math.abs(puck.position.z) > GOAL_BACK - 0.14) {
    if (puckInsideGoal(state) && state.mode !== "playground") {
      const scoring: Team = puck.position.z < 0 ? 0 : 1;
      state.scores[scoring] += 1;
      state.goals.push({
        team: scoring,
        scorer: puck.lastTouch,
        second: state.duration - state.seconds,
      });
      state.restartTime = 3;
      announce(state, scoring === 0 ? "Black scores" : "White scores", 3);
      puck.velocity.set(0, 0, 0);
    } else if (Math.abs(puck.position.z) > POOL.length / 2 - PUCK_RADIUS) {
      puck.position.z =
        Math.sign(puck.position.z) * (POOL.length / 2 - PUCK_RADIUS);
      puck.velocity.z *= -0.4;
    }
  }
  puck.spin *= Math.exp(-dt * (onFloor ? 1.7 : 0.6));
  puck.rotation += puck.spin * dt;
};
