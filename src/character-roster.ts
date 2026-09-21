import {
  CHARACTER_LABELS,
  CHARACTER_SPECIES,
  type CharacterSpecies,
  isCharacterSpecies,
} from "./characters";
import { cardButton } from "./ui-components";

export const characterChoiceMarkup = (species: CharacterSpecies): string =>
  `<span class="character-choice-icon"><img data-character-preview="${species}" alt="" hidden/></span><span>${CHARACTER_LABELS[species]}</span>`;

export const updateCharacterChoice = (
  control: Element,
  species: CharacterSpecies,
): void => {
  control.innerHTML = characterChoiceMarkup(species);
  void import("./character-previews")
    .then(({ showCharacterPreviews }): Promise<void> => showCharacterPreviews())
    .catch(console.warn);
};

export const characterRosterMarkup = (): string =>
  `<div class="character-grid" role="group" aria-label="Choose your character">${CHARACTER_SPECIES.map(
    (species): string =>
      cardButton(
        `<span class="character-portrait"><img data-character-preview="${species}" alt="" hidden/></span><strong>${CHARACTER_LABELS[species]}</strong>`,
        "character-card",
        `data-character="${species}" aria-pressed="${species === "otter"}"`,
      ),
  ).join("")}</div>`;

export const showCharacterRoster = (
  root: HTMLElement,
  selected: CharacterSpecies,
): void => {
  for (const card of root.querySelectorAll<HTMLButtonElement>(
    "[data-character]",
  ))
    card.setAttribute(
      "aria-pressed",
      String(card.dataset.character === selected),
    );
  void import("./character-previews")
    .then(({ showCharacterPreviews }): Promise<void> => showCharacterPreviews())
    .catch((error: unknown): void => {
      console.warn("Character portraits could not load", error);
    });
};

export const bindCharacterRoster = (
  root: HTMLElement,
  select: (species: CharacterSpecies) => void,
): void => {
  root.addEventListener("click", (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const card = target.closest<HTMLButtonElement>("[data-character]");
    if (
      !card ||
      !root.contains(card) ||
      !isCharacterSpecies(card.dataset.character)
    )
      return;
    select(card.dataset.character);
    showCharacterRoster(root, card.dataset.character);
  });
};
