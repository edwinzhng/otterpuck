import { expect, test } from "bun:test";
import {
  characterChoiceMarkup,
  characterRosterMarkup,
} from "./character-roster";
import {
  CHARACTER_LABELS,
  CHARACTER_SPECIES,
  isCharacterSpecies,
} from "./characters";
import { lobbyMarkup } from "./lobby";
import { multiplayerMarkup } from "./multiplayer/ui";

test("character summary uses a portrait and name without a redundant label", (): void => {
  const markup = characterChoiceMarkup("raccoon");
  expect(markup).toContain('data-character-preview="raccoon"');
  expect(markup).toContain("<span>Raccoon</span>");
  expect(markup).not.toContain("Character ·");
});

test("every playable character has a named portrait choice", (): void => {
  const markup = characterRosterMarkup();
  expect(markup.match(/data-character="/g)).toHaveLength(
    CHARACTER_SPECIES.length,
  );
  for (const species of CHARACTER_SPECIES) {
    expect(markup).toContain(`data-character="${species}"`);
    expect(markup).toContain(`data-character-preview="${species}"`);
    expect(markup).toContain(`<strong>${CHARACTER_LABELS[species]}</strong>`);
    expect(isCharacterSpecies(species)).toBe(true);
  }
  expect(isCharacterSpecies("shark")).toBe(false);
  expect(isCharacterSpecies(undefined)).toBe(false);
  expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
});

test("local setup and team lobby share the character roster without a pre-room picker", (): void => {
  const local = lobbyMarkup();
  expect(local).toContain('data-screen="character"');
  expect(local).toContain('id="change-character"');
  expect(local).toContain('data-team="0"');
  expect(local).toContain('data-team="1"');
  expect(local).not.toContain("data-species=");
  expect(local).toContain(characterRosterMarkup());
  const multiplayer = multiplayerMarkup();
  expect(multiplayer).not.toContain('id="mp-choose-character"');
  expect(multiplayer).not.toContain('id="mp-room-character"');
  expect(multiplayer).toContain("Choose team character");
  expect(multiplayer).toContain(characterRosterMarkup());
});
