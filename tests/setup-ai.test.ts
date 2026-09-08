import { expect, test } from "bun:test";
import {
  botProfiles,
  defendingZone,
  safeAirReserve,
  shouldSprintToPuck,
} from "../src/bots";
import { planTeam } from "../src/formations";
import { formationChoices, playerPosition } from "../src/positions";
import { createSimulation, stepSimulation } from "../src/simulation";
import { attackDirection, freshControls, STEP } from "../src/types";
import { uiShell } from "../src/ui-shell";

test("every team and position controls its selected swimmer with the selected formation", (): void => {
  for (const species of ["otter", "beaver"] as const)
    for (const formation of ["3-3", "2-3-1", "1-3-2"] as const)
      for (const position of formationChoices(formation)) {
        const state = createSimulation(
          formation,
          "3-3",
          "match",
          180,
          "right",
          { species, position: position.slot, difficulty: "hard" },
        );
        const human = state.players.at(0);
        if (!human) throw new Error("Missing selected swimmer");
        expect(human.human).toBe(true);
        expect(human.team).toBe(species === "otter" ? 0 : 1);
        expect(human.slot).toBe(position.slot);
        expect(
          state.players.filter((player): boolean => player.human),
        ).toHaveLength(1);
        expect(
          new Set(state.players.map((player): number => player.id)).size,
        ).toBe(12);
        expect(state.formations.at(human.team)).toBe(formation);
        expect(playerPosition(state, human).code).toBe(position.code);
        state.faceoff = undefined;
        planTeam(state, human.team);
        stepSimulation(state, { ...freshControls(), forward: 1 }, STEP);
        expect(human.velocity.length()).toBeGreaterThan(0);
      }
});

test("free swim and puck lab use the chosen species as their only swimmer", (): void => {
  for (const mode of ["practice", "playground"] as const) {
    const state = createSimulation("2-3-1", "2-3-1", mode, 180, "left", {
      species: "beaver",
      position: 4,
      difficulty: "elite",
    });
    expect(state.players).toHaveLength(1);
    expect(state.players.at(0)).toMatchObject({
      id: 10,
      team: 1,
      slot: 4,
      human: true,
      handedness: "left",
    });
  }
});

test("defenders hold their zone despite spare coverage and still surface before empty air", (): void => {
  const state = createSimulation();
  state.faceoff = undefined;
  const player = state.players.at(2),
    covering = state.players.at(3);
  if (!player || !covering) throw new Error("Missing teammates");
  state.puck.position.z = 5;
  planTeam(state, 0);
  player.position.copy(player.target);
  player.mode = "playing";
  player.air = 72;
  covering.position.copy(player.target);
  covering.position.x += 0.6;
  covering.mode = "playing";
  covering.air = 92;
  planTeam(state, 0);
  expect(defendingZone(state, player)).toBe(true);
  expect(player.mode).toBe("playing");
  expect(player.wantDown).toBe(true);
  player.air = safeAirReserve(player) - 1;
  stepSimulation(state, freshControls(), STEP);
  expect(String(player.mode)).toBe("ascending");
  expect(player.air).toBeGreaterThan(10);
});

test("zone exits are mirrored and backs hold coverage longest", (): void => {
  const state = createSimulation();
  state.faceoff = undefined;
  for (const team of [0, 1] as const) {
    const back = state.players.find(
      (p): boolean => p.team === team && p.slot === 5,
    );
    if (!back) throw new Error("Back missing");
    back.position.set(0, 0.36, -attackDirection(team) * 10);
    state.puck.position.z = -attackDirection(team) * 5;
    expect(defendingZone(state, back)).toBe(true);
    state.puck.position.z = attackDirection(team) * 4;
    expect(defendingZone(state, back)).toBe(false);
  }
});

test("difficulty changes pursuit urgency, pace and reaction without bypassing breath recovery", (): void => {
  const state = createSimulation();
  state.faceoff = undefined;
  const player = state.players.at(1);
  if (!player) throw new Error("Bot missing");
  player.duty = "pressure";
  player.wantDown = true;
  player.air = 100;
  state.difficulty = "easy";
  expect(shouldSprintToPuck(state, player, 1)).toBe(false);
  state.difficulty = "elite";
  expect(shouldSprintToPuck(state, player, 1)).toBe(true);
  expect(botProfiles.elite.sprintSpeed).toBeGreaterThan(
    botProfiles.easy.sprintSpeed,
  );
  expect(botProfiles.elite.decisionPeriod).toBeLessThan(
    botProfiles.easy.decisionPeriod,
  );
  player.mode = "recovering";
  expect(shouldSprintToPuck(state, player, 10)).toBe(false);
});

test("menu markup has unique IDs, complete position choices, and only mode labels on the first screen", async (): Promise<void> => {
  const ids: string[] = [],
    modes: string[] = [],
    labels: string[] = [];
  const response = new HTMLRewriter()
    .on("[id]", {
      element(element): void {
        ids.push(element.getAttribute("id") ?? "");
      },
    })
    .on(".mode-card strong", {
      text(chunk): void {
        if (chunk.text) modes.push(chunk.text);
      },
    })
    .on("label[for]", {
      element(element): void {
        labels.push(element.getAttribute("for") ?? "");
      },
    })
    .transform(new Response(uiShell()));
  await response.text();
  expect(new Set(ids).size).toBe(ids.length);
  expect(modes).toEqual(["Quick match", "Free swim"]);
  for (const id of [
    "formation",
    "position",
    "difficulty",
    "handedness",
    "quality",
  ])
    expect(labels).toContain(id);
  for (const id of [
    "pool",
    "map",
    "start",
    "load-status",
    "knockdown-prompt",
    "selected-map-image",
  ])
    expect(ids).toContain(id);
});
