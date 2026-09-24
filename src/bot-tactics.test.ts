import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { planCarry } from "./bot-carry";
import { botControls } from "./bot-driver";
import { clearAscent, safeAirReserve } from "./bots";
import { createSimulation } from "./simulation";
import {
  angleDifference,
  attackDirection,
  directionYaw,
  FLOOR_HEIGHT,
  type Player,
  PUCK_HEIGHT,
  SURFACE_HEIGHT,
} from "./types";

// A carrier for team 0 with every other player up at the surface, so only the
// players a test brings down take part.
const setup = () => {
  const state = createSimulation("2-3-1", "2-3-1", "match");
  state.faceoff = undefined;
  for (const player of state.players) {
    player.human = false;
    player.mode = "recovering";
    player.position.set(0, SURFACE_HEIGHT, 0);
  }
  const [carrier, mate] = state.players.filter(
    (player): boolean => player.team === 0,
  );
  const rival = state.players.find((player): boolean => player.team === 1);
  if (!carrier || !mate || !rival) throw new Error("Missing players");
  state.puck.controlOwner = carrier.id;
  return { state, carrier, mate, rival };
};

const onFloor = (player: Player, depth: number, x: number): void => {
  player.mode = "playing";
  player.position.set(x, FLOOR_HEIGHT, depth * attackDirection(0));
  player.velocity.set(0, 0, 0);
};

const carryAt = (
  state: ReturnType<typeof setup>["state"],
  carrier: Player,
  depth: number,
  x: number,
): void => {
  onFloor(carrier, depth, x);
  carrier.yaw = directionYaw(0, attackDirection(0));
  state.puck.position.set(x, PUCK_HEIGHT, (depth + 0.45) * attackDirection(0));
};

test("a spent forward blocked in attack passes back to its support", (): void => {
  const { state, carrier, mate, rival } = setup();
  carryAt(state, carrier, 4, 0);
  onFloor(mate, 2.4, 1.2);
  onFloor(rival, 5.6, 0.2);
  carrier.air = safeAirReserve(state, carrier) + 4;
  planCarry(state, carrier, false);
  const back = mate.position.clone().sub(state.puck.position);
  expect(carrier.plannedShot).toBeDefined();
  expect(
    Math.abs(
      angleDifference(
        carrier.plannedShot?.yaw ?? 0,
        directionYaw(back.x, back.z),
      ),
    ),
  ).toBeLessThan(0.3);
});

test("a spent forward with the way open pushes on to the goal", (): void => {
  const { state, carrier, mate, rival } = setup();
  carryAt(state, carrier, 4, 0);
  onFloor(mate, 2.4, 1.2);
  onFloor(rival, 5.6, 4);
  carrier.air = safeAirReserve(state, carrier) + 4;
  planCarry(state, carrier, false);
  expect(carrier.plannedShot).toBeUndefined();
  expect(carrier.target.z * attackDirection(0)).toBeGreaterThan(8);
});

test("an off-centre carrier in its own third takes the puck up the wall", (): void => {
  const { state, carrier } = setup();
  carryAt(state, carrier, -8, -3);
  carrier.air = 90;
  planCarry(state, carrier, false);
  expect(carrier.plannedShot).toBeUndefined();
  expect(carrier.target.x).toBeLessThan(-6);
  expect(carrier.target.z * attackDirection(0)).toBeGreaterThan(-8);
});

test("a swimmer on its way up sidesteps a body above it", (): void => {
  const { state, carrier, mate } = setup();
  carrier.mode = "ascending";
  carrier.position.set(3, 1, 0);
  mate.position.set(3.3, 1.8, 0);
  const desired = new Vector3(0.5, 0, 0);
  clearAscent(state, carrier, desired);
  expect(desired.x).toBeLessThan(-1);
});

test("a recovering bot keeps kicking up until it breathes", (): void => {
  const { state, carrier } = setup();
  state.puck.controlOwner = undefined;
  carrier.mode = "recovering";
  carrier.position.y = SURFACE_HEIGHT - 0.055;
  const intent = {
    desired: new Vector3(),
    headingError: 0,
    holdHeading: true,
    sprint: false,
    stop: true,
    pursuing: false,
    dummy: 0,
  };
  expect(botControls(state, carrier, intent, 1 / 120).vertical).toBe(1);
  carrier.position.y = SURFACE_HEIGHT;
  expect(botControls(state, carrier, intent, 1 / 120).vertical).toBe(0);
});
