import type { TouchAction } from "./touch-controls";
import { control, field } from "./ui-components";

const touchButton = (
  action: TouchAction,
  glyph: string,
  label: string,
  description: string,
): string =>
  `<button type="button" class="touch-button touch-${action}" data-touch="${action}" aria-label="${description}" aria-pressed="false"><span aria-hidden="true">${glyph}</span><strong>${label}</strong></button>`;

export const touchMarkup = (): string => `
  <div id="touch-controls" class="touch-controls" hidden aria-label="Touch controls">
    <div class="touch-left">
      <div class="touch-depth">
        ${touchButton("rise", "↑", "Rise", "Hold to rise or look above water")}
        ${touchButton("descend", "↓", "Dive", "Hold to dive and descend")}
      </div>
      <div class="touch-joystick" data-touch="move" role="group" aria-label="Swim and steer joystick; push to the edge to sprint, pull back to brake">
        <span class="touch-sprint-label">SPRINT</span><span class="touch-stick-ring"></span><span id="touch-thumb" class="touch-thumb"></span><span class="touch-brake-label">BRAKE</span>
      </div>
    </div>
    <div class="touch-skills">
      ${touchButton("reverse", "↶", "Reverse", "Hold for reverse curl")}
      ${touchButton("curl", "↷", "Curl", "Hold for regular curl")}
      ${touchButton("react", "✦", "Grab", "Grab puck or knock down an incoming shot")}
      ${touchButton("dummy", "⇆", "Swerve", "Hold and steer to swerve the puck")}
      ${touchButton("pull", "↕", "Pull", "Hold to pull puck back; release to push forward")}
      ${touchButton("shot", "↗", "Shoot", "Hold to charge, drag to aim, release to shoot")}
      ${touchButton("backhand", "⤴", "Backhand", "Toggle backhand shot")}
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
    ["Swerve", "Hold while steering left or right"],
    ["Pull", "Hold to pull back · release to push forward"],
    [
      "Rise / Dive",
      "Hold to change depth · Rise lifts your head at the surface",
    ],
    ["Backhand", "Toggle shot side"],
  ]
    .map(([key, label]): string => control(key ?? "", label ?? ""))
    .join("")}</div>`;
