import { DESKTOP_CONTROL_HELP } from "./control-registry";
import { goalConfettiMarkup } from "./goal-confetti";
import { lobbyMarkup } from "./lobby";
import { multiplayerMarkup } from "./multiplayer/ui";
import { playerDialogMarkup } from "./player-build";
import {
  touchHelpMarkup,
  touchMarkup,
  touchSettingsMarkup,
} from "./touch-markup";
import {
  button,
  control,
  dialog,
  field,
  keycap,
  toggle,
} from "./ui-components";

const handednessField = (): string =>
  field("handedness", "Stick hand", [
    ["right", "Right"],
    ["left", "Left"],
  ]);
export const controlsMarkup = (): string =>
  `<div class="controls-grid keyboard-help">${DESKTOP_CONTROL_HELP.map(
    ([key, label]): string => control(key ?? "", label ?? ""),
  ).join("")}</div>${touchHelpMarkup()}`;

export const uiShell = (): string => `
  <canvas id="pool" tabindex="0" aria-label="Otterpuck playing pool"></canvas><div class="water-vignette" aria-hidden="true"></div>
  ${lobbyMarkup()}
  ${multiplayerMarkup()}
  ${playerDialogMarkup()}
  ${dialog(
    "settings-dialog",
    "Settings",
    `${handednessField()}${toggle("auto-curl", "Auto curl", "Turn hard with the puck to curl")}${field(
      "quality",
      "Graphics",
      [
        ["1.35", "Balanced"],
        ["1", "Performance"],
        ["1.7", "Sharp"],
        ["2", "Extra sharp"],
        ["0.85", "Battery saver"],
      ],
    )}${touchSettingsMarkup()}${["music", "effects"].map((kind): string => `<label class="volume-setting">${kind === "music" ? "Music" : "Effects"}<output id="${kind}-volume-value"></output><input id="${kind}-volume" type="range" min="0" max="100" step="1" aria-label="${kind === "music" ? "Music" : "Effects"} volume"/></label>`).join("")}<div class="settings-row">${button("sound", "Sound on", "secondary", 'aria-pressed="true"')}${button("music", "Music on", "secondary", 'aria-pressed="true"')}</div>${toggle("performance-toggle", "Frame rate", "Show performance details")}<div class="settings-footer">${button("show-credits", "Credits", "quiet")}</div>`,
    "close-settings",
  )}
  ${dialog("controls-dialog", "Controls", controlsMarkup(), "close-controls")}
  ${dialog(
    "credits-dialog",
    "Credits",
    `<div class="credits-card"><p>Created by <a href="https://edwinzhang.com" target="_blank" rel="noreferrer">Edwin Zhang</a></p><p>Developer <a href="https://github.com/PusztaiMateLX" target="_blank" rel="noreferrer">Máté Pusztai</a></p><small>Thank you for helping make the pool more fun.</small></div>`,
    "close-credits",
  )}
  <section id="hud" class="hud hidden" aria-label="Game information">
    <div class="hud-top"><div class="hud-actions">${button("touch-fullscreen", "⛶", "icon", 'aria-label="Enter fullscreen"')}${button("pause-button", "Ⅱ", "icon", 'aria-label="Pause"')}<span class="desktop-shortcuts">${keycap("Esc")} Pause · ${keycap("Ctrl F")} Fullscreen</span></div>
      <div id="tackle-log" class="tackle-log panel" aria-label="Tackle log"></div>
    </div>
    <div class="hud-status-stack">
      <div id="fps" class="performance panel"></div>
      <div class="scoreboard panel"><div class="score-team team-black"><span>BLACK</span><strong id="home-score">0</strong></div><time id="clock">03:00</time><div class="score-team team-white"><strong id="away-score">0</strong><span>WHITE</span></div><span id="match-label" hidden></span><div class="scorers" aria-label="Goal scorers"><ol id="home-scorers" class="team-black"></ol><ol id="away-scorers" class="team-white"></ol></div></div>
      <div class="vitals panel"><div class="vital-row"><div class="vital-label"><span id="air-label">Air</span><span class="vital-value"><strong id="air">100</strong>%</span></div><div class="air-track"><i id="air-fill"></i></div></div><div class="stamina-row"><div class="vital-label"><span>Stamina</span><span class="vital-value"><strong id="stamina-value">100</strong>%</span></div><div class="stamina-track"><i id="stamina-fill"></i></div></div><div id="heart-row" class="heart-row"><div class="vital-label"><span>Heart rate</span><span class="vital-value"><svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg><strong id="heart-rate">70</strong> bpm</span></div></div></div>
      <div id="network-status" hidden><div class="network-server"><span class="network-dot" aria-hidden="true"></span><strong id="network-region"></strong><span id="network-ping">—</span></div><span id="network-issue" role="status" hidden></span></div>
    </div>
    <div id="player-labels" aria-label="Player positions"></div>
    <div id="knockdown-prompt" class="reaction hidden" role="status">${keycap("X")}<strong id="reaction-label">Grab</strong></div>
    <div id="puck-indicator" class="puck-indicator hidden" aria-hidden="true"><span class="puck-indicator-dot"></span><i class="puck-indicator-arrow"></i></div>
    <div id="announcement" class="announcement" role="status"></div>
    <div id="turnover" class="turnover" role="status"><strong id="turnover-title" class="turnover-title"></strong></div>
    ${goalConfettiMarkup()}
    <div class="hud-bottom">
      <div class="handling"><div id="bottom-guidance" class="bottom-guidance panel hidden" role="status"><strong id="bottom-title"></strong><span id="bottom-detail"></span><div id="descend-cue">${keycap("Ctrl")} ↓</div></div><div id="stick-controls"><div id="shot-charge" class="shot-charge"><span></span></div><strong id="handling-mode"></strong></div></div>
      <div id="map-wrap" class="map-wrap panel"><div class="map-title"><span id="role"></span>${keycap("T")}</div><canvas id="map" width="320" height="500" aria-label="Pool minimap"></canvas></div>
    </div>
    <output id="lab-readout" class="lab-readout panel hidden"></output>
  </section>
  ${touchMarkup()}
  <section id="pause" class="overlay hidden" aria-label="Paused">${goalConfettiMarkup()}<div class="pause-card panel"><h1 id="pause-title">Paused</h1><p id="pause-description" role="status"></p>${button("resume", "Resume", "primary")}${button("restart", "Restart")}${button("return-menu", "Menu")}${button("pause-settings", "Settings")}
    <details><summary>Controls</summary>${controlsMarkup()}</details>
  </div></section>`;
