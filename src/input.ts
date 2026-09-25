import type { KeyBindingAction } from "./control-registry";
import { pollMovement } from "./handling";
import {
  bindingAction,
  currentKeyBindings,
  keyCode,
  mouseCode,
} from "./key-bindings";
import { freshLook, type Look, moveLook, startSeek } from "./look-controls";
import { MAX_HELD } from "./player-profile";
import { createTouchInput, type TouchInput } from "./touch-input";
import { type Controls, clamp, freshControls } from "./types";

export type Input = {
  controls: Controls;
  keys: Set<string>;
  look: Look;
  charging: boolean;
  chargeStart: number;
  locked: boolean;
  touch: TouchInput;
  setActive: (active: boolean) => void;
  clear: () => void;
  poll: () => void;
};

// A second free look press this soon after the first also watches the puck.
const DOUBLE_TAP_MS = 300;

// Practice tools that are not in the key bindings. A bound key takes priority.
const LAB_KEYS = {
  KeyV: "camera",
  KeyG: "slow",
  KeyR: "feed",
} as const;

export const createInput = (
  canvas: HTMLCanvasElement,
  onPause: () => void,
  onTactics: () => void,
  onReset: () => void,
  onLabAction: (action: "camera" | "slow" | "feed" | "log") => void,
): Input => {
  const controls = freshControls();
  const keys = new Set<string>();
  const capture = { held: false };
  const freeLookTap = { last: -Infinity, watching: false };
  const touch = createTouchInput(canvas, controls, onPause);
  const input: Input = {
    controls,
    keys,
    look: freshLook(),
    charging: false,
    chargeStart: 0,
    locked: false,
    touch,
    setActive: (active: boolean): void => {
      input.locked = active;
      touch.setActive(active);
      if (!active) input.clear();
    },
    clear: (): void => {
      keys.clear();
      touch.clear();
      const { pitch } = controls;
      Object.assign(controls, freshControls(), { pitch });
      Object.assign(input.look, freshLook());
      input.charging = false;
    },
    poll: (): void => {
      if (touch.enabled) {
        touch.poll();
        input.charging = controls.charging;
        return;
      }
      pollMovement(controls, keys, currentKeyBindings());
      controls.charging = input.charging;
      controls.charge = input.charging
        ? clamp((performance.now() - input.chargeStart) / 650, 0, MAX_HELD)
        : 0;
    },
  };
  const press = (action: KeyBindingAction | undefined): void => {
    if (action === "grab") controls.knockdown = true;
    if (action === "duckDive") controls.dive = true;
    if (action === "dummy") controls.dummyMode = true;
    if (action === "tactics") onTactics();
    if (action === "retry") onReset();
    if (action === "freeLook") {
      const now = performance.now();
      input.look.free = true;
      freeLookTap.watching = now - freeLookTap.last < DOUBLE_TAP_MS;
      if (freeLookTap.watching) startSeek(input.look);
      freeLookTap.last = now;
    }
    if (action === "facePuck") startSeek(input.look);
    if (action === "shoot") {
      input.charging = true;
      input.chargeStart = performance.now();
    }
  };
  const release = (action: KeyBindingAction | undefined): void => {
    if (action === "dummy") controls.dummyMode = false;
    if (action === "freeLook") {
      input.look.free = false;
      // Watching the puck only moved the camera, so it must not go on to
      // turn the swimmer once free look ends.
      if (freeLookTap.watching) {
        input.look.seekHeld = false;
        input.look.seeking = false;
      }
      freeLookTap.watching = false;
    }
    if (action === "facePuck") input.look.seekHeld = false;
    if (action === "shoot" && input.charging && input.locked) {
      // The hold fraction goes to the simulation, which applies the minimum
      // power and the player's charge speed.
      controls.shot = clamp(
        (performance.now() - input.chargeStart) / 650,
        0.01,
        MAX_HELD,
      );
      input.charging = false;
    }
  };
  const actionFor = (code: string): KeyBindingAction | undefined =>
    bindingAction(currentKeyBindings(), code);
  document.addEventListener("pointerlockchange", (): void => {
    const held = document.pointerLockElement === canvas;
    document.body.classList.toggle("pointer-captured", held);
    if (capture.held && !held) {
      input.clear();
      onPause();
    }
    capture.held = held;
  });
  window.addEventListener("blur", (): void => {
    input.clear();
    if (input.locked) onPause();
  });
  document.addEventListener("visibilitychange", (): void => {
    if (document.hidden) {
      input.clear();
      onPause();
    }
  });
  window.addEventListener("keydown", (event: KeyboardEvent): void => {
    if (!input.locked) return;
    if (touch.enabled) {
      if (event.code === "Escape") onPause();
      return;
    }
    if (event.code === "KeyF" && event.ctrlKey) return;
    event.preventDefault();
    const code = keyCode(event.code);
    keys.add(code);
    if (event.repeat) return;
    if (code === "Escape") onPause();
    const action = actionFor(code);
    press(action);
    if (action) return;
    if (code === "KeyL" && event.shiftKey) onLabAction("log");
    const lab = LAB_KEYS[code as keyof typeof LAB_KEYS];
    if (lab) onLabAction(lab);
  });
  window.addEventListener("keyup", (event: KeyboardEvent): void => {
    const code = keyCode(event.code);
    keys.delete(code);
    if (!touch.enabled) release(actionFor(code));
  });
  window.addEventListener("mousemove", (event: MouseEvent): void => {
    if (
      !input.locked ||
      touch.enabled ||
      document.pointerLockElement !== canvas
    )
      return;
    moveLook(
      input.look,
      controls,
      -event.movementX * 0.002,
      -event.movementY * 0.0017,
    );
  });
  window.addEventListener("mousedown", (event: MouseEvent): void => {
    if (
      !input.locked ||
      touch.enabled ||
      document.pointerLockElement !== canvas
    )
      return;
    if (
      event.target instanceof Element &&
      event.target.closest("button, dialog")
    )
      return;
    const code = mouseCode(event.button);
    if (event.button !== 0 && event.button !== 2) event.preventDefault();
    keys.add(code);
    press(actionFor(code));
  });
  window.addEventListener("mouseup", (event: MouseEvent): void => {
    if (touch.enabled) return;
    // Stop middle-click autoscroll and back or forward navigation on the
    // extra mouse buttons while they are bound to game actions.
    if (input.locked && event.button !== 0 && event.button !== 2)
      event.preventDefault();
    const code = mouseCode(event.button);
    keys.delete(code);
    release(actionFor(code));
  });

  window.addEventListener("contextmenu", (event: MouseEvent): void => {
    if (input.locked) event.preventDefault();
  });
  return input;
};
