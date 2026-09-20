import { TOUCH_ACTIONS } from "./control-registry";
import { atPlayingDepth } from "./depth";
import { getElement } from "./dom";
import { bindFullscreen } from "./fullscreen";
import { puckReaction } from "./handling";
import { createTouchController } from "./touch-controls";
import { type Controls, clamp, type Simulation } from "./types";

export type TouchInput = {
  enabled: boolean;
  setActive: (active: boolean) => void;
  clear: () => void;
  poll: () => void;
  update: (simulation: Simulation) => void;
  dispose: () => void;
};

export const createTouchInput = (
  canvas: HTMLCanvasElement,
  controls: Controls,
  onPause: () => void,
): TouchInput => {
  const controller = createTouchController(controls);
  const root = getElement("#touch-controls", HTMLElement);
  const thumb = getElement("#touch-thumb", HTMLElement);
  const joystick = getElement(".touch-joystick", HTMLElement);
  const mode = getElement("#input-mode", HTMLSelectElement);
  const sensitivity = getElement("#touch-sensitivity", HTMLInputElement);
  const sensitivityValue = getElement(
    "#touch-sensitivity-value",
    HTMLOutputElement,
  );
  const buttons = [
    ...root.querySelectorAll<HTMLButtonElement>("button[data-touch]"),
  ];
  const captures = new Map<number, HTMLElement>();
  const abort = new AbortController();
  const options = { signal: abort.signal };
  bindFullscreen(
    getElement("#touch-fullscreen", HTMLButtonElement),
    onPause,
    abort.signal,
  );
  const coarse = matchMedia("(pointer: coarse)");
  const state = { active: false, x: 0, y: 0, charge: 0 };
  const shot = getElement(".touch-shot", HTMLButtonElement);
  const paint = (): void => {
    const stick = controller.joystick();
    const x = Math.round(stick.x * 44);
    const y = Math.round(stick.y * 44);
    if (x !== state.x || y !== state.y) {
      thumb.style.transform = `translate(${x}px, ${y}px)`;
      state.x = x;
      state.y = y;
    }
    joystick.classList.toggle("sprinting", controller.state.sprint);
    for (const button of buttons) {
      const action = TOUCH_ACTIONS.find(
        (value): boolean => value === button.dataset.touch,
      );
      if (!action) continue;
      const pressed = controller.held(action);
      const value = String(pressed);
      if (button.getAttribute("aria-pressed") !== value)
        button.setAttribute("aria-pressed", value);
    }
    const charge = Math.round(controls.charge * 100);
    if (charge !== state.charge) {
      shot.style.setProperty("--touch-charge", `${charge}%`);
      state.charge = charge;
    }
  };
  const clear = (): void => {
    controller.clear();
    for (const [id, element] of captures)
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    captures.clear();
    paint();
  };
  const input: TouchInput = {
    enabled: false,
    setActive: (active: boolean): void => {
      state.active = active;
      root.hidden = !active || !input.enabled;
      document.body.classList.toggle("touch-playing", active && input.enabled);
      if (!active) clear();
    },
    clear,
    poll: (): void => {
      if (!input.enabled || !state.active) return;
      controller.poll(performance.now());
      paint();
    },
    update: (simulation: Simulation): void => {
      if (!input.enabled) return;
      const player = simulation.players.at(0);
      if (!player) return;
      const available = atPlayingDepth(player);
      controller.setStickAvailable(available);
      const reaction = puckReaction(simulation, player, controls.pitch);
      for (const button of buttons) {
        const action = button.dataset.touch;
        const unavailable =
          ["shot", "dummy", "react"].includes(action ?? "") && !available;
        button.setAttribute("aria-disabled", String(unavailable));
        if (action === "react") {
          button.classList.toggle("ready", reaction !== undefined);
          const label = button.querySelector("strong");
          if (label)
            label.textContent =
              reaction === "knockdown" ? "Knock down" : "Grab";
        }
      }
    },
    dispose: (): void => {
      clear();
      abort.abort();
    },
  };
  const selectMode = (): void => {
    const enabled =
      mode.value === "touch" || (mode.value === "auto" && coarse.matches);
    if (enabled !== input.enabled && state.active) onPause();
    input.enabled = enabled;
    clear();
    document.body.classList.toggle("touch-mode", enabled);
    input.setActive(state.active);
    window.dispatchEvent(new Event("input-mode-change"));
  };
  mode.value =
    ["auto", "touch", "keyboard"].find(
      (value): boolean =>
        value === localStorage.getItem("otterpuck-input-mode"),
    ) ?? "auto";
  sensitivity.value = String(
    clamp(
      Number(localStorage.getItem("otterpuck-touch-sensitivity") ?? 1) || 1,
      0.5,
      2,
    ),
  );
  const setSensitivity = (): void => {
    controller.state.sensitivity = Number(sensitivity.value);
    sensitivityValue.value = `${sensitivity.value}×`;
  };
  setSensitivity();
  selectMode();
  mode.addEventListener(
    "change",
    (): void => {
      localStorage.setItem("otterpuck-input-mode", mode.value);
      selectMode();
    },
    options,
  );
  sensitivity.addEventListener(
    "input",
    (): void => {
      setSensitivity();
      localStorage.setItem("otterpuck-touch-sensitivity", sensitivity.value);
    },
    options,
  );
  coarse.addEventListener("change", selectMode, options);
  const resize = (): void => {
    controller.setViewportWidth(innerWidth);
    controller.state.aimScale =
      2.5 / Math.max(320, Math.min(innerWidth, innerHeight));
    if (!input.enabled) return;
    clear();
  };
  resize();
  window.addEventListener("resize", resize, options);
  const release = (id: number, cancelled: boolean): void => {
    const target = captures.get(id);
    if (!target) return;
    captures.delete(id);
    controller.end(id, performance.now(), cancelled);
    if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
    paint();
  };
  const begin = (event: PointerEvent): void => {
    if (!input.enabled || !state.active || event.button !== 0) return;
    if (!(event.currentTarget instanceof HTMLElement)) return;
    const target = event.currentTarget;
    const action =
      target === canvas
        ? event.clientX > innerWidth * 0.32
          ? "look"
          : undefined
        : TOUCH_ACTIONS.find(
            (value): boolean => value === target.dataset.touch,
          );
    if (!action || target.getAttribute("aria-disabled") === "true") return;
    const bounds =
      action === "move" ? target.getBoundingClientRect() : undefined;
    const point = { x: event.clientX, y: event.clientY };
    const origin = bounds
      ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      : point;
    if (
      !controller.begin(
        event.pointerId,
        action,
        point,
        performance.now(),
        origin,
        bounds ? bounds.width * 0.4 : undefined,
      )
    )
      return;
    event.preventDefault();
    captures.set(event.pointerId, target);
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      release(event.pointerId, true);
    }
    paint();
  };
  const move = (event: PointerEvent): void => {
    if (!captures.has(event.pointerId)) return;
    if (event.buttons === 0) {
      release(event.pointerId, true);
      return;
    }
    event.preventDefault();
    controller.move(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  const end = (event: PointerEvent): void => {
    if (!captures.has(event.pointerId)) return;
    if (event.cancelable) event.preventDefault();
    release(event.pointerId, event.type !== "pointerup");
  };
  for (const target of [canvas, joystick, ...buttons])
    target.addEventListener("pointerdown", begin, options);
  const captureOptions = { ...options, capture: true };
  window.addEventListener("pointermove", move, captureOptions);
  window.addEventListener("pointerup", end, captureOptions);
  window.addEventListener("pointercancel", end, captureOptions);
  window.addEventListener("lostpointercapture", end, captureOptions);
  const cancelEndedTouches = (event: TouchEvent): void => {
    if (event.touches.length !== 0) return;
    for (const id of captures.keys()) release(id, true);
  };
  window.addEventListener("touchend", cancelEndedTouches, {
    ...captureOptions,
    passive: true,
  });
  window.addEventListener("touchcancel", cancelEndedTouches, {
    ...captureOptions,
    passive: true,
  });
  const preventGameplaySelection = (event: Event): void => {
    if (input.enabled && state.active) event.preventDefault();
  };
  document.addEventListener("selectstart", preventGameplaySelection, options);
  document.addEventListener("contextmenu", preventGameplaySelection, options);
  return input;
};
