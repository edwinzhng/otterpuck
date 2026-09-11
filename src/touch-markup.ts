import type { TouchAction } from "./touch-controls";
import { control, field } from "./ui-components";

const touchIcon = (glyph: string): string => {
  const paths: Record<string, string> = {
    "⟲": '<path d="M5 10a7 7 0 1 1 1 7M5 5v5h5"/>',
    "⟳": '<path d="M19 10a7 7 0 1 0-1 7M19 5v5h-5"/>',
    "⤳": '<path d="M3 15c4-12 10 6 15-5M15 8l5 1-1 5"/>',
    "↗": '<path d="M5 19 19 5M6 5h13v13"/>',
    "↑": '<path d="M12 20V4M5 11l7-7 7 7"/>',
    "↓": '<path d="M12 4v16M5 13l7 7 7-7"/>',
  };
  return paths[glyph]
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
        paths[glyph] +
        "</svg>"
    : glyph;
};

const touchButton = (
  action: TouchAction,
  glyph: string,
  label: string,
  description: string,
): string =>
  `<button type="button" class="touch-button touch-${action}" data-touch="${action}" aria-label="${description}" aria-pressed="false"><span aria-hidden="true">${touchIcon(glyph)}</span><strong>${label}</strong></button>`;

export const touchMarkup = (): string => `
  <div id="touch-controls" class="touch-controls" hidden aria-label="Touch controls">
    <div class="touch-left">
      <div class="touch-depth">
        ${touchButton("reverse", "⟲", "Reverse", "Hold for reverse curl")}
        ${touchButton("curl", "⟳", "Curl", "Hold for regular curl")}
      </div>
      <div class="touch-joystick" data-touch="move" role="group" aria-label="Swim and steer joystick; push to the edge to sprint, pull back to brake">
        <span class="touch-sprint-label">SPRINT</span><span class="touch-stick-ring"></span><span id="touch-thumb" class="touch-thumb"></span><span class="touch-brake-label">BRAKE</span>
      </div>
    </div>
    <div class="touch-skills">
      ${touchButton("rise", "↑", "Rise", "Hold to rise or look above water")}
      ${touchButton("descend", "↓", "Dive", "Hold to dive and descend")}
      ${touchButton("react", `<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-5-2-6-4l-3-4a2 2 0 0 1 3-2l1 1Z"/></svg>`, "Grab", "Grab puck or knock down an incoming shot")}
      ${touchButton("dummy", "⤳", "Dummy", "Hold and steer to swerve the puck")}
      ${touchButton("shot", "↗", "Shoot", "Hold to charge, drag to aim, release to shoot")}
    </div>
  </div>`;

export const touchSettingsMarkup = (): string => `
  ${field("input-mode", "Controls", [
    ["auto", "Automatic"],
    ["touch", "Touch"],
    ["keyboard", "Mouse & keyboard"],
  ])}
  <label class="field touch-sensitivity" for="touch-sensitivity"><span>Touch sensitivity <output id="touch-sensitivity-value">1×</output></span><input id="touch-sensitivity" type="range" min="0.5" max="2" step="0.1" value="1"/></label>`;

export const touchHelpMarkup = (): string =>
  `<div class="controls-grid touch-help">${[
    ["Left thumb", "Swim and steer · outer edge sprints · pull back to brake"],
    ["Right thumb", "Drag the water to look"],
    ["Shoot", "Hold to charge · drag to aim · release to shoot"],
    ["Grab", "Grab nearby puck or knock down an incoming shot"],
    ["Curl / Reverse", "Hold to turn with the puck"],
    ["Dummy", "Hold while steering left or right"],
    [
      "Rise / Dive",
      "Hold to change depth · Rise lifts your head at the surface",
    ],
  ]
    .map(([key, label]): string => control(key ?? "", label ?? ""))
    .join("")}</div>`;
