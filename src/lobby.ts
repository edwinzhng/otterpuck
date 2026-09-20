import { assetUrl } from "./asset-url";
import {
  BOT_DIFFICULTY_OPTIONS,
  botDifficultyChoice,
  DEFAULT_MATCH_DURATION,
  MATCH_DURATION_OPTIONS,
  matchDurationChoice,
} from "./game-options";
import {
  defaultFormation,
  formationChoices,
  sizeFormations,
  sizeLabel,
  TEAM_SIZES,
} from "./positions";
import { refreshSelectField } from "./select-fields";
import type { Formation, TeamSize } from "./types";
import { button, cardButton, field, segmentedButton } from "./ui-components";
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
        ${cardButton('<span aria-hidden="true">◈</span><div><strong>Play vs AI</strong><p>Jump into a bot match</p></div>', "mode-card", 'data-game-mode="match" disabled')}
        ${cardButton(
          `<span aria-hidden="true"><svg
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
</svg></span><div><strong>Play with friends</strong><p>Online or same Wi-Fi</p></div>`,
          "mode-card",
          'id="show-multiplayer"',
        )}
        ${cardButton('<span aria-hidden="true">≈</span><div><strong>Free swim</strong><p>Explore and practice</p></div>', "mode-card", 'data-game-mode="playground" disabled')}
        ${cardButton('<span aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg></span><div><strong>Learn</strong><p>Master the basics</p></div>', "mode-card", 'id="learn-button" disabled')}
      </div>
      <footer class="home-credit">Made with <a href="https://calgaryuwh.com/" target="_blank" rel="noopener noreferrer" aria-label="Calgary Crocs"><span aria-hidden="true">🐊</span></a> by <a href="https://edwinzhang.com" target="_blank" rel="noopener noreferrer">Edwin Zhang</a></footer>
    </section>
    <section class="lobby-screen map-screen" data-screen="map" aria-label="Map" hidden>
      <h1>Map</h1><div class="map-cards">
        ${cardButton(`<img data-src="${assetUrl("/art/arenas/tropical-map.webp")}" decoding="async" alt="Full Tropical Cove pool"/><strong>Tropical Cove</strong>`, "map-card tropical-card", 'data-arena="tropical"')}
        ${cardButton(`<img data-src="${assetUrl("/art/arenas/city-map.webp")}" decoding="async" alt="Full Neon Rooftop pool"/><strong>Neon Rooftop</strong>`, "map-card city-card", 'data-arena="city"')}
      </div>
    </section>
    <section class="lobby-screen setup-screen" data-screen="setup" data-mode="match" aria-label="Game setup" hidden>
      <div class="selected-map"><img id="selected-map-image" data-src="${assetUrl("/art/arenas/tropical-map.webp")}" decoding="async" alt="Selected pool"/>${cardButton('Tropical Cove <span aria-hidden="true">↩</span>', "", 'id="change-map"')}</div>
      <div class="setup-panel"><h1 id="selected-mode">Quick match</h1>
        <section class="setup-section game-setup" data-match-only><h2>Setup</h2>
          <fieldset><legend>Match size</legend><div class="segmented setup-segmented">${TEAM_SIZES.map(
            (size): string =>
              segmentedButton(
                sizeLabel(size),
                size === 6,
                `data-team-size="${size}"`,
              ),
          ).join("")}</div></fieldset>
          <fieldset><legend>Duration</legend><div class="segmented setup-segmented">${MATCH_DURATION_OPTIONS.map(
            ([seconds, label]): string =>
              segmentedButton(
                label,
                seconds === DEFAULT_MATCH_DURATION,
                `data-duration="${seconds}"`,
              ),
          ).join("")}</div></fieldset>
          ${field("difficulty", "Bot skill", BOT_DIFFICULTY_OPTIONS)}
        </section>
        <section class="setup-section team-setup"><h2>Team</h2>
          <fieldset class="team-choice" aria-label="Team"><div class="segmented">${segmentedButton("Otters", true, 'data-species="otter"', "otters")}${segmentedButton("Beavers", false, 'data-species="beaver"', "beavers")}</div></fieldset>
          <div class="team-match-settings" data-match-only>
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
          </div>
        </section>
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
    for (const image of document.querySelectorAll<HTMLImageElement>(
      `[data-screen="${screen}"] img[data-src]`,
    )) {
      image.src = image.dataset.src ?? "";
      delete image.dataset.src;
    }
    if (back) back.hidden = screen === "mode";
  };
  back?.addEventListener("click", (): void =>
    show(state.screen === "setup" ? "map" : "mode"),
  );
  window.addEventListener("keydown", (event: KeyboardEvent): void => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      ui.menu.classList.contains("hidden") ||
      state.screen === "mode"
    )
      return;
    const target = event.target;
    if (
      target instanceof Element &&
      (target.closest("dialog") || target.closest("[data-select-field]"))
    )
      return;
    event.preventDefault();
    back?.click();
  });
  ui.menu.addEventListener("lobby-home", (): void => show("mode"));
  document
    .querySelector("#change-map")
    ?.addEventListener("click", (): void => show("map"));
  const formation = document.querySelector<HTMLSelectElement>("#formation");
  const position = document.querySelector<HTMLSelectElement>("#position");
  const selectSegment = (
    selector: string,
    selected: (button: HTMLButtonElement) => boolean,
  ): void => {
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      selector,
    )) {
      const active = selected(button);
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    }
  };
  const describeMode = (): void => {
    const heading = document.querySelector("#selected-mode");
    if (heading)
      heading.textContent = ui.mode === "match" ? "Quick match" : "Free swim";
  };
  const listPositions = (): void => {
    if (!position) return;
    position.innerHTML = formationChoices(ui.formation)
      .map(
        (choice): string =>
          `<option value="${choice.slot}">${choice.code} · ${choice.name}</option>`,
      )
      .join("");
    refreshSelectField(position);
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
    selectSegment(
      "[data-team-size]",
      (button): boolean => Number(button.dataset.teamSize) === next,
    );
    const choices = sizeFormations(next);
    if (formation) {
      formation.innerHTML = choices
        .map(
          (choice): string =>
            `<option value="${choice}">${formationLabel(choice)}</option>`,
        )
        .join("");
      refreshSelectField(formation);
      formation.parentElement?.classList.toggle("hidden", choices.length < 2);
    }
    chooseFormation(defaultFormation(next));
    position?.parentElement?.classList.toggle("hidden", next === 2);
    describeMode();
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-team-size]",
  ))
    button.addEventListener("click", (): void => {
      const next = TEAM_SIZES.find(
        (candidate): boolean => String(candidate) === button.dataset.teamSize,
      );
      chooseSize(next ?? 6);
    });
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-duration]",
  ))
    button.addEventListener("click", (): void => {
      const duration = matchDurationChoice(button.dataset.duration ?? "");
      if (duration === undefined) return;
      ui.duration = duration;
      selectSegment("[data-duration]", (other): boolean => other === button);
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
  chooseSize(ui.teamSize);
  for (const choice of document.querySelectorAll<HTMLButtonElement>(
    "button[data-game-mode]",
  ))
    choice.addEventListener("click", (): void => {
      ui.mode =
        choice.dataset.gameMode === "match"
          ? "match"
          : choice.dataset.gameMode === "playground"
            ? "playground"
            : "practice";
      const setup = document.querySelector<HTMLElement>(".setup-screen");
      if (setup) setup.dataset.mode = ui.mode;
      describeMode();
      for (const matchOnly of document.querySelectorAll<HTMLElement>(
        "[data-match-only]",
      ))
        matchOnly.hidden = ui.mode !== "match";
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
      if (label) {
        const icon = document.createElement("span");
        icon.ariaHidden = "true";
        icon.textContent = "↩";
        label.replaceChildren(
          ui.arena.value === "city" ? "Neon Rooftop" : "Tropical Cove",
          icon,
        );
      }
      ui.arena.dispatchEvent(new Event("change"));
      show("setup");
    });
  for (const choice of document.querySelectorAll<HTMLButtonElement>(
    "[data-species]",
  ))
    choice.addEventListener("click", (): void => {
      ui.species = choice.dataset.species === "beaver" ? "beaver" : "otter";
      selectSegment("[data-species]", (other): boolean => other === choice);
    });
  const difficulty = document.querySelector<HTMLSelectElement>("#difficulty");
  if (difficulty) difficulty.value = ui.difficulty;
  difficulty?.addEventListener("change", (): void => {
    ui.difficulty = botDifficultyChoice(difficulty.value) ?? "medium";
  });
};
