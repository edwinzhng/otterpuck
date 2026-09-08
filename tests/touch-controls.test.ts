import { expect, test } from "bun:test";
import { pollMovement } from "../src/handling";
import {
  createSimulation,
  stepSimulation,
  updateStick,
} from "../src/simulation";
import { puckSeat } from "../src/stick";
import { createTouchController } from "../src/touch-controls";
import { forwardVector, freshControls, PUCK_HEIGHT, STEP } from "../src/types";
import { uiShell } from "../src/ui-shell";

const point = (x = 0, y = 0): { x: number; y: number } => ({ x, y });

test("independent thumbs steer, sprint, charge and aim together; release fires once", (): void => {
  const controls = freshControls();
  const touch = createTouchController(controls);
  expect(touch.begin(11, "move", point(), 0)).toBe(true);
  touch.move(11, point(24, -54));
  expect(touch.begin(22, "shot", point(600, 300), 0)).toBe(true);
  touch.move(22, point(650, 280));
  touch.poll(325);
  expect(controls.forward).toBeGreaterThan(0.8);
  expect(controls.lateral).toBeGreaterThan(0.3);
  expect(controls.sprint).toBe(true);
  expect(controls.charging).toBe(true);
  expect(controls.charge).toBeCloseTo(0.5);
  expect(controls.shot).toBe(0);
  expect(controls.yawDelta).toBeLessThan(0);
  expect(controls.pitch).toBeGreaterThan(-0.5);
  touch.end(22, 650);
  touch.poll(650);
  expect(controls.shot).toBe(1);
  expect(controls.charging).toBe(false);
  expect(controls.forward).toBeGreaterThan(0.8);
  controls.shot = 0;
  touch.poll(660);
  expect(controls.shot).toBe(0);
  touch.end(11, 700);
  touch.poll(700);
  expect(controls.forward).toBe(0);
  expect(controls.lateral).toBe(0);
  expect(controls.sprint).toBe(false);
});

test("captured shot drag remains an aim action far outside its button", (): void => {
  const controls = freshControls();
  const touch = createTouchController(controls);
  touch.begin(1, "shot", point(600, 300), 0);
  touch.move(1, point(-200, -2000));
  touch.poll(1000);
  expect(controls.pitch).toBe(1.05);
  expect(controls.charge).toBe(1);
  touch.end(1, 1000);
  touch.poll(1000);
  expect(controls.shot).toBe(1);
});

test("touch cancellation and capture loss never release a shot or cancel the other thumb", (): void => {
  const controls = freshControls();
  const touch = createTouchController(controls);
  touch.begin(1, "move", point(), 0);
  touch.move(1, point(0, -40));
  touch.begin(2, "shot", point(), 0);
  touch.poll(600);
  touch.end(2, 650, true);
  touch.poll(650);
  expect(controls.shot).toBe(0);
  expect(controls.charging).toBe(false);
  expect(controls.forward).toBeGreaterThan(0.5);
  touch.end(2, 650);
  touch.poll(650);
  expect(controls.shot).toBe(0);
});

test("pause, blur, orientation and mode resets clear every held action and pending edge", (): void => {
  const controls = freshControls();
  const touch = createTouchController(controls);
  for (const [id, action] of [
    "move",
    "shot",
    "react",
    "descend",
    "curl",
    "dummy",
    "pull",
  ].entries()) {
    if (
      action === "move" ||
      action === "shot" ||
      action === "react" ||
      action === "descend" ||
      action === "curl" ||
      action === "dummy" ||
      action === "pull"
    )
      touch.begin(id, action, point(), 0);
  }
  touch.move(0, point(40, -40));
  touch.move(1, point(20, 0));
  touch.poll(650);
  touch.end(1, 650);
  controls.backhand = true;
  const pitch = controls.pitch;
  touch.clear();
  touch.end(1, 1000);
  touch.poll(1000);
  expect(controls).toEqual({ ...freshControls(), pitch, backhand: true });
});

test("joystick dead zone, analog strength, sprint hysteresis and braking are stable", (): void => {
  const controls = freshControls();
  const touch = createTouchController(controls);
  touch.begin(1, "move", point(), 0);
  touch.move(1, point(2, -2));
  touch.poll(0);
  expect(controls.forward).toBe(0);
  touch.move(1, point(0, -30));
  touch.poll(1);
  expect(controls.forward).toBeGreaterThan(0.4);
  expect(controls.forward).toBeLessThan(0.6);
  expect(controls.sprint).toBe(false);
  touch.move(1, point(0, -54));
  touch.poll(2);
  expect(controls.sprint).toBe(true);
  touch.move(1, point(0, -47));
  touch.poll(3);
  expect(controls.sprint).toBe(true);
  touch.move(1, point(0, -40));
  touch.poll(4);
  expect(controls.sprint).toBe(false);
  touch.move(1, point(40, 50));
  touch.poll(5);
  expect(controls.forward).toBeLessThan(0);
  expect(controls.sprint).toBe(false);
});

test("skill holds preserve movement and stop independently", (): void => {
  const controls = freshControls();
  const touch = createTouchController(controls);
  touch.begin(1, "move", point(), 0);
  touch.move(1, point(35, -35));
  touch.begin(2, "dummy", point(), 0);
  touch.poll(0);
  expect(controls.dummy).toBe(controls.lateral);
  expect(controls.dummy).toBeGreaterThan(0.5);
  expect(controls.forward).toBeGreaterThan(0.5);
  touch.end(2, 10);
  touch.begin(2, "reverse", point(), 10);
  touch.poll(10);
  expect(controls.dummy).toBe(0);
  expect(controls.curl).toBe(-1);
  touch.end(2, 20);
  touch.begin(2, "curl", point(), 20);
  touch.poll(20);
  expect(controls.curl).toBe(1);
  touch.end(2, 30);
  touch.begin(2, "pull", point(), 30);
  touch.poll(30);
  expect(controls.pushPull).toBe(true);
  touch.end(2, 40);
  touch.poll(40);
  expect(controls.pushPull).toBe(false);
  expect(controls.forward).toBeGreaterThan(0.5);
});

test("reaction and dive fire once per press, while depth remains held", (): void => {
  const controls = freshControls();
  const touch = createTouchController(controls);
  touch.begin(1, "react", point(), 0);
  touch.begin(2, "descend", point(), 0);
  touch.poll(0);
  expect(controls.knockdown).toBe(true);
  expect(controls.dive).toBe(true);
  expect(controls.vertical).toBe(-1);
  controls.knockdown = false;
  controls.dive = false;
  touch.poll(10);
  expect(controls.knockdown).toBe(false);
  expect(controls.dive).toBe(false);
  expect(controls.vertical).toBe(-1);
  touch.end(2, 20);
  touch.begin(2, "rise", point(), 20);
  touch.poll(20);
  expect(controls.vertical).toBe(1);
});

test("a second finger cannot steal a held button or toggle backhand repeatedly", (): void => {
  const controls = freshControls();
  const touch = createTouchController(controls);
  expect(touch.begin(1, "backhand", point(), 0)).toBe(true);
  expect(touch.begin(2, "backhand", point(), 0)).toBe(false);
  touch.poll(500);
  expect(controls.backhand).toBe(true);
  touch.end(1, 600);
  touch.begin(2, "backhand", point(), 700);
  expect(controls.backhand).toBe(false);
});

test("ascending cancels loaded puck actions while leaving look and swimming responsive", (): void => {
  const controls = freshControls();
  const touch = createTouchController(controls);
  touch.begin(1, "shot", point(), 0);
  touch.poll(500);
  touch.setStickAvailable(false);
  touch.end(1, 650);
  expect(touch.begin(1, "shot", point(), 700)).toBe(false);
  expect(touch.begin(1, "look", point(), 700)).toBe(true);
  touch.move(1, point(30, 0));
  touch.poll(700);
  expect(controls.shot).toBe(0);
  expect(controls.charging).toBe(false);
  expect(controls.yawDelta).toBeLessThan(0);
  touch.setStickAvailable(true);
  expect(touch.begin(2, "shot", point(), 800)).toBe(true);
});

test("touch sprint shots use the existing moving-puck release and keep the puck ahead", (): void => {
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Player missing");
  updateStick(player, STEP);
  state.puck.position.copy(puckSeat(player)).setY(PUCK_HEIGHT);
  state.puck.previous.copy(state.puck.position);
  const controls = freshControls();
  const touch = createTouchController(controls);
  touch.begin(1, "move", point(), 0);
  touch.move(1, point(0, -54));
  for (const frame of Array.from(
    { length: 144 },
    (_, index): number => index,
  )) {
    touch.poll(frame * STEP * 1000);
    stepSimulation(state, controls, STEP);
  }
  touch.begin(2, "shot", point(), 1200);
  for (const frame of Array.from({ length: 84 }, (_, index): number => index)) {
    touch.poll(1200 + frame * STEP * 1000);
    stepSimulation(state, controls, STEP);
  }
  touch.end(2, 1900);
  for (const frame of Array.from({ length: 30 }, (_, index): number => index)) {
    touch.poll(1900 + frame * STEP * 1000);
    stepSimulation(state, controls, STEP);
  }
  expect(state.shots).toBe(1);
  expect(
    state.puck.position
      .clone()
      .sub(player.position)
      .dot(forwardVector(player.yaw)),
  ).toBeGreaterThan(0.5);
  expect(state.puck.position.y).toBeGreaterThan(PUCK_HEIGHT);
  expect(player.velocity.length()).toBeGreaterThan(2);
});

test("returning to desktop still uses the original keyboard mapping", (): void => {
  const controls = freshControls();
  const touch = createTouchController(controls);
  touch.begin(1, "curl", point(), 0);
  touch.poll(0);
  touch.clear();
  pollMovement(controls, new Set(["KeyW", "KeyA", "ShiftLeft", "ControlLeft"]));
  expect(controls.forward).toBe(1);
  expect(controls.lateral).toBe(-1);
  expect(controls.sprint).toBe(true);
  expect(controls.vertical).toBe(-1);
  expect(controls.curl).toBe(0);
});

test("mobile shell exposes every action, settings and contextual help once", async (): Promise<void> => {
  const ids: string[] = [];
  const actions: string[] = [];
  await new HTMLRewriter()
    .on("[id]", {
      element(element): void {
        ids.push(element.getAttribute("id") ?? "");
      },
    })
    .on("[data-touch]", {
      element(element): void {
        actions.push(element.getAttribute("data-touch") ?? "");
      },
    })
    .transform(new Response(uiShell()))
    .text();
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(actions).size).toBe(actions.length);
  expect(actions.sort()).toEqual(
    [
      "move",
      "shot",
      "react",
      "rise",
      "descend",
      "curl",
      "reverse",
      "dummy",
      "pull",
      "backhand",
    ].sort(),
  );
  expect(ids).toContain("touch-sensitivity");
  expect(ids).toContain("input-mode");
});
