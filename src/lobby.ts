import { assetUrl } from "./asset-url";
import {
  defaultFormation,
  formationChoices,
  sizeFormations,
  sizeLabel,
  TEAM_SIZES,
} from "./positions";
import type { Formation, TeamSize } from "./types";
import { button, field } from "./ui-components";
import type { UI } from "./ui-types";

const formationLabel = (formation: Formation): string =>
  formation.replaceAll("-", "–");

export const lobbyMarkup = (): string => `
  <div id="menu" class="menu">
    <header class="menu-header"><a class="wordmark" href="/">OTTERPUCK</a><nav>
      ${button("lobby-back", "←", "icon", 'aria-label="Back" hidden')}
      ${button("show-controls", "?", "icon", 'aria-label="Controls"')}
      ${button("show-settings", "⚙", "icon", 'aria-label="Settings"')}
    </nav></header>
    <section class="lobby-screen mode-screen" data-screen="mode" aria-label="Game modes">
      <div class="mode-list">
        <button type="button" class="mode-card" data-mode="match" disabled><span aria-hidden="true">◈</span><div><strong>Play vs AI</strong><p>Jump into a bot match</p></div></button>
        <button id="show-multiplayer" type="button" class="mode-card"><span aria-hidden="true"><svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m13 19 6-6" />
  <path d="M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5" />
  <path d="m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586" />
  <path d="m16 16 4 4" />
  <path d="m19 21 2-2" />
  <path d="m5 14 4 4" />
  <path d="m5 21-2-2" />
  <path d="M7.5 16.5 4 20" />
</svg></span><div><strong>Play with friends</strong><p>Online or same Wi-Fi</p></div></button>
        <button type="button" class="mode-card" data-mode="playground" disabled><span aria-hidden="true">≈</span><div><strong>Free swim</strong><p>Explore and practice</p></div></button>
        <button id="learn-button" type="button" class="mode-card" disabled><span aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg></span><div><strong>Learn</strong><p>Master the basics</p></div></button>
      </div>
      <footer class="home-credit">Made with <a href="https://calgaryuwh.com/" target="_blank" rel="noopener noreferrer" aria-label="Calgary Crocs"><span aria-hidden="true">🐊</span></a> by <a href="https://edwinzhang.com" target="_blank" rel="noopener noreferrer">Edwin Zhang</a></footer>
    </section>
    <section class="lobby-screen map-screen" data-screen="map" aria-label="Map" hidden>
      <h1>Map</h1><div class="map-cards">
        <button type="button" class="map-card tropical-card" data-arena="tropical"><img src="${assetUrl("/art/arenas/tropical-map.webp")}" alt="Full Tropical Cove pool"/><strong>Tropical Cove</strong><span aria-hidden="true">↗</span></button>
        <button type="button" class="map-card city-card" data-arena="city"><img src="${assetUrl("/art/arenas/city-map.webp")}" alt="Full Neon Rooftop pool"/><strong>Neon Rooftop</strong><span aria-hidden="true">↗</span></button>
      </div>
    </section>
    <section class="lobby-screen setup-screen" data-screen="setup" aria-label="Game setup" hidden>
      <div class="selected-map"><img id="selected-map-image" src="${assetUrl("/art/arenas/tropical-map.webp")}" alt="Selected pool"/><button id="change-map" type="button">Tropical Cove <span aria-hidden="true">↗</span></button></div>
      <div class="setup-panel"><h1 id="selected-mode">Quick match · 6v6</h1>
        <fieldset class="team-choice"><legend>Team</legend><div class="segmented"><button type="button" class="selected otters" data-species="otter" aria-pressed="true">Otters</button><button type="button" class="beavers" data-species="beaver" aria-pressed="false">Beavers</button></div></fieldset>
        <div class="match-setup">
          ${field(
            "team-size",
            "Match size",
            TEAM_SIZES.map((size): [string, string] => [
              String(size),
              sizeLabel(size),
            ]),
          )}
          ${field(
            "formation",
            "Formation",
            sizeFormations(6).map((formation): [string, string] => [
              formation,
              formationLabel(formation),
            ]),
          )}
          ${field(
            "position",
            "Position",
            formationChoices("2-3-1").map((position): [string, string] => [
              String(position.slot),
              `${position.code} · ${position.name}`,
            ]),
          )}
          ${field("difficulty", "Bots", [
            ["easy", "Easy"],
            ["medium", "Medium"],
            ["hard", "Hard"],
            ["elite", "Elite"],
          ])}
        </div>
        ${button("start", "Play", "primary", "disabled")}
      </div>
    </section>
    <p id="load-status" class="load-status" role="status">Loading…</p>
    <select id="arena" aria-label="Arena" hidden><option value="tropical">Tropical Cove</option><option value="city">Neon Rooftop</option></select>
  </div>`;

export const bindLobby = (ui: UI): void => {
  const back = document.querySelector<HTMLButtonElement>("#lobby-back");
  const state = { screen: "mode" };
  const show = (screen: string): void => {
    state.screen = screen;
    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-screen]",
    ))
      element.hidden = element.dataset.screen !== screen;
    if (back) back.hidden = screen === "mode";
  };
  back?.addEventListener("click", (): void =>
    show(state.screen === "setup" ? "map" : "mode"),
  );
  ui.menu.addEventListener("lobby-home", (): void => show("mode"));
  document
    .querySelector("#change-map")
    ?.addEventListener("click", (): void => show("map"));
  const formation = document.querySelector<HTMLSelectElement>("#formation");
  const position = document.querySelector<HTMLSelectElement>("#position");
  const size = document.querySelector<HTMLSelectElement>("#team-size");
  const describeMode = (): void => {
    const heading = document.querySelector("#selected-mode");
    if (heading)
      heading.textContent =
        ui.mode === "match"
          ? `Quick match · ${sizeLabel(ui.teamSize)}`
          : "Free swim";
  };
  const listPositions = (): void => {
    if (!position) return;
    position.innerHTML = formationChoices(ui.formation)
      .map(
        (choice): string =>
          `<option value="${choice.slot}">${choice.code} · ${choice.name}</option>`,
      )
      .join("");
  };
  const chooseFormation = (next: Formation): void => {
    ui.formation = next;
    ui.opposition = next;
    ui.position = 0;
    if (formation) formation.value = next;
    listPositions();
  };
  const chooseSize = (next: TeamSize): void => {
    ui.teamSize = next;
    const choices = sizeFormations(next);
    if (formation) {
      formation.innerHTML = choices
        .map(
          (choice): string =>
            `<option value="${choice}">${formationLabel(choice)}</option>`,
        )
        .join("");
      formation.parentElement?.classList.toggle("hidden", choices.length < 2);
    }
    chooseFormation(defaultFormation(next));
    describeMode();
  };
  size?.addEventListener("change", (): void => {
    const next = TEAM_SIZES.find(
      (candidate): boolean => String(candidate) === size.value,
    );
    chooseSize(next ?? 6);
  });
  formation?.addEventListener("change", (): void => {
    const next = sizeFormations(ui.teamSize).find(
      (candidate): boolean => candidate === formation.value,
    );
    chooseFormation(next ?? defaultFormation(ui.teamSize));
  });
  position?.addEventListener("change", (): void => {
    ui.position = Number(position.value);
  });
  if (size) size.value = String(ui.teamSize);
  chooseSize(ui.teamSize);
  for (const choice of document.querySelectorAll<HTMLButtonElement>(
    "[data-mode]",
  ))
    choice.addEventListener("click", (): void => {
      ui.mode =
        choice.dataset.mode === "match"
          ? "match"
          : choice.dataset.mode === "playground"
            ? "playground"
            : "practice";
      describeMode();
      const match = document.querySelector<HTMLElement>(".match-setup");
      if (match) match.hidden = ui.mode !== "match";
      show("map");
    });
  for (const choice of document.querySelectorAll<HTMLButtonElement>(
    "[data-arena]",
  ))
    choice.addEventListener("click", (): void => {
      ui.arena.value = choice.dataset.arena === "city" ? "city" : "tropical";
      const image = document.querySelector<HTMLImageElement>(
        "#selected-map-image",
      );
      if (image) image.src = assetUrl(`/art/arenas/${ui.arena.value}-map.webp`);
      const label = document.querySelector("#change-map");
      if (label)
        label.textContent =
          ui.arena.value === "city" ? "Neon Rooftop ↗" : "Tropical Cove ↗";
      ui.arena.dispatchEvent(new Event("change"));
      show("setup");
    });
  for (const choice of document.querySelectorAll<HTMLButtonElement>(
    "[data-species]",
  ))
    choice.addEventListener("click", (): void => {
      ui.species = choice.dataset.species === "beaver" ? "beaver" : "otter";
      for (const other of document.querySelectorAll<HTMLButtonElement>(
        "[data-species]",
      )) {
        other.classList.toggle("selected", other === choice);
        other.setAttribute("aria-pressed", String(other === choice));
      }
    });
  const difficulty = document.querySelector<HTMLSelectElement>("#difficulty");
  if (difficulty) difficulty.value = ui.difficulty;
  difficulty?.addEventListener("change", (): void => {
    ui.difficulty =
      difficulty.value === "elite"
        ? "elite"
        : difficulty.value === "hard"
          ? "hard"
          : difficulty.value === "easy"
            ? "easy"
            : "medium";
  });
};
