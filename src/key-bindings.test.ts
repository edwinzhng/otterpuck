import { expect, test } from "bun:test";
import { pollMovement } from "./handling";
import {
  assignKey,
  bindingAction,
  DEFAULT_KEY_BINDINGS,
  keyCode,
  keyLabel,
  parseKeyBindings,
  withKeyLabels,
} from "./key-bindings";
import { freshControls } from "./types";

test("each action has its own default key", (): void => {
  const codes = Object.values(DEFAULT_KEY_BINDINGS);
  expect(new Set(codes).size).toBe(codes.length);
  expect(DEFAULT_KEY_BINDINGS.freeLook).toBe("KeyF");
  expect(DEFAULT_KEY_BINDINGS.facePuck).toBe("Mouse1");
});

test("taking a key from another action swaps the two keys", (): void => {
  const bindings = assignKey(DEFAULT_KEY_BINDINGS, "grab", "KeyW");
  expect(bindings.grab).toBe("KeyW");
  expect(bindings.forward).toBe("KeyX");
  expect(bindingAction(bindings, "KeyW")).toBe("grab");
});

test("saved bindings keep unique keys and ignore unknown or reserved values", (): void => {
  const bindings = parseKeyBindings({
    forward: "ArrowUp",
    brake: "ArrowUp",
    tactics: "Escape",
    unknown: "KeyZ",
  });
  expect(bindings.brake).toBe("ArrowUp");
  expect(bindings.forward).toBe("KeyS");
  expect(bindings.tactics).toBe("KeyT");
  expect(parseKeyBindings("broken")).toEqual(DEFAULT_KEY_BINDINGS);
});

test("left and right modifiers share one binding", (): void => {
  expect(keyCode("ShiftRight")).toBe("Shift");
  expect(keyCode("ControlLeft")).toBe("Control");
  expect(keyCode("KeyA")).toBe("KeyA");
});

test("labels name keys and mouse buttons", (): void => {
  expect(keyLabel("KeyW")).toBe("W");
  expect(keyLabel("Control")).toBe("Ctrl");
  expect(keyLabel("Mouse1")).toBe("Middle mouse");
  expect(withKeyLabels("{forward} / {brake} {other}")).toBe("W / S {other}");
});

test("movement follows custom bindings", (): void => {
  const bindings = assignKey(
    assignKey(DEFAULT_KEY_BINDINGS, "forward", "ArrowUp"),
    "sprint",
    "Mouse4",
  );
  const controls = freshControls();
  pollMovement(controls, new Set(["ArrowUp", "Mouse4", "KeyW"]), bindings);
  expect(controls.forward).toBe(1);
  expect(controls.sprint).toBe(true);
  pollMovement(controls, new Set(["KeyW"]), bindings);
  expect(controls.forward).toBe(0);
});
