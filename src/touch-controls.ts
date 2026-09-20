import type { TouchAction } from "./control-registry";
import { type Controls, clamp, freshControls } from "./types";

export type { TouchAction } from "./control-registry";

export type TouchPoint = { x: number; y: number };
type Contact = {
  action: TouchAction;
  origin: TouchPoint;
  point: TouchPoint;
  started: number;
  radius: number;
};

type TouchState = {
  sprint: boolean;
  sensitivity: number;
  aimScale: number;
  shot: number;
  react: boolean;
  dive: boolean;
  stickAvailable: boolean;
};

export type TouchController = {
  state: TouchState;
  begin: (
    id: number,
    action: TouchAction,
    point: TouchPoint,
    now: number,
    origin?: TouchPoint,
    radius?: number,
  ) => boolean;
  move: (id: number, point: TouchPoint) => void;
  end: (id: number, now: number, cancelled?: boolean) => void;
  held: (action: TouchAction) => boolean;
  joystick: () => TouchPoint;
  poll: (now: number) => void;
  clear: () => void;
  setStickAvailable: (available: boolean) => void;
  setViewportWidth: (width: number) => void;
};

const EDGE_HOLD_ZONE = 72;
const EDGE_TURN_RATE = 4;

export const createTouchController = (controls: Controls): TouchController => {
  const contacts = new Map<number, Contact>();
  let viewportWidth = 0;
  let polledAt: number | undefined;
  const state = {
    sprint: false,
    sensitivity: 1,
    aimScale: 0.004,
    shot: 0,
    react: false,
    dive: false,
    stickAvailable: true,
  };
  const held = (action: TouchAction): boolean => {
    for (const contact of contacts.values())
      if (contact.action === action) return true;
    return false;
  };
  const needsStick = (action: TouchAction): boolean =>
    ["shot", "react", "dummy"].includes(action);
  const begin = (
    id: number,
    action: TouchAction,
    point: TouchPoint,
    now: number,
    origin: TouchPoint = point,
    radius = 54,
  ): boolean => {
    if (
      contacts.has(id) ||
      held(action) ||
      (!state.stickAvailable && needsStick(action))
    )
      return false;
    contacts.set(id, { action, origin, point, started: now, radius });
    if (action === "react") state.react = true;
    if (action === "descend") state.dive = true;
    return true;
  };
  const move = (id: number, point: TouchPoint): void => {
    const contact = contacts.get(id);
    if (!contact) return;
    if (contact.action === "look" || contact.action === "shot") {
      const scale = state.aimScale * state.sensitivity;
      controls.yawDelta -= (point.x - contact.point.x) * scale;
      controls.pitch = clamp(
        controls.pitch - (point.y - contact.point.y) * scale * 0.85,
        -1.15,
        1.05,
      );
    }
    contact.point = point;
  };
  const end = (id: number, now: number, cancelled = false): void => {
    const contact = contacts.get(id);
    if (!contact) return;
    if (contact.action === "shot" && !cancelled)
      state.shot = clamp((now - contact.started) / 650, 0.22, 1);
    if (contact.action === "move") state.sprint = false;
    contacts.delete(id);
  };
  const joystick = (): TouchPoint => {
    for (const contact of contacts.values()) {
      if (contact.action !== "move") continue;
      const x = (contact.point.x - contact.origin.x) / contact.radius;
      const y = (contact.point.y - contact.origin.y) / contact.radius;
      const length = Math.hypot(x, y);
      if (length <= 0.12) return { x: 0, y: 0 };
      const strength = clamp((length - 0.12) / 0.88, 0, 1);
      return { x: (x / length) * strength, y: (y / length) * strength };
    }
    return { x: 0, y: 0 };
  };
  const poll = (now: number): void => {
    const seconds =
      polledAt === undefined ? 0 : clamp((now - polledAt) / 1000, 0, 0.05);
    polledAt = now;
    const stick = joystick();
    controls.forward = stick.y === 0 ? 0 : -stick.y;
    controls.lateral = stick.x;
    state.sprint =
      controls.forward > 0.25 &&
      Math.hypot(stick.x, stick.y) > (state.sprint ? 0.78 : 0.9);
    controls.sprint = state.sprint;
    controls.vertical = Number(held("rise")) - Number(held("descend"));
    controls.curl = 0;
    controls.glance = Number(held("glanceRight")) - Number(held("glanceLeft"));
    controls.dummyMode = held("dummy");
    controls.dummy = controls.dummyMode ? controls.lateral : 0;
    const edgeZone = Math.min(EDGE_HOLD_ZONE, viewportWidth * 0.15);
    if (seconds > 0 && edgeZone > 0) {
      for (const contact of contacts.values()) {
        if (contact.action !== "look") continue;
        const edgeTurn =
          contact.point.x < edgeZone
            ? (contact.point.x - edgeZone) / edgeZone
            : contact.point.x > viewportWidth - edgeZone
              ? (contact.point.x - (viewportWidth - edgeZone)) / edgeZone
              : 0;
        controls.yawDelta -=
          edgeTurn * EDGE_TURN_RATE * seconds * state.sensitivity;
      }
    }
    controls.charging = false;
    controls.charge = 0;
    for (const contact of contacts.values()) {
      if (contact.action !== "shot") continue;
      controls.charging = true;
      controls.charge = clamp((now - contact.started) / 650, 0, 1);
    }
    controls.shot = Math.max(controls.shot, state.shot);
    controls.knockdown ||= state.react;
    controls.dive ||= state.dive;
    state.shot = 0;
    state.react = false;
    state.dive = false;
  };
  const clear = (): void => {
    contacts.clear();
    polledAt = undefined;
    state.sprint = false;
    state.shot = 0;
    state.react = false;
    state.dive = false;
    const { pitch } = controls;
    Object.assign(controls, freshControls(), { pitch });
  };
  const setStickAvailable = (available: boolean): void => {
    state.stickAvailable = available;
    if (available) return;
    for (const [id, contact] of contacts)
      if (needsStick(contact.action)) end(id, 0, true);
    state.shot = 0;
    state.react = false;
    controls.charging = false;
    controls.charge = 0;
    controls.shot = 0;
  };
  return {
    state,
    begin,
    move,
    end,
    held,
    joystick,
    poll,
    clear,
    setStickAvailable,
    setViewportWidth: (width): void => {
      viewportWidth = Math.max(0, width);
    },
  };
};
