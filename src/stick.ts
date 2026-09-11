import { Quaternion, Vector3 } from "three";
import {
  angleDifference,
  clamp,
  directionYaw,
  handSide,
  type Player,
  STICK_REACH,
  STICK_TILT,
} from "./types";

export const STICK_GRIP = new Vector3(0.1, 0, 0.077);
export const STICK_TIP = new Vector3(-0.125, 0, -0.037);
export const REST_BLADE_YAW = Math.PI + Math.atan2(0.114, 0.225) - 0.08;
export const SHOT_DURATION = 0.4;
export const SHOT_APPROACH = 0.24;
export const SHOT_RELEASE = 0.57;
export const SHOT_CONTACT = new Vector3(-0.055, 0, 0.045);
export const HOOK_ROOT = new Vector3(-0.12, 0, 0.058);
export const INSIDE_NORMAL = new Vector3(0.007, 0, -0.034).normalize();
export const CRADLE_APPROACH = 0.24;
export const CURL_APPROACH = 0.045;
export const SWERVE_PULL_DURATION = 0.168;
export const SWERVE_EXTEND_DURATION = 0.22;
export const bladeMirror = (player: Player): number => -handSide(player);
export const mirrorBladePoint = (player: Player, point: Vector3): Vector3 =>
  point.clone().setX(point.x * bladeMirror(player));
export const bladePoint = (player: Player, point: Vector3): Vector3 =>
  mirrorBladePoint(player, point.clone().sub(STICK_GRIP))
    .applyQuaternion(player.stickOrientation)
    .add(
      mirrorBladePoint(player, STICK_GRIP).applyAxisAngle(
        new Vector3(0, 1, 0),
        player.stickYaw,
      ),
    )
    .add(player.stick);

export const shotProgress = (player: Player): number =>
  player.shotTime > 0 ? 1 - player.shotTime / SHOT_DURATION : 0;

const shotWristTurn = (progress: number): number =>
  0.5 *
    smoothMotion((progress - SHOT_APPROACH) / (SHOT_RELEASE - SHOT_APPROACH)) +
  (Math.PI * 1.5 - REST_BLADE_YAW - 0.5) *
    smoothMotion((progress - 0.42) / 0.34);

export const bladeOrientation = (
  yaw: number,
  progress: number,
  shotYaw = yaw,
  mirror = 1,
  tilt = STICK_TILT,
): Quaternion => {
  const rest = new Quaternion()
    .setFromAxisAngle(new Vector3(0, 1, 0), yaw)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), tilt));
  if (progress <= 0) return rest;
  const stroke = smoothMotion(
    (progress - SHOT_APPROACH) / (SHOT_RELEASE - SHOT_APPROACH),
  );
  const deliveryYaw =
    shotYaw + (REST_BLADE_YAW + shotWristTurn(progress)) * mirror;
  const approach = smoothMotion(progress / SHOT_APPROACH);
  const recovery = smoothMotion((progress - 0.78) / 0.22);
  const wristYaw =
    progress < SHOT_APPROACH
      ? yaw + angleDifference(deliveryYaw, yaw) * approach
      : deliveryYaw + angleDifference(yaw, deliveryYaw) * recovery;
  const roll =
    progress < SHOT_APPROACH
      ? tilt * (1 - approach)
      : (Math.PI / 2) * stroke * (1 - recovery) + tilt * recovery;
  return new Quaternion()
    .setFromAxisAngle(new Vector3(0, 1, 0), wristYaw)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), roll));
};

export const smoothMotion = (value: number): number => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

export const swerveExtension = (player: Player): number =>
  player.cradle?.kind === "dummy"
    ? smoothMotion(
        (player.cradle.elapsed - SWERVE_PULL_DURATION) / SWERVE_EXTEND_DURATION,
      )
    : 1;

const reverseBladeYaw = (player: Player): number => {
  const target = reversePuckOffset(player);
  const reverseDirection = new Vector3(
    target.z * handSide(player),
    0,
    -target.x * handSide(player),
  );
  const insideNormal = mirrorBladePoint(player, INSIDE_NORMAL).applyAxisAngle(
    new Vector3(1, 0, 0),
    0.22,
  );
  return (
    directionYaw(reverseDirection.x, reverseDirection.z) -
    directionYaw(insideNormal.x, insideNormal.z)
  );
};

export const updateBladePose = (player: Player, dt: number): void => {
  const pulling = player.puckMove?.kind === "pull";
  const inside =
    pulling || player.backhand || player.curl !== 0 || player.charging;
  const extension = swerveExtension(player);
  const cradle = player.cradle;
  const face = inside
    ? 1
    : cradle?.kind === "dummy"
      ? (cradle.originFace +
          (1 - cradle.originFace) *
            smoothMotion(cradle.elapsed / (SWERVE_PULL_DURATION * 0.7))) *
        (1 - extension)
      : cradle?.kind === "settling"
        ? cradle.originFace * (1 - smoothMotion(cradle.elapsed / 0.26))
        : 0;
  const sideways =
    player.curl !== 0
      ? 0
      : player.cradle?.kind === "dummy"
        ? player.cradle.turnDirection * extension
        : player.dummy || player.lateral;
  const desired =
    player.curl < 0
      ? reverseBladeYaw(player) * bladeMirror(player)
      : REST_BLADE_YAW + sideways * 0.42;
  const response = player.dummy !== 0 ? 32 : player.curl !== 0 ? 26 : 12;
  if (player.shotTime <= 0) {
    player.bladeRotation +=
      angleDifference(desired, player.bladeRotation) *
      (1 - Math.exp(-response * dt));
    player.bladeFace +=
      (face - player.bladeFace) * (1 - Math.exp(-response * 1.8 * dt));
    player.bladeTilt +=
      ((player.curl < 0 ? 0.22 : STICK_TILT) - player.bladeTilt) *
      (1 - Math.exp(-response * dt));
  }
  player.stickYaw = player.yaw + player.bladeRotation * bladeMirror(player);
  player.stickOrientation.copy(
    bladeOrientation(
      player.stickYaw,
      shotProgress(player),
      directionYaw(player.shotDirection.x, player.shotDirection.z),
      bladeMirror(player),
      player.bladeTilt,
    ),
  );
};

export const puckContactLocal = (player: Player): Vector3 =>
  new Vector3(
    -0.04 - 0.18 * Math.sin(player.bladeFace * Math.PI),
    0,
    0.122 - 0.14 * player.bladeFace,
  );

export const bladeOrigin = (
  player: Player,
  orientation = player.stickOrientation,
  yaw = player.stickYaw,
): Vector3 =>
  mirrorBladePoint(player, STICK_GRIP)
    .applyAxisAngle(new Vector3(0, 1, 0), yaw)
    .sub(mirrorBladePoint(player, STICK_GRIP).applyQuaternion(orientation))
    .add(player.stick);

export const puckSeat = (player: Player): Vector3 =>
  bladePoint(player, puckContactLocal(player));

export const restPuckOffset = (player: Player): Vector3 =>
  mirrorBladePoint(player, new Vector3(-0.04, 0, 0.122))
    .applyAxisAngle(new Vector3(0, 1, 0), REST_BLADE_YAW * bladeMirror(player))
    .add(new Vector3(0.13 * handSide(player), 0, -STICK_REACH));

export const reversePuckOffset = (player: Player): Vector3 =>
  new Vector3(0.32 * handSide(player), 0, -0.61);

export const shotStroke = (player: Player): number =>
  clamp(
    (shotProgress(player) - SHOT_APPROACH) / (SHOT_RELEASE - SHOT_APPROACH),
    0,
    1,
  );

export const shotPuckOrientation = (player: Player): Quaternion =>
  new Quaternion()
    .setFromUnitVectors(new Vector3(0, 1, 0), player.shotDirection)
    .slerp(
      new Quaternion(),
      1 - smoothMotion(shotStroke(player)) * player.shotLoft,
    )
    .premultiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        (Math.PI / 2) * smoothMotion(shotStroke(player)) * bladeMirror(player),
      ),
    );

export const shotTranslation = (player: Player): Vector3 =>
  player.shotOrigin
    ? player.position.clone().sub(player.shotStartPosition).setY(0)
    : new Vector3();

export const shotPuckPosition = (player: Player): Vector3 => {
  const slide = shotStroke(player);
  const position = (player.shotOrigin ?? puckSeat(player))
    .clone()
    .add(shotTranslation(player))
    .addScaledVector(
      player.shotDirection,
      (0.16 + player.shotPower * 0.1) * slide * slide,
    );
  position.y += 0.06 * smoothMotion(slide) * player.shotLoft;
  return position;
};
