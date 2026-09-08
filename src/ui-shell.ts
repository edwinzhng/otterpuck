import { lobbyMarkup } from "./lobby";
import {
  touchHelpMarkup,
  touchMarkup,
  touchSettingsMarkup,
} from "./touch-markup";
import { button, control, dialog, field } from "./ui-components";

const hands: readonly (readonly [string, string])[] = [
  ["right", "Right"],
  ["left", "Left"],
];
export const controlsMarkup = (): string =>
  `<div class="controls-grid keyboard-help">${[
    ["W / S", "Swim / brake"],
    ["A / D", "Turn and swim"],
    ["Shift", "Sprint"],
    ["Space", "Rise / lift head at surface"],
    ["Ctrl", "Descend"],
    ["C", "Duck dive"],
    ["LMB", "Hold to charge · release to shoot"],
    ["RMB + A / D", "Swerve"],
    ["Q / E", "Reverse / regular curl"],
    ["Z", "Pull / push puck"],
    ["X", "Grab / knock down"],
    ["R", "Backhand"],
    ["T", "Tactics"],
    ["P", "Reset practice puck"],
    ["F / V / G", "Practice: feed / camera / slow motion"],
    ["Esc", "Pause"],
  ]
    .map(([key, label]): string => control(key ?? "", label ?? ""))
    .join("")}</div>${touchHelpMarkup()}`;

export const uiShell = (): string => `
  <canvas id="pool" tabindex="0" aria-label="Otterpuck playing pool"></canvas><div class="water-vignette" aria-hidden="true"></div>
  ${lobbyMarkup()}
  ${dialog(
    "settings-dialog",
    "Settings",
    `${field("handedness", "Stick hand", hands)}${field("quality", "Graphics", [
      ["1.35", "Balanced"],
      ["1", "Performance"],
      ["1.7", "Sharp"],
      ["0.85", "Mobile"],
    ])}${touchSettingsMarkup()}<div class="settings-row">${button("sound", "Sound on", "secondary", 'aria-pressed="true"')}${button("music", "Music on", "secondary", 'aria-pressed="true"')}<label><input id="performance-toggle" type="checkbox"/> Frame rate</label></div>`,
    "close-settings",
  )}
  ${dialog("controls-dialog", "Controls", controlsMarkup(), "close-controls")}
  <section id="hud" class="hud hidden" aria-label="Game information">
    <div class="hud-top">${button("pause-button", "Ⅱ", "icon", 'aria-label="Pause"')}
      <div class="scoreboard panel"><div class="score-team otters"><span>OTTERS</span><strong id="home-score">0</strong></div><time id="clock">03:00</time><div class="score-team beavers"><strong id="away-score">0</strong><span>BEAVERS</span></div><span id="match-label" hidden></span></div>
      <div id="fps" class="performance panel"></div>
    </div>
    <div id="player-labels" aria-label="Player positions"></div><div class="crosshair" aria-hidden="true"></div>
    <div id="knockdown-prompt" class="reaction hidden" role="status"><kbd>X</kbd><strong id="reaction-label">Grab</strong></div>
    <div id="announcement" class="announcement" role="status"></div>
    <div class="hud-bottom">
      <div class="vitals panel"><div class="vitals-header"><span id="air-label">Air</span><span id="depth"></span></div><div class="air-value"><strong id="air">100</strong><span>%</span></div><div class="air-track"><i id="air-fill"></i></div><span id="speed" class="speed-value"></span></div>
      <div class="handling"><div id="bottom-guidance" class="bottom-guidance panel hidden" role="status"><strong id="bottom-title"></strong><span id="bottom-detail"></span><div id="descend-cue"><kbd>Ctrl</kbd> ↓</div></div><div id="stick-controls"><div id="shot-charge" class="shot-charge"><span></span></div><strong id="handling-mode"></strong></div></div>
      <div id="map-wrap" class="map-wrap panel"><div class="map-title"><span id="role"></span><kbd>T</kbd></div><canvas id="map" width="320" height="500" aria-label="Pool minimap"></canvas></div>
    </div>
    <output id="lab-readout" class="lab-readout panel hidden"></output>
  </section>
  ${touchMarkup()}
  <section id="pause" class="overlay hidden" aria-label="Paused"><div class="pause-card panel"><h1 id="pause-title">Paused</h1><p id="pause-description" role="status"></p>${button("resume", "Resume", "primary")}${button("restart", "Restart")}${button("return-menu", "Menu")}
    <div id="lab-settings" class="lab-settings hidden">${["drag", "lift"].map((key): string => `<label>${key === "drag" ? "Drag" : "Lift"}<output id="${key}-value">1×</output><input id="lab-${key}" type="range" min="${key === "drag" ? ".4" : ".3"}" max="${key === "drag" ? "2" : "1.8"}" step=".1" value="1"/></label>`).join("")}<div class="button-row">${button("lab-reset", "Reset puck")}${button("lab-feed", "Incoming shot")}</div>${button("lab-defaults", "Reset physics", "quiet")}</div>
    <details><summary>Controls</summary>${controlsMarkup()}</details>${field("pause-handedness", "Stick hand", hands)}
  </div></section>`;
