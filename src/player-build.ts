import { getElement } from "./dom";
import {
  ATTRIBUTE_LABELS,
  ATTRIBUTE_NAMES,
  ATTRIBUTE_POINTS,
  attributePoints,
  MAX_ATTRIBUTE,
  MIN_ATTRIBUTE,
  saveAttributes,
} from "./player-profile";
import type { Attributes } from "./types";
import { button, dialog } from "./ui-components";

const ATTRIBUTE_DETAILS = {
  strength: "Swim faster, shoot further and push weaker swimmers aside.",
  technique:
    "Curl faster, win more puck battles and charge shots quicker. Shots go a little further. Your heart stays calmer on the puck.",
  fitness:
    "Use less air underwater and get it back faster. Stamina lasts longer.",
} as const;

export const playerChoiceMarkup = (attributes: Attributes): string =>
  `<strong>My player</strong><span class="player-choice-stats">${ATTRIBUTE_NAMES.map(
    (name): string =>
      `<span class="player-stat"><small>${ATTRIBUTE_LABELS[name]}</small><b>${attributes[name]}</b></span>`,
  ).join("")}</span>`;

export const playerChoiceButton = (id: string): string =>
  button(id, "", "secondary", "data-player-choice");

export const playerDialogMarkup = (): string =>
  dialog(
    "player-dialog",
    "My player",
    `<p class="build-intro">Share ${ATTRIBUTE_POINTS} points between three qualities. Level 3 plays like a standard swimmer. Each level above or below makes a small difference.</p><fieldset class="player-build" aria-label="Player build"><output id="build-points" class="build-points"></output>${ATTRIBUTE_NAMES.map(
      (name): string =>
        `<div class="build-row"><span class="build-name"><strong id="build-${name}-label">${ATTRIBUTE_LABELS[name]}</strong><small>${ATTRIBUTE_DETAILS[name]}</small></span>${button(`build-${name}-down`, "−", "icon", `aria-label="Lower ${ATTRIBUTE_LABELS[name].toLowerCase()}"`)}<output id="build-${name}" class="build-level" aria-labelledby="build-${name}-label"></output>${button(`build-${name}-up`, "+", "icon", `aria-label="Raise ${ATTRIBUTE_LABELS[name].toLowerCase()}"`)}<i class="build-pips" aria-hidden="true">${"<b></b>".repeat(MAX_ATTRIBUTE)}</i></div>`,
    ).join(
      "",
    )}<small id="build-note" class="build-note" hidden>Your build applies from the next room.</small></fieldset>`,
    "close-player",
  );

export const bindPlayerBuild = (
  profile: { attributes: Attributes },
  apply: (attributes: Attributes) => void,
): void => {
  const modal = getElement("#player-dialog", HTMLDialogElement);
  const points = getElement("#build-points", HTMLOutputElement);
  const render = (): void => {
    const left = ATTRIBUTE_POINTS - attributePoints(profile.attributes);
    points.value = `${left} ${left === 1 ? "point" : "points"} left`;
    for (const name of ATTRIBUTE_NAMES) {
      const level = profile.attributes[name];
      const output = getElement(`#build-${name}`, HTMLOutputElement);
      output.value = String(level);
      getElement(`#build-${name}-down`, HTMLButtonElement).disabled =
        level <= MIN_ATTRIBUTE;
      getElement(`#build-${name}-up`, HTMLButtonElement).disabled =
        level >= MAX_ATTRIBUTE || left <= 0;
      const pips = output.parentElement?.querySelectorAll(".build-pips b");
      for (const [index, pip] of [...(pips ?? [])].entries())
        pip.classList.toggle("filled", index < level);
    }
    for (const choice of document.querySelectorAll<HTMLButtonElement>(
      "[data-player-choice]",
    ))
      choice.innerHTML = playerChoiceMarkup(profile.attributes);
  };
  for (const choice of document.querySelectorAll<HTMLButtonElement>(
    "[data-player-choice]",
  ))
    choice.addEventListener("click", (): void => modal.showModal());
  getElement("#close-player", HTMLButtonElement).addEventListener(
    "click",
    (): void => modal.close(),
  );
  for (const name of ATTRIBUTE_NAMES)
    for (const step of [-1, 1] as const)
      getElement(
        `#build-${name}-${step < 0 ? "down" : "up"}`,
        HTMLButtonElement,
      ).addEventListener("click", (): void => {
        profile.attributes = {
          ...profile.attributes,
          [name]: profile.attributes[name] + step,
        };
        saveAttributes(profile.attributes);
        render();
        apply(profile.attributes);
      });
  render();
};
