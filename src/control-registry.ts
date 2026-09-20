export const TOUCH_ACTIONS = [
  "move",
  "look",
  "shot",
  "react",
  "rise",
  "descend",
  "curl",
  "reverse",
  "glanceLeft",
  "glanceRight",
  "dummy",
] as const;

export type TouchAction = (typeof TOUCH_ACTIONS)[number];

export const TOUCH_BUTTONS = {
  reverse: {
    glyph: "⟲",
    label: "Reverse",
    description: "Hold for reverse curl",
  },
  curl: {
    glyph: "⟳",
    label: "Curl",
    description: "Hold for regular curl",
  },
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

export const DESKTOP_CONTROL_HELP = [
  ["W / S", "Swim / brake"],
  ["A / D", "Steer"],
  ["Mouse", "Look / aim"],
  ["Shift", "Sprint"],
  ["Space / Ctrl", "Rise / dive"],
  ["LMB", "Hold to charge · release to shoot"],
  ["RMB + A / D", "Dummy"],
  ["Q / E", "Glance"],
  ["X", "Grab / knock down"],
  ["Esc", "Pause"],
] as const;

export const TOUCH_CONTROL_HELP = [
  ["Left thumb", "Swim · steer · sprint at the edge · pull back to brake"],
  ["Right thumb", "Drag to look · hold at the edge to keep turning"],
  ["Look ← / →", "Hold to glance"],
  ["Shoot", "Hold to charge · drag to aim · release to shoot"],
  ["Grab", "Take the puck · knock down incoming shots"],
  ["Curl / Reverse", "Hold to curl with the puck"],
  ["Dummy", "Hold and steer"],
  ["Rise / Dive", "Hold to change depth"],
] as const;
