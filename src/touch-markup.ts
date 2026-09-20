import {
  TOUCH_BUTTONS,
  TOUCH_CONTROL_HELP,
  type TouchButtonAction,
} from "./control-registry";
import { control, field } from "./ui-components";

const touchIcon = (glyph: string): string => {
  const paths: Record<string, string> = {
    "⟲": '<path d="M5 10a7 7 0 1 1 1 7M5 5v5h5"/>',
    "⟳": '<path d="M19 10a7 7 0 1 0-1 7M19 5v5h-5"/>',
    "⤳": '<path d="M3 15c4-12 10 6 15-5M15 8l5 1-1 5"/>',
    "↗": '<path d="M5 19 19 5M6 5h13v13"/>',
    "↑": '<path d="M12 20V4M5 11l7-7 7 7"/>',
    "↓": '<path d="M12 4v16M5 13l7 7 7-7"/>',
    hand: '<path d="M7 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-5-2-6-4l-3-4a2 2 0 0 1 3-2l1 1Z"/>',
  };
  return paths[glyph]
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
        paths[glyph] +
        "</svg>"
    : glyph;
};

const touchButton = (action: TouchButtonAction): string => {
  const { glyph, label, description } = TOUCH_BUTTONS[action];
  return `<button type="button" class="touch-button touch-${action}" data-touch="${action}" aria-label="${description}" aria-pressed="false"><span aria-hidden="true">${touchIcon(glyph)}</span><strong>${label}</strong></button>`;
};

export const touchMarkup = (): string => `
  <div id="touch-controls" class="touch-controls" hidden aria-label="Touch controls">
    <div class="touch-left">
      <div class="touch-depth">
        ${touchButton("reverse")}
        ${touchButton("curl")}
      </div>
      <div class="touch-joystick" data-touch="move" role="group" aria-label="Swim and steer joystick; push to the edge to sprint, pull back to brake">
        <span class="touch-sprint-label">SPRINT</span><span class="touch-stick-ring"></span><span id="touch-thumb" class="touch-thumb"></span><span class="touch-brake-label">BRAKE</span>
      </div>
    </div>
    <div class="touch-glance" aria-label="Glance controls">
      ${touchButton("glanceLeft")}
      ${touchButton("glanceRight")}
    </div>
    <div class="touch-skills">
      ${touchButton("rise")}
      ${touchButton("descend")}
      ${touchButton("react")}
      ${touchButton("dummy")}
      ${touchButton("shot")}
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
  `<div class="controls-grid touch-help">${TOUCH_CONTROL_HELP.map(
    ([key, label]): string => control(key ?? "", label ?? ""),
  ).join("")}</div>`;
