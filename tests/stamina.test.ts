import { expect, test } from "bun:test";
import { createSimulation, stepSimulation } from "../src/simulation";
import {
  type Controls,
  FLOOR_HEIGHT,
  freshControls,
  MAX_STAMINA,
  type Player,
  type Simulation,
  STEP,
  SURFACE_HEIGHT,
} from "../src/types";

const setup = (): { state: Simulation; player: Player } => {
  const state = createSimulation("2-3-1", "2-3-1", "practice");
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  player.position.set(-7, FLOOR_HEIGHT, 0);
  player.yaw = -Math.PI / 2;
  return { state, player };
};

const advance = (
  state: Simulation,
  seconds: number,
  controls: Controls = freshControls(),
): void => {
  for (const unused of Array.from({ length: Math.ceil(seconds / STEP) })) {
    void unused;
    stepSimulation(state, controls, STEP);
  }
};

const sprinting: Controls = { ...freshControls(), forward: 1, sprint: true };

const isSprinting = (player: Player): boolean => player.sprint;

test("sprinting spends stamina and cruising slowly earns it back", (): void => {
  const { state, player } = setup();
  expect(player.stamina).toBe(MAX_STAMINA);
  advance(state, 3, sprinting);
  const spent = player.stamina;
  expect(spent).toBeLessThan(MAX_STAMINA - 35);
  advance(state, 3, { ...freshControls(), forward: 1 });
  const cruised = player.stamina;
  expect(cruised).toBeGreaterThan(spent);
  expect(cruised - spent).toBeLessThan(MAX_STAMINA - spent);
  advance(state, 6);
  expect(player.stamina).toBeGreaterThan(cruised + 10);
});

const holdBreath = (
  state: Simulation,
  player: Player,
  seconds: number,
  controls: Controls,
): void => {
  for (const unused of Array.from({ length: Math.ceil(seconds / STEP) })) {
    void unused;
    player.air = 100;
    stepSimulation(state, controls, STEP);
  }
};

test("an exhausted swimmer drops out of the sprint until stamina rebuilds", (): void => {
  const { state, player } = setup();
  let held = 0;
  while (isSprinting(player) || held === 0) {
    holdBreath(state, player, STEP, sprinting);
    held += STEP;
  }
  expect(held).toBeGreaterThan(4);
  expect(held).toBeLessThan(9);
  expect(player.stamina).toBeLessThan(1);
  holdBreath(state, player, 1, sprinting);
  expect(isSprinting(player)).toBe(false);
  holdBreath(state, player, 3, freshControls());
  holdBreath(state, player, STEP, sprinting);
  expect(isSprinting(player)).toBe(true);
});

const staminaRate = (depth: number, controls: Controls): number => {
  const { state, player } = setup();
  player.stamina = 50;
  player.position.y = depth;
  for (const unused of Array.from({ length: 120 })) {
    void unused;
    player.position.y = depth;
    player.air = 100;
    stepSimulation(state, controls, STEP);
  }
  return player.stamina - 50;
};

test("sprinting at the surface costs half the underwater stamina", (): void => {
  const below = staminaRate(FLOOR_HEIGHT, sprinting);
  const above = staminaRate(SURFACE_HEIGHT, sprinting);
  expect(below).toBeLessThan(0);
  expect(above).toBeCloseTo(below / 2, 5);
});

test("resting or swimming calmly at the surface still recovers stamina", (): void => {
  expect(staminaRate(SURFACE_HEIGHT, freshControls())).toBeGreaterThan(0);
  expect(
    staminaRate(SURFACE_HEIGHT, { ...freshControls(), forward: 1 }),
  ).toBeGreaterThan(0);
});

test("air comes back more slowly at the surface after a hard sprint", (): void => {
  const recovered = [MAX_STAMINA, 0].map((stamina): number => {
    const { state, player } = setup();
    player.stamina = stamina;
    player.air = 40;
    player.position.y = SURFACE_HEIGHT;
    advance(state, 1);
    return player.air - 40;
  });
  const [fresh, winded] = recovered;
  if (fresh === undefined || winded === undefined)
    throw new Error("Missing samples");
  expect(fresh).toBeGreaterThan(winded * 2);
  expect(winded).toBeGreaterThan(0);
});

test("a winded swimmer burns air faster underwater", (): void => {
  const consumed = [MAX_STAMINA, 0].map((stamina): number => {
    const { state, player } = setup();
    player.stamina = stamina;
    advance(state, 1, { ...freshControls(), forward: 1 });
    return 100 - player.air;
  });
  const [fresh, winded] = consumed;
  if (fresh === undefined || winded === undefined)
    throw new Error("Missing samples");
  expect(winded).toBeGreaterThan(fresh);
});

test("bots share the stamina limit and stop sprinting when spent", (): void => {
  const state = createSimulation();
  state.faceoff = undefined;
  const bot = state.players.find((player: Player): boolean => !player.human);
  if (!bot) throw new Error("Bot missing");
  for (const player of state.players) player.wallReady = false;
  bot.stamina = 0;
  stepSimulation(state, freshControls(), STEP);
  expect(bot.sprint).toBe(false);
  expect(bot.stamina).toBeGreaterThan(0);
});

test("running low on air announces to that otter alone", (): void => {
  // Everyone in a room shares one simulation, so an announcement left on it
  // told every client that their own air was running out.
  const state = createSimulation("2-3-1", "2-3-1");
  const player = state.players.at(0);
  const other = state.players.at(1);
  if (!player || !other) throw new Error("Nobody else in the pool");
  state.faceoff = undefined;
  state.restartTime = 0;
  player.position.set(-7, FLOOR_HEIGHT, 0);
  player.air = 25;
  other.air = 100;
  advance(state, 2, { ...freshControls(), forward: 1, sprint: true });
  expect(player.air).toBeLessThan(24);
  expect(player.event).toBe("Low air");
  expect(player.eventTime).toBeGreaterThan(0);
  expect(other.event).toBe("");
  expect(state.event).not.toBe("Low air");
});
