export const TOUCH_ACTIONS = [
  "move",
  "look",
  "shot",
  "react",
  "rise",
  "descend",
  "glanceLeft",
  "glanceRight",
  "dummy",
] as const;

export type TouchAction = (typeof TOUCH_ACTIONS)[number];

export const TOUCH_BUTTONS = {
  glanceLeft: {
    glyph: "←",
    label: "Look",
    description: "Hold to glance left",
  },
  glanceRight: {
    glyph: "→",
    label: "Look",
    description: "Hold to glance right",
  },
  rise: {
    glyph: "↑",
    label: "Rise",
    description: "Hold to rise or look above water",
  },
  descend: {
    glyph: "↓",
    label: "Dive",
    description: "Hold to dive and descend",
  },
  react: {
    glyph: "hand",
    label: "Grab",
    description: "Grab puck or knock down an incoming shot",
  },
  dummy: {
    glyph: "⤳",
    label: "Dummy",
    description: "Hold and steer to swerve the puck",
  },
  shot: {
    glyph: "↗",
    label: "Shoot",
    description: "Hold to charge, drag to aim, release to shoot",
  },
} as const satisfies Partial<
  Record<TouchAction, { glyph: string; label: string; description: string }>
>;

export type TouchButtonAction = keyof typeof TOUCH_BUTTONS;

// Codes are KeyboardEvent.code values. Modifier codes drop their Left or Right
// suffix, and mouse buttons use "Mouse" plus MouseEvent.button.
export const KEY_BINDING_ACTIONS = {
  forward: { label: "Swim", code: "KeyW" },
  brake: { label: "Brake", code: "KeyS" },
  left: { label: "Steer left", code: "KeyA" },
  right: { label: "Steer right", code: "KeyD" },
  sprint: { label: "Sprint", code: "Shift" },
  rise: { label: "Rise", code: "Space" },
  descend: { label: "Descend", code: "Control" },
  duckDive: { label: "Duck dive", code: "KeyC" },
  shoot: { label: "Shoot", code: "Mouse0" },
  dummy: { label: "Dummy", code: "Mouse2" },
  grab: { label: "Grab", code: "KeyX" },
  glanceLeft: { label: "Glance left", code: "KeyQ" },
  glanceRight: { label: "Glance right", code: "KeyE" },
  freeLook: { label: "Free look", code: "KeyF" },
  facePuck: { label: "Look at puck", code: "Mouse1" },
  tactics: { label: "Tactics", code: "KeyT" },
  retry: { label: "Reset puck", code: "KeyP" },
} as const satisfies Record<string, { label: string; code: string }>;

export type KeyBindingAction = keyof typeof KEY_BINDING_ACTIONS;

// Each {action} token shows the key the player bound to that action.
export const DESKTOP_CONTROL_HELP = [
  ["{forward} / {brake}", "Swim / brake"],
  ["{left} / {right}", "Steer"],
  ["Mouse", "Look / aim"],
  ["{sprint}", "Sprint"],
  ["{rise} / {descend}", "Rise / descend"],
  ["{duckDive}", "Duck dive"],
  ["{shoot}", "Hold to charge · release to shoot"],
  ["{dummy} + {left} / {right}", "Dummy"],
  ["{glanceLeft} / {glanceRight}", "Glance"],
  ["{freeLook}", "Hold to look around and keep your heading"],
  ["{facePuck}", "Turn to the puck"],
  ["{grab}", "Grab / knock down"],
  ["{tactics}", "Tactics"],
  ["Esc", "Pause"],
] as const;

export const TOUCH_CONTROL_HELP = [
  ["Left thumb", "Swim · steer · sprint at the edge · pull back to brake"],
  ["Right thumb", "Drag to look · hold at the edge to keep turning"],
  ["Direction pad", "Glance and change depth"],
  ["Shoot", "Hold to charge · drag to aim · release to shoot"],
  ["Grab", "Take the puck · knock down incoming shots"],
  ["Curl", "Stop swimming and swipe"],
  ["Dummy", "Hold and steer"],
  ["Rise / Dive", "Hold to change depth"],
] as const;
