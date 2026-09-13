import { getElement } from "./dom";
import { bindLobby } from "./lobby";
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
    mode: "match",
    duration: 180,
    species: "otter",
    position: 0,
    difficulty: "medium",
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
      event: element("announcement"),
      puckIndicator: element("puck-indicator"),
      role: element("role"),
      handling: element("handling-mode"),
      fps: element("fps"),
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
  for (const id of ["handedness"]) {
    const select = getElement(`#${id}`, HTMLSelectElement);
    select.value = ui.handedness;
    select.addEventListener("change", (): void => {
      ui.handedness = select.value === "left" ? "left" : "right";
      localStorage.setItem("otter-hockey-handedness", ui.handedness);
      for (const target of ["handedness"])
        getElement(`#${target}`, HTMLSelectElement).value = ui.handedness;
    });
  }
  for (const name of ["controls", "settings"]) {
    getElement(`#show-${name}`, HTMLButtonElement).addEventListener(
      "click",
      (): void => getElement(`#${name}-dialog`, HTMLDialogElement).showModal(),
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
