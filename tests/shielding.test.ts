import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { isPuckContested } from "../src/handling";
import { inSandwich, puckProtection } from "../src/shielding";
import {
  createSimulation,
  stepSimulation,
  updateStick,
} from "../src/simulation";
import { bladePoint, puckSeat } from "../src/stick";
import {
  FLOOR_HEIGHT,
  freshControls,
  type Handedness,
  type Player,
  PUCK_HEIGHT,
  type Ruleset,
  type Simulation,
  STEP,
} from "../src/types";

const RIGHT = Math.PI / 2;
const LEFT = -Math.PI / 2;
const AHEAD = 0;
const OPPOSED = Math.PI;

const stage = (
  hand: Handedness,
  curl: number,
  ruleset: Ruleset = "alternative",
): { state: Simulation; carrier: Player; challengers: Player[] } => {
  const state = createSimulation("2-3-1", "2-3-1", "match", 180, hand, {
    species: "otter",
    position: 0,
    difficulty: "medium",
    ruleset,
  });
  const carrier = state.players.at(0);
  if (!carrier) throw new Error("Carrier missing");
  carrier.position.set(0, FLOOR_HEIGHT, 0);
  carrier.yaw = 0;
  carrier.curl = curl;
  carrier.turnRate = 0;
  carrier.wallReady = false;
  const challengers = state.players.filter(
    (player: Player): boolean => player.team !== carrier.team,
  );
  for (const player of state.players) {
    player.wallReady = false;
    player.emergency = false;
    if (player !== carrier) player.position.set(50, FLOOR_HEIGHT, 50);
  }
  return { state, carrier, challengers };
};

const place = (
  carrier: Player,
  challenger: Player,
  bearing: number,
  facing: number,
  distance = 0.8,
): void => {
  challenger.position
    .copy(carrier.position)
    .add(
      new Vector3(
        Math.sin(bearing) * distance,
        0,
        -Math.cos(bearing) * distance,
      ),
    );
  challenger.yaw = facing;
};

const protectionAt = (
  hand: Handedness,
  curl: number,
  bearing: number,
  facing: number,
): number => {
  const { state, carrier, challengers } = stage(hand, curl);
  const challenger = challengers.at(0);
  if (!challenger) throw new Error("Challenger missing");
  place(carrier, challenger, bearing, facing);
  return puckProtection(state, carrier, challenger);
};

test("a reverse curl seals the stick side and the front but leaves the other open", (): void => {
  expect(protectionAt("right", -1, RIGHT, AHEAD)).toBeGreaterThan(0.85);
  expect(protectionAt("right", -1, AHEAD, AHEAD)).toBeGreaterThan(0.85);
  expect(protectionAt("right", -1, LEFT, AHEAD)).toBeLessThan(0.2);
});

test("a regular curl guards both sides evenly and less than the sealed side", (): void => {
  const right = protectionAt("right", 1, RIGHT, AHEAD);
  const left = protectionAt("right", 1, LEFT, AHEAD);
  expect(right).toBeCloseTo(left, 6);
  expect(right).toBeGreaterThan(0.35);
  expect(right).toBeLessThan(protectionAt("right", -1, RIGHT, AHEAD));
});

test("a challenger coming head-on has a far worse angle than one alongside", (): void => {
  for (const curl of [-1, 1]) {
    for (const bearing of [RIGHT, LEFT]) {
      expect(protectionAt("right", curl, bearing, OPPOSED)).toBeGreaterThan(
        protectionAt("right", curl, bearing, AHEAD),
      );
    }
  }
});

test("a left-handed carrier mirrors the right-handed cover exactly", (): void => {
  for (const [bearing, mirrored] of [
    [RIGHT, LEFT],
    [LEFT, RIGHT],
    [AHEAD, AHEAD],
  ]) {
    if (bearing === undefined || mirrored === undefined)
      throw new Error("Missing bearing");
    for (const facing of [AHEAD, OPPOSED]) {
      expect(protectionAt("left", -1, mirrored, facing)).toBeCloseTo(
        protectionAt("right", -1, bearing, facing),
        6,
      );
    }
  }
});

test("carrying without a curl offers no cover at all", (): void => {
  for (const bearing of [RIGHT, LEFT, AHEAD])
    expect(protectionAt("right", 0, bearing, AHEAD)).toBe(0);
});

test("a sandwich between two opponents facing the same way strips the cover while turning", (): void => {
  const { state, carrier, challengers } = stage("right", -1);
  const [first, second] = challengers;
  if (!first || !second) throw new Error("Challengers missing");
  place(carrier, first, RIGHT, AHEAD, 1);
  place(carrier, second, LEFT, AHEAD, 1);
  expect(inSandwich(state, carrier)).toBe(true);
  expect(puckProtection(state, carrier, first)).toBe(0);

  carrier.curl = 0;
  carrier.turnRate = 0;
  expect(puckProtection(state, carrier, first)).toBe(0);

  place(carrier, second, LEFT, OPPOSED, 1);
  carrier.curl = -1;
  expect(inSandwich(state, carrier)).toBe(false);
  expect(puckProtection(state, carrier, first)).toBeGreaterThan(0.85);
});

const contestReach = (ruleset: Ruleset, side: number, curl: number): number => {
  const { state, carrier, challengers } = stage("right", curl, ruleset);
  const challenger = challengers.at(0);
  if (!challenger) throw new Error("Challenger missing");
  updateStick(carrier, STEP);
  state.puck.position.copy(puckSeat(carrier)).setY(PUCK_HEIGHT);
  state.puck.previous.copy(state.puck.position);
  for (let offset = 0; offset <= 0.6; offset += 0.002) {
    challenger.position.copy(state.puck.position).setY(FLOOR_HEIGHT);
    challenger.yaw = AHEAD;
    updateStick(challenger, STEP);
    challenger.position
      .add(state.puck.position.clone().sub(puckSeat(challenger)))
      .setY(FLOOR_HEIGHT);
    challenger.position.x += side * offset;
    updateStick(challenger, STEP);
    if (!isPuckContested(state, carrier)) return offset;
  }
  return 0.6;
};

test("cover tightens how loosely a challenging blade may sit", (): void => {
  for (const side of [1, -1])
    expect(contestReach("alternative", side, -1)).toBeLessThan(
      contestReach("original", side, -1),
    );
});

test("original rules ignore cover entirely", (): void => {
  for (const side of [1, -1])
    expect(contestReach("original", side, -1)).toBeCloseTo(
      contestReach("original", side, 1),
      6,
    );
});

test("a squarely laid blade still wins the puck from an open carrier", (): void => {
  expect(contestReach("alternative", 1, 0)).toBeGreaterThan(0);
});

// The geometry of the original "blade breaks the curl hold" case: a challenger
// laying the blade squarely on the puck from directly in front of the carrier.
const frontChallengeHolds = (ruleset: Ruleset): boolean => {
  const state = createSimulation("3-3", "3-3", "practice", 180, "right", {
    species: "otter",
    position: 0,
    difficulty: "medium",
    ruleset,
  });
  for (const unused of Array.from({ length: 12 })) {
    void unused;
    stepSimulation(state, { ...freshControls(), curl: 1 }, STEP);
  }
  const carrier = state.players.at(0);
  const opponent = createSimulation().players.at(6);
  if (!carrier || !opponent) throw new Error("Players missing");
  opponent.wallReady = false;
  opponent.bodyPitch = 0;
  opponent.mode = "playing";
  opponent.position
    .copy(state.puck.position)
    .add(new Vector3(0.11, 0, -0.9))
    .setY(FLOOR_HEIGHT);
  updateStick(opponent, STEP);
  opponent.position
    .add(
      state.puck.position
        .clone()
        .sub(bladePoint(opponent, new Vector3(-0.06, 0, 0.05))),
    )
    .setY(FLOOR_HEIGHT);
  updateStick(opponent, STEP);
  state.players.push(opponent);
  return !isPuckContested(state, carrier);
};

test("a curl turns away a square challenge from the front, but only under alternative rules", (): void => {
  expect(frontChallengeHolds("alternative")).toBe(true);
  expect(frontChallengeHolds("original")).toBe(false);
});
