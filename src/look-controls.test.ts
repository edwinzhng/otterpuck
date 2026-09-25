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
    contested: false,
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
      contested: false,
    });
  }
  expect(controls.yawDelta).toBe(0);
  expect(look.yaw).toBeCloseTo(-Math.PI / 4, 2);
});

const turnFor = (
  puck: Vector3,
  contested: boolean,
  frames: number,
): { look: ReturnType<typeof freshLook>; yaw: number } => {
  const look = freshLook();
  const controls = freshControls();
  const seek = {
    bodyYaw: 0,
    camera: new Vector3(0, 1, 0),
    puck,
    carrying: false,
    contested,
  };
  startSeek(look);
  for (const unused of Array.from({ length: frames })) {
    void unused;
    controls.yawDelta = 0;
    updateLook(look, controls, 1 / 60, seek);
    seek.bodyYaw += controls.yawDelta * 1.3 * 2.05;
  }
  return { look, yaw: seek.bodyYaw };
};

test("look at puck turns slower toward an opponent's puck as it gets closer", (): void => {
  const far = turnFor(new Vector3(-6, 1, 0), true, 6).yaw;
  const middle = turnFor(new Vector3(-3.5, 1, 0), true, 6).yaw;
  const loose = turnFor(new Vector3(-3.5, 1, 0), false, 6).yaw;
  expect(far).toBeCloseTo(turnFor(new Vector3(-6, 1, 0), false, 6).yaw, 6);
  expect(middle).toBeLessThan(loose);
  expect(middle).toBeGreaterThan(0);
});

test("up close, holding look at puck makes one turn and does not follow an opponent's puck", (): void => {
  const puck = new Vector3(-1.5, 1, 0);
  const { look, yaw } = turnFor(puck, true, 90);
  expect(Math.abs(angleDifference(Math.PI / 2, yaw))).toBeLessThan(0.05);
  expect(look.seeking).toBe(false);
  expect(look.seekHeld).toBe(false);
  // The carrier cuts across. The released turn must not chase it.
  const controls = freshControls();
  puck.set(0, 1, -1.5);
  updateLook(look, controls, 1 / 60, {
    bodyYaw: yaw,
    camera: new Vector3(0, 1, 0),
    puck,
    carrying: false,
    contested: true,
  });
  expect(controls.yawDelta).toBe(0);
});

test("up close, holding look at puck keeps following a loose puck", (): void => {
  const { look } = turnFor(new Vector3(-1.5, 1, 0), false, 90);
  expect(look.seeking).toBe(true);
  expect(look.seekHeld).toBe(true);
});

test("free look at puck stays unlimited up close", (): void => {
  const look = freshLook();
  const controls = freshControls();
  look.free = true;
  startSeek(look);
  for (const unused of Array.from({ length: 90 })) {
    void unused;
    updateLook(look, controls, 1 / 60, {
      bodyYaw: 0,
      camera: new Vector3(0, 1, 0),
      puck: new Vector3(1, 1, -1),
      carrying: false,
      contested: true,
    });
  }
  expect(look.seekHeld).toBe(true);
  expect(look.yaw).toBeCloseTo(-Math.PI / 4, 2);
});
