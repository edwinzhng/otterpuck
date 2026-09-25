import { expect, test } from "bun:test";
import { Vector3 } from "three";
import {
  aimAt,
  freshLook,
  moveLook,
  startSeek,
  updateLook,
} from "./look-controls";
import { angleDifference, freshControls } from "./types";

test("free look turns the view without turning the swimmer", (): void => {
  const look = freshLook();
  const controls = freshControls();
  look.free = true;
  moveLook(look, controls, 0.8, 0.2);
  expect(controls.yawDelta).toBe(0);
  expect(controls.pitch).toBe(-0.5);
  expect(look.yaw).toBeCloseTo(0.8);
  expect(look.pitch).toBeCloseTo(0.2);
});

test("released free look returns the view to the heading", (): void => {
  const look = freshLook();
  const controls = freshControls();
  look.free = true;
  moveLook(look, controls, 1.2, -0.3);
  look.free = false;
  for (const unused of Array.from({ length: 60 })) {
    void unused;
    updateLook(look, controls, 1 / 60);
  }
  expect(look.yaw).toBe(0);
  expect(look.pitch).toBe(0);
});

test("the mouse turns the swimmer outside free look", (): void => {
  const look = freshLook();
  const controls = freshControls();
  moveLook(look, controls, 0.3, 0.1);
  expect(controls.yawDelta).toBeCloseTo(0.3);
  expect(controls.pitch).toBeCloseTo(-0.4);
  expect(look.yaw).toBe(0);
});

test("aim points the view at a target", (): void => {
  const camera = new Vector3(0, 1, 0);
  expect(aimAt(camera, new Vector3(0, 1, -5)).yaw).toBeCloseTo(0);
  expect(aimAt(camera, new Vector3(-5, 1, 0)).yaw).toBeCloseTo(Math.PI / 2);
  expect(aimAt(camera, new Vector3(0, 0, -1)).pitch).toBeCloseTo(-Math.PI / 4);
});

test("look at puck turns the swimmer until the view reaches the puck", (): void => {
  const look = freshLook();
  const controls = freshControls();
  const seek = {
    bodyYaw: 0,
    camera: new Vector3(0, 1, 0),
    puck: new Vector3(-4, 0.2, 0),
    carrying: false,
  };
  startSeek(look);
  look.seekHeld = false;
  for (const unused of Array.from({ length: 120 })) {
    void unused;
    controls.yawDelta = 0;
    updateLook(look, controls, 1 / 60, seek);
    seek.bodyYaw += controls.yawDelta * 1.3 * 2.05;
  }
  const aim = aimAt(seek.camera, seek.puck);
  expect(Math.abs(angleDifference(aim.yaw, seek.bodyYaw))).toBeLessThan(0.05);
  expect(controls.pitch).toBeCloseTo(aim.pitch, 1);
  expect(look.seeking).toBe(false);
});

test("look at puck in free look turns only the camera", (): void => {
  const look = freshLook();
  const controls = freshControls();
  look.free = true;
  startSeek(look);
  for (const unused of Array.from({ length: 90 })) {
    void unused;
    updateLook(look, controls, 1 / 60, {
      bodyYaw: 0,
      camera: new Vector3(0, 1, 0),
      puck: new Vector3(4, 1, -4),
      carrying: false,
    });
  }
  expect(controls.yawDelta).toBe(0);
  expect(look.yaw).toBeCloseTo(-Math.PI / 4, 2);
});
