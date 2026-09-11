import { formationChoices } from "./positions";
import type { UI } from "./ui";
import { button, field } from "./ui-components";

export const lobbyMarkup = (): string => `
  <div id="menu" class="menu">
    <header class="menu-header"><a class="wordmark" href="/">OTTERPUCK</a><nav>
      ${button("lobby-back", "←", "icon", 'aria-label="Back" hidden')}
      ${button("show-controls", "?", "icon", 'aria-label="Controls"')}
      ${button("show-settings", "⚙", "icon", 'aria-label="Settings"')}
    </nav></header>
    <section class="lobby-screen mode-screen" data-screen="mode" aria-label="Game modes">
      <div class="mode-list">${[
        ["match", "Quick match", "◈", "6v6 vs AI team"],
        [
          "playground",
          "Free swim",
          "≈",
          "Explore the pool and practice puck skills",
        ],
      ]
        .map(
          ([mode, label, icon, detail]): string =>
            `<button type="button" class="mode-card" data-mode="${mode}" disabled><span aria-hidden="true">${icon}</span><div><strong>${label}</strong><p>${detail}</p></div><i aria-hidden="true">↗</i></button>`,
        )
        .join(
          "",
        )}<button id="learn-button" type="button" class="mode-card" disabled><span aria-hidden="true">↗</span><div><strong>Learn</strong><p>Practice the basics</p></div></button></div>
    </section>
    <section class="lobby-screen map-screen" data-screen="map" aria-label="Map" hidden>
      <h1>Map</h1><div class="map-cards">
        <button type="button" class="map-card tropical-card" data-arena="tropical"><img src="/art/arenas/tropical-map.webp" alt="Full Tropical Cove pool"/><strong>Tropical Cove</strong><span aria-hidden="true">↗</span></button>
        <button type="button" class="map-card city-card" data-arena="city"><img src="/art/arenas/city-map.webp" alt="Full Neon Rooftop pool"/><strong>Neon Rooftop</strong><span aria-hidden="true">↗</span></button>
      </div>
    </section>
    <section class="lobby-screen setup-screen" data-screen="setup" aria-label="Game setup" hidden>
      <div class="selected-map"><img id="selected-map-image" src="/art/arenas/tropical-map.webp" alt="Selected pool"/><button id="change-map" type="button">Tropical Cove <span aria-hidden="true">↗</span></button></div>
      <div class="setup-panel"><h1 id="selected-mode">Quick match</h1>
        <fieldset class="team-choice"><legend>Team</legend><div class="segmented"><button type="button" class="selected otters" data-species="otter" aria-pressed="true">Otters</button><button type="button" class="beavers" data-species="beaver" aria-pressed="false">Beavers</button></div></fieldset>
        <div class="match-setup">
          ${field("formation", "Formation", [
            ["2-3-1", "2–3–1"],
            ["1-3-2", "1–3–2"],
            ["3-3", "3–3"],
          ])}
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
      const heading = document.querySelector("#selected-mode");
      if (heading)
        heading.textContent = ui.mode === "match" ? "Quick match" : "Free swim";
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
      if (image) image.src = `/art/arenas/${ui.arena.value}-map.webp`;
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
  const formation = document.querySelector<HTMLSelectElement>("#formation");
  const position = document.querySelector<HTMLSelectElement>("#position");
  formation?.addEventListener("change", (): void => {
    ui.formation =
      formation.value === "3-3"
        ? "3-3"
        : formation.value === "1-3-2"
          ? "1-3-2"
          : "2-3-1";
    ui.opposition = ui.formation;
    ui.position = 0;
    if (position)
      position.innerHTML = formationChoices(ui.formation)
        .map(
          (choice): string =>
            `<option value="${choice.slot}">${choice.code} · ${choice.name}</option>`,
        )
        .join("");
  });
  position?.addEventListener("change", (): void => {
    ui.position = Number(position.value);
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
