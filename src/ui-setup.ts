import { getElement } from "./dom";
import { DEFAULT_MATCH_DURATION } from "./game-options";
import { bindLobby } from "./lobby";
import { savedAttributes, savedAutoCurl } from "./player-profile";
import { bindSelectFields } from "./select-fields";
import { DEFAULT_SWIM_TURN } from "./swim-turn";
import { uiShell } from "./ui-shell";
import type { UI } from "./ui-types";

export const createUI = (): UI => {
  getElement("#app", HTMLElement).innerHTML = uiShell();
  const element = (id: string): HTMLElement =>
    getElement(`#${id}`, HTMLElement);
  const ui: UI = {
    canvas: getElement("#pool", HTMLCanvasElement),
    menu: element("menu"),
    hud: element("hud"),
    pause: element("pause"),
    start: getElement("#start", HTMLButtonElement),
    status: element("load-status"),
    arena: getElement("#arena", HTMLSelectElement),
    formation: "2-3-1",
    opposition: "2-3-1",
    teamSize: 6,
    mode: "match",
    duration: DEFAULT_MATCH_DURATION,
    species: "otter",
    team: 0,
    position: 0,
    difficulty: "medium",
    swimTurn: DEFAULT_SWIM_TURN,
    attributes: savedAttributes(),
    autoCurl: savedAutoCurl(),
    handedness:
      localStorage.getItem("otter-hockey-handedness") === "left"
        ? "left"
        : "right",
    tactics: false,
    sound: true,
    music: true,
    map: getElement("#map", HTMLCanvasElement),
    playerLabels: Array.from({ length: 12 }, (): HTMLElement => {
      const label = document.createElement("span");
      label.className = "player-position hidden";
      element("player-labels").append(label);
      return label;
    }),
    elements: {
      clock: element("clock"),
      labReadout: element("lab-readout"),
      homeScore: element("home-score"),
      awayScore: element("away-score"),
      air: element("air"),
      airLabel: element("air-label"),
      stamina: element("stamina-fill"),
      staminaValue: element("stamina-value"),
      event: element("announcement"),
      turnover: element("turnover"),
      turnoverTitle: element("turnover-title"),
      puckIndicator: element("puck-indicator"),
      role: element("role"),
      handling: element("handling-mode"),
      fps: element("fps"),
      tackleLog: element("tackle-log"),
      charge: element("shot-charge"),
      matchLabel: element("match-label"),
      knockdown: element("knockdown-prompt"),
      reactionLabel: element("reaction-label"),
      stickControls: element("stick-controls"),
      bottomGuidance: element("bottom-guidance"),
      bottomTitle: element("bottom-title"),
      bottomDetail: element("bottom-detail"),
      descendCue: element("descend-cue"),
    },
  };
  bindLobby(ui);
  getElement("#handedness", HTMLSelectElement).value = ui.handedness;
  getElement("#handedness", HTMLSelectElement).addEventListener(
    "change",
    (): void => {
      ui.handedness =
        getElement("#handedness", HTMLSelectElement).value === "left"
          ? "left"
          : "right";
      localStorage.setItem("otter-hockey-handedness", ui.handedness);
    },
  );
  bindSelectFields();
  document.addEventListener("click", (event: MouseEvent): void => {
    if (!(event.target instanceof HTMLDialogElement) || !event.target.open)
      return;
    const dialog = event.target;
    const bounds = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;
    if (inside) return;
    const cancel = new Event("cancel", { cancelable: true });
    if (dialog.dispatchEvent(cancel)) dialog.close();
  });
  for (const name of ["controls", "settings", "credits"]) {
    getElement(`#show-${name}`, HTMLButtonElement).addEventListener(
      "click",
      (): void => {
        if (name === "credits")
          getElement("#settings-dialog", HTMLDialogElement).close();
        getElement(`#${name}-dialog`, HTMLDialogElement).showModal();
      },
    );
    getElement(`#close-${name}`, HTMLButtonElement).addEventListener(
      "click",
      (): void => getElement(`#${name}-dialog`, HTMLDialogElement).close(),
    );
  }
  getElement("#performance-toggle", HTMLInputElement).addEventListener(
    "change",
    (event): void => {
      if (event.target instanceof HTMLInputElement)
        document.body.classList.toggle(
          "show-performance",
          event.target.checked,
        );
    },
  );
  return ui;
};
