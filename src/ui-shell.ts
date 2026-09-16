import { goalConfettiMarkup } from "./goal-confetti";
import { lobbyMarkup } from "./lobby";
import { multiplayerMarkup } from "./multiplayer/ui";
import {
  touchHelpMarkup,
  touchMarkup,
  touchSettingsMarkup,
} from "./touch-markup";
import { button, control, dialog, field } from "./ui-components";

const handednessField = (): string =>
  field("handedness", "Stick hand", [
    ["right", "Right"],
    ["left", "Left"],
  ]);
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
    ["Esc", "Pause / release mouse"],
    ["Ctrl + F", "Toggle fullscreen"],
    ["H / P", "Tutorial: help / retry"],
  ]
    .map(([key, label]): string => control(key ?? "", label ?? ""))
    .join("")}</div>${touchHelpMarkup()}`;

export const uiShell = (): string => `
  <canvas id="pool" tabindex="0" aria-label="Otterpuck playing pool"></canvas><div class="water-vignette" aria-hidden="true"></div><div id="arena-fade" aria-hidden="true"></div>
  ${lobbyMarkup()}
  ${multiplayerMarkup()}
  ${dialog(
    "settings-dialog",
    "Settings",
    `${handednessField()}${field("quality", "Graphics", [
      ["1.35", "Balanced"],
      ["1", "Performance"],
      ["1.7", "Sharp"],
      ["2", "Extra sharp"],
      ["0.85", "Battery saver"],
    ])}${touchSettingsMarkup()}${["music", "effects"].map((kind): string => `<label class="volume-setting">${kind === "music" ? "Music" : "Effects"}<output id="${kind}-volume-value"></output><input id="${kind}-volume" type="range" min="0" max="100" step="1" aria-label="${kind === "music" ? "Music" : "Effects"} volume"/></label>`).join("")}<div class="settings-row">${button("sound", "Sound on", "secondary", 'aria-pressed="true"')}${button("music", "Music on", "secondary", 'aria-pressed="true"')}<label><input id="performance-toggle" type="checkbox"/> Frame rate</label></div>`,
    "close-settings",
  )}
  ${dialog("controls-dialog", "Controls", controlsMarkup(), "close-controls")}
  <section id="hud" class="hud hidden show-tackles" aria-label="Game information">
    <div class="hud-top"><div class="hud-actions">${button("touch-fullscreen", "⛶", "icon", 'aria-label="Enter fullscreen"')}${button("pause-button", "Ⅱ", "icon", 'aria-label="Pause"')}<div id="network-status" hidden><div class="network-server"><span class="network-dot" aria-hidden="true"></span><strong id="network-region"></strong><span id="network-ping">—</span></div><span id="network-issue" role="status" hidden></span></div><span class="desktop-shortcuts">Esc Pause · Ctrl F Fullscreen</span></div>
      <div class="scoreboard panel"><div class="score-team otters"><span>OTTERS</span><strong id="home-score">0</strong></div><time id="clock">03:00</time><div class="score-team beavers"><strong id="away-score">0</strong><span>BEAVERS</span></div><span id="match-label" hidden></span></div>
      <div id="fps" class="performance panel"></div>
      <div id="tackle-log" class="tackle-log panel" aria-label="Tackle log"></div>
    </div>
    <div id="player-labels" aria-label="Player positions"></div><div class="crosshair" aria-hidden="true"></div>
    <div id="knockdown-prompt" class="reaction hidden" role="status"><kbd>X</kbd><strong id="reaction-label">Grab</strong></div>
    <div id="puck-indicator" class="puck-indicator hidden" aria-hidden="true"><span class="puck-indicator-dot"></span><i class="puck-indicator-arrow"></i></div>
    <div id="announcement" class="announcement" role="status"></div>
    ${goalConfettiMarkup()}
    <div class="hud-bottom">
      <div class="vitals panel"><div class="vitals-header"><span id="air-label">Air</span></div><div class="air-value"><strong id="air">100</strong><span>%</span></div><div class="air-track"><i id="air-fill"></i></div><div class="stamina-row"><span>Stamina</span><div class="stamina-track"><i id="stamina-fill"></i></div></div></div>
      <div class="handling"><div id="bottom-guidance" class="bottom-guidance panel hidden" role="status"><strong id="bottom-title"></strong><span id="bottom-detail"></span><div id="descend-cue"><kbd>Ctrl</kbd> ↓</div></div><div id="stick-controls"><div id="shot-charge" class="shot-charge"><span></span></div><strong id="handling-mode"></strong></div></div>
      <div id="map-wrap" class="map-wrap panel"><div class="map-title"><span id="role"></span><kbd>T</kbd></div><canvas id="map" width="320" height="500" aria-label="Pool minimap"></canvas></div>
    </div>
    <output id="lab-readout" class="lab-readout panel hidden"></output>
  </section>
  ${touchMarkup()}
  <section id="pause" class="overlay hidden" aria-label="Paused">${goalConfettiMarkup()}<div class="pause-card panel"><h1 id="pause-title">Paused</h1><p id="pause-description" role="status"></p>${button("resume", "Resume", "primary")}${button("restart", "Restart")}${button("return-menu", "Menu")}${button("pause-settings", "Settings")}
    <details><summary>Controls</summary>${controlsMarkup()}</details>
  </div></section>`;
