import { pollMovement } from "./handling";
import { createTouchInput, type TouchInput } from "./touch-input";
import { type Controls, clamp, freshControls } from "./types";

export type Input = {
  controls: Controls;
  keys: Set<string>;
  charging: boolean;
  chargeStart: number;
  locked: boolean;
  touch: TouchInput;
  setActive: (active: boolean) => void;
  clear: () => void;
  poll: () => void;
};

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
  const touch = createTouchInput(canvas, controls, onPause);
  const input: Input = {
    controls,
    keys,
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
      input.charging = false;
    },
    poll: (): void => {
      if (touch.enabled) {
        touch.poll();
        input.charging = controls.charging;
        return;
      }
      pollMovement(controls, keys);
      controls.charging = input.charging;
      controls.charge = input.charging
        ? clamp((performance.now() - input.chargeStart) / 650, 0, 1)
        : 0;
    },
  };
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
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === "Escape") onPause();
    if (event.code === "KeyX") controls.knockdown = true;
    if (event.code === "KeyC") controls.dive = true;
    if (event.code === "KeyT") onTactics();
    if (event.code === "KeyP") onReset();
    if (event.code === "KeyV") onLabAction("camera");
    if (event.code === "KeyG") onLabAction("slow");
    if (event.code === "KeyF") onLabAction("feed");
    if (event.code === "KeyL" && event.shiftKey) onLabAction("log");
  });
  window.addEventListener("keyup", (event: KeyboardEvent): void => {
    keys.delete(event.code);
  });
  window.addEventListener("mousemove", (event: MouseEvent): void => {
    if (
      !input.locked ||
      touch.enabled ||
      document.pointerLockElement !== canvas
    )
      return;

    controls.yawDelta -= event.movementX * 0.002;
    controls.pitch = clamp(
      controls.pitch - event.movementY * 0.0017,
      -1.15,
      1.05,
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
    if (event.button === 2) controls.dummyMode = true;
    if (event.button === 0) {
      input.charging = true;
      input.chargeStart = performance.now();
    }
  });
  window.addEventListener("mouseup", (event: MouseEvent): void => {
    if (touch.enabled) return;
    if (event.button === 2) controls.dummyMode = false;
    if (event.button === 0 && input.charging && input.locked) {
      controls.shot = clamp(
        (performance.now() - input.chargeStart) / 650,
        0.22,
        1,
      );
      input.charging = false;
    }
  });

  window.addEventListener("contextmenu", (event: MouseEvent): void => {
    if (input.locked) event.preventDefault();
  });
  return input;
};
