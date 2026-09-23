import { expect, test } from "bun:test";
import { createRoomSimulation } from "./multiplayer/match";
import { attributesSchema } from "./multiplayer/protocol";
import { packSnapshot, parseSnapshot } from "./multiplayer/snapshot";
import {
  airDrainScale,
  curlSpeedScale,
  flickScale,
  NEUTRAL_ATTRIBUTES,
  recoveryScale,
  shieldScale,
  swimSpeedScale,
  tackleScale,
  validAttributes,
} from "./player-profile";
import { createSimulation, stepSimulation, updateStick } from "./simulation";
import { puckSeat } from "./stick";
import {
  type Attributes,
  type Controls,
  freshControls,
  type Player,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
} from "./types";
import { airRate } from "./vitals";

const GENTLE = 0.008;
// A pointer turn of 0.06 rad per step asks for about 13.6 rad/s.
const HARD = 0.06;

const carrying = (
  attributes: Attributes = NEUTRAL_ATTRIBUTES,
  autoCurl = false,
): { state: Simulation; player: Player } => {
  const state = createSimulation("2-3-1", "2-3-1", "playground", 180, "right", {
    species: "otter",
    position: 0,
    difficulty: "medium",
    attributes,
    autoCurl,
  });
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  updateStick(player, STEP);
  player.previousStick.copy(player.stick);
  state.puck.position.copy(puckSeat(player)).setY(PUCK_HEIGHT);
  state.puck.previous.copy(state.puck.position);
  state.puck.controlOwner = player.id;
  state.puck.controlKind = "carry";
  return { state, player };
};

const curlsDuring = (
  state: Simulation,
  player: Player,
  controls: Controls,
  yawDelta: number,
): boolean => {
  let curled = false;
  for (let step = 0; step < 60; step++) {
    controls.yawDelta = yawDelta;
    stepSimulation(state, controls, STEP);
    curled ||= player.curl !== 0;
  }
  return curled;
};

const swimming = (): Controls => ({ ...freshControls(), forward: 1 });

test("auto curl turns a hard forward turn with the puck into a curl", (): void => {
  const enabled = carrying(NEUTRAL_ATTRIBUTES, true);
  expect(curlsDuring(enabled.state, enabled.player, swimming(), HARD)).toBe(
    true,
  );
  const disabled = carrying(NEUTRAL_ATTRIBUTES, false);
  expect(curlsDuring(disabled.state, disabled.player, swimming(), HARD)).toBe(
    false,
  );
});

test("auto curl ignores gentle turns and sprinting turns", (): void => {
  const gentle = carrying(NEUTRAL_ATTRIBUTES, true);
  expect(curlsDuring(gentle.state, gentle.player, swimming(), GENTLE)).toBe(
    false,
  );
  const sprint = carrying(NEUTRAL_ATTRIBUTES, true);
  expect(
    curlsDuring(
      sprint.state,
      sprint.player,
      { ...swimming(), sprint: true },
      HARD,
    ),
  ).toBe(false);
});

test("neutral attributes leave every quality unchanged", (): void => {
  for (const modifier of [
    airDrainScale,
    recoveryScale,
    flickScale,
    swimSpeedScale,
    curlSpeedScale,
    tackleScale,
    shieldScale,
  ])
    expect(modifier(NEUTRAL_ATTRIBUTES)).toBe(1);
});

test("a build spends at most ten points within levels one to five", (): void => {
  expect(validAttributes({ strength: 5, technique: 4, fitness: 1 })).toBe(true);
  expect(validAttributes({ strength: 5, technique: 5, fitness: 1 })).toBe(
    false,
  );
  expect(validAttributes({ strength: 6, technique: 2, fitness: 1 })).toBe(
    false,
  );
  expect(validAttributes({ strength: 0, technique: 5, fitness: 5 })).toBe(
    false,
  );
  expect(
    attributesSchema.safeParse({ strength: 4, technique: 3, fitness: 3 })
      .success,
  ).toBe(true);
  expect(
    attributesSchema.safeParse({ strength: 5, technique: 5, fitness: 1 })
      .success,
  ).toBe(false);
});

test("fitness keeps more air underwater and recovers it faster", (): void => {
  const fit = carrying({ strength: 2, technique: 3, fitness: 5 });
  const unfit = carrying({ strength: 5, technique: 4, fitness: 1 });
  expect(Math.abs(airRate(fit.state, fit.player))).toBeLessThan(
    Math.abs(airRate(unfit.state, unfit.player)),
  );
  for (const { player } of [fit, unfit]) player.position.y = 2.4;
  expect(airRate(fit.state, fit.player)).toBeGreaterThan(
    airRate(unfit.state, unfit.player),
  );
});

test("strength swims faster and flicks the puck harder", (): void => {
  const strong = carrying({ strength: 5, technique: 3, fitness: 2 });
  const weak = carrying({ strength: 1, technique: 4, fitness: 5 });
  for (const { state } of [strong, weak]) state.puck.position.set(6, 0, 6);
  for (let step = 0; step < 120; step++)
    for (const { state } of [strong, weak])
      stepSimulation(state, swimming(), STEP);
  expect(strong.player.velocity.length()).toBeGreaterThan(
    weak.player.velocity.length(),
  );

  const flickSpeed = (attributes: Attributes): number => {
    const { state } = carrying(attributes);
    let peak = 0;
    for (let step = 0; step < 90; step++) {
      stepSimulation(
        state,
        { ...freshControls(), shot: step === 0 ? 1 : 0 },
        STEP,
      );
      peak = Math.max(
        peak,
        Math.hypot(state.puck.velocity.x, state.puck.velocity.z),
      );
    }
    return peak;
  };
  expect(flickSpeed({ strength: 5, technique: 3, fitness: 2 })).toBeGreaterThan(
    flickSpeed({ strength: 1, technique: 4, fitness: 5 }),
  );
});

test("technique curls faster", (): void => {
  const peakCurl = (attributes: Attributes): number => {
    const { state, player } = carrying(attributes);
    for (let step = 0; step < 60; step++)
      stepSimulation(state, { ...freshControls(), curl: 1 }, STEP);
    return Math.abs(player.curlTurnSpeed);
  };
  expect(peakCurl({ strength: 2, technique: 5, fitness: 3 })).toBeGreaterThan(
    peakCurl({ strength: 5, technique: 1, fitness: 4 }),
  );
});

test("the build and auto curl survive a restart and a room snapshot", (): void => {
  const build = { strength: 4, technique: 5, fitness: 1 };
  const state = createSimulation("2-3-1", "2-3-1", "match", 180, "right", {
    species: "otter",
    position: 0,
    difficulty: "medium",
    attributes: build,
    autoCurl: true,
  });
  state.restartTime = STEP / 2;
  stepSimulation(state, freshControls(), STEP);
  const human = state.players.find((player) => player.human);
  expect(human?.attributes).toEqual(build);
  expect(human?.autoCurl).toBe(true);

  const room = createRoomSimulation({
    teamSize: 6,
    swimTurn: 1,
    difficulty: "medium",
  });
  const first = room.players.at(0);
  if (!first) throw new Error("Player missing");
  first.attributes = build;
  first.autoCurl = true;
  const parsed = parseSnapshot(JSON.parse(JSON.stringify(packSnapshot(room))));
  const copy = parsed?.players.find((player) => player.id === first.id);
  expect(copy?.attributes).toEqual(build);
  expect(copy?.autoCurl).toBe(true);
});
