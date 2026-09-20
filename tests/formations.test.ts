import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { coordinatePuckPursuit, safeAirReserve } from "../src/bots";
import { planTeam } from "../src/formations";
import { playerPosition } from "../src/positions";
import {
  createSimulation,
  stepSimulation,
  updateStick,
} from "../src/simulation";
import { puckSeat } from "../src/stick";
import {
  attackDirection,
  FLOOR_HEIGHT,
  type Formation,
  freshControls,
  type Player,
  PUCK_HEIGHT,
  type Simulation,
  STEP,
  type Team,
} from "../src/types";

const formations: readonly Formation[] = [
  "3-3",
  "2-3-1",
  "1-3-2",
  "2-1",
  "1-2",
  "1-1",
];

const hasWings = (state: Simulation, team: Team): boolean =>
  state.players.some((player): boolean =>
    playerPosition(state, player).code.includes("W"),
  ) && state.players.some((player): boolean => player.team === team);

const findRole = (state: Simulation, team: Team, code: string): Player => {
  const player = state.players.find(
    (other): boolean =>
      other.team === team && playerPosition(state, other).code === code,
  );
  if (!player) throw new Error(`Missing ${team} ${code}`);
  return player;
};

const settledTeam = (
  formation: Formation,
  team: Team,
  x = 0,
  depth = 6,
): Simulation => {
  const state = createSimulation(formation, formation);
  state.faceoff = undefined;
  state.players = state.players.filter(
    (player): boolean => player.team === team,
  );
  state.puck.position.set(x, PUCK_HEIGHT, depth * attackDirection(team));
  state.puck.previous.copy(state.puck.position);
  planTeam(state, team);
  for (const player of state.players) {
    player.human = false;
    player.wallReady = false;
    player.mode = "playing";
    player.position.copy(player.target);
    player.previous.copy(player.position);
    updateStick(player, STEP);
  }
  return state;
};

test("every formation puts forwards ahead, centers between wings and backs behind on either attacking side", (): void => {
  for (const formation of formations)
    for (const team of [0, 1] as const)
      for (const x of [-6.9, -4, 0, 4, 6.9]) {
        const state = settledTeam(formation, team, x, 0);
        const direction = attackDirection(team);
        const localX = (code: string): number =>
          findRole(state, team, code).target.x * -direction;
        for (const player of state.players) {
          const code = playerPosition(state, player).code;
          const depth = (player.target.z - state.puck.position.z) * direction;
          if (code.includes("F")) expect(depth).toBeGreaterThan(0.8);
          else expect(depth).toBeLessThan(0);
          expect(player.wantDown).toBe(true);
          expect(Math.abs(player.target.x)).toBeLessThanOrEqual(6.8);
          expect(player.position.equals(player.formationTarget)).toBe(true);
        }
        if (hasWings(state, team)) {
          expect(localX("LW")).toBeLessThan(localX("C"));
          expect(localX("RW")).toBeGreaterThan(localX("C"));
          expect(localX("C")).toBeCloseTo(
            Math.max(-5.1, Math.min(5.1, x * -direction)),
          );
        }
        if (formation === "3-3") {
          expect(localX("LF")).toBeLessThan(localX("CF"));
          expect(localX("RF")).toBeGreaterThan(localX("CF"));
          expect(localX("LB")).toBeLessThan(localX("CB"));
          expect(localX("RB")).toBeGreaterThan(localX("CB"));
        }
        if (formation === "1-3-2" || formation === "1-2")
          expect(localX("LB")).toBeLessThan(localX("RB"));
        if (formation === "2-1")
          expect(localX("LF")).toBeLessThan(localX("RF"));
      }
});

test("wall lineups and strike support mirror the teams and deploy the selected formation", (): void => {
  for (const formation of formations) {
    const state = createSimulation(formation, formation);
    for (const left of state.players.filter(
      (player): boolean => player.team === 0,
    )) {
      const right = state.players.find(
        (player): boolean => player.team === 1 && player.slot === left.slot,
      );
      if (!right) throw new Error("Missing mirrored player");
      expect(left.position.x).toBeCloseTo(-right.position.x);
      expect(left.position.z).toBeCloseTo(-right.position.z);
    }
    state.faceoff = { phase: "strike", elapsed: 0 };
    stepSimulation(state, freshControls(), STEP);
    for (const player of state.players) {
      const depth = player.target.z * attackDirection(player.team);
      if (player.slot === 0) expect(Math.abs(depth)).toBeLessThan(0.5);
      else if (playerPosition(state, player).code.includes("F"))
        expect(depth).toBeGreaterThan(0.8);
      else expect(depth).toBeLessThan(0);
      expect(player.sprint || player.human).toBe(true);
    }
  }
});

test("midfield challenges leave forwards available and do not drag the weak wing or lone back across the pool", (): void => {
  for (const team of [0, 1] as const) {
    const state = settledTeam("2-3-1", team, 4 * -attackDirection(team), 0);
    coordinatePuckPursuit(state, team);
    const chaser = state.players.find(
      (player): boolean => player.id === state.puckChasers[team],
    );
    if (!chaser) throw new Error("Missing pursuer");
    expect(["C", "RW"]).toContain(playerPosition(state, chaser).code);
    const back = findRole(state, team, "B");
    const weakWing = findRole(state, team, "LW");
    back.position
      .copy(state.puck.position)
      .add(new Vector3(0, FLOOR_HEIGHT - PUCK_HEIGHT, -attackDirection(team)));
    coordinatePuckPursuit(state, team);
    expect(state.puckChasers[team]).not.toBe(back.id);
    expect(state.puckChasers[team]).not.toBe(weakWing.id);
    for (const player of state.players) player.air = 10;
    back.air = 80;
    coordinatePuckPursuit(state, team);
    expect(state.puckChasers[team]).toBe(back.id);
  }
});

test("each formation reserves a specific replacement, waits until it is down, then keeps coverage through the whole breath cycle", (): void => {
  const pairs: readonly {
    formation: Formation;
    outgoing: string;
    incoming: string;
  }[] = [
    { formation: "3-3", outgoing: "RB", incoming: "CB" },
    { formation: "3-3", outgoing: "RF", incoming: "CF" },
    { formation: "2-3-1", outgoing: "RW", incoming: "C" },
    { formation: "2-3-1", outgoing: "B", incoming: "C" },
    { formation: "1-3-2", outgoing: "LB", incoming: "RB" },
    { formation: "1-3-2", outgoing: "F", incoming: "RW" },
    { formation: "2-1", outgoing: "B", incoming: "RF" },
    { formation: "1-2", outgoing: "F", incoming: "RB" },
    { formation: "1-1", outgoing: "F", incoming: "B" },
  ];
  for (const pair of pairs)
    for (const team of [0, 1] as const) {
      const state = settledTeam(
        pair.formation,
        team,
        2 * -attackDirection(team),
      );
      const outgoing = findRole(state, team, pair.outgoing);
      const incoming = findRole(state, team, pair.incoming);
      outgoing.air = 42;
      incoming.air = 96;
      incoming.mode = "diving";
      incoming.position
        .copy(outgoing.formationTarget)
        .add(new Vector3(0.7, 0.8, 0));
      planTeam(state, team);
      expect(state.airRotations[team].at(0)?.incoming).toBe(incoming.id);
      expect(state.airRotations[team].at(0)?.phase).toBe("handoff");
      expect(outgoing.mode).toBe("playing");
      stepSimulation(state, freshControls(), STEP);
      expect(outgoing.mode).toBe("playing");
      incoming.position
        .copy(outgoing.formationTarget)
        .add(new Vector3(0.7, 0, 0));
      incoming.mode = "playing";
      planTeam(state, team);
      expect(String(outgoing.mode)).toBe("ascending");
      expect(state.airRotations[team].at(0)?.phase).toBe("recover");
      expect(incoming.target.equals(outgoing.formationTarget)).toBe(true);
      state.puck.position.z += attackDirection(team) * 0.5;
      planTeam(state, team);
      expect(incoming.target.equals(outgoing.formationTarget)).toBe(true);
      expect(incoming.wantDown).toBe(true);
      outgoing.mode = "recovering";
      outgoing.position.y = 2.31;
      outgoing.air = 96;
      state.time += 4;
      stepSimulation(state, freshControls(), STEP);
      expect(String(outgoing.mode)).toBe("diving");
      planTeam(state, team);
      expect(state.airRotations[team].at(0)?.phase).toBe("return");
      outgoing.position
        .copy(outgoing.formationTarget)
        .add(new Vector3(0.8, 0, 0));
      outgoing.mode = "playing";
      planTeam(state, team);
      expect(state.airRotations[team]).toHaveLength(0);
      planTeam(state, team);
      expect(incoming.target.equals(incoming.formationTarget)).toBe(true);
      expect(outgoing.target.equals(outgoing.formationTarget)).toBe(true);
    }
});

test("3-3 relief preserves the weak back and a covered defender's planned ascent is not cancelled", (): void => {
  const state = settledTeam("3-3", 0, 4, -4);
  const strong = findRole(state, 0, "RB");
  const swing = findRole(state, 0, "CB");
  const weak = findRole(state, 0, "LB");
  strong.air = 30;
  swing.position.copy(strong.formationTarget).add(new Vector3(-0.75, 0, 0));
  planTeam(state, 0);
  expect(state.airRotations[0].at(0)?.incoming).toBe(swing.id);
  expect(String(strong.mode)).toBe("ascending");
  expect(weak.target.equals(weak.formationTarget)).toBe(true);
  expect(weak.mode).toBe("playing");
  expect(weak.duty).toBe("cover");
  stepSimulation(state, freshControls(), STEP);
  expect(String(strong.mode)).toBe("ascending");
  expect(strong.velocity.y).toBeGreaterThan(0);
});

test("no replacement is invented and low air overrides a pending handoff safely", (): void => {
  const state = settledTeam("2-3-1", 0);
  const wing = findRole(state, 0, "LW");
  const center = findRole(state, 0, "C");
  wing.air = 42;
  center.mode = "recovering";
  center.position.y = 2.31;
  planTeam(state, 0);
  expect(state.airRotations[0]).toHaveLength(0);
  expect(wing.mode).toBe("playing");
  center.mode = "diving";
  center.air = 95;
  center.position.copy(wing.target).add(new Vector3(0.5, 1, 0));
  planTeam(state, 0);
  expect(state.airRotations[0].at(0)?.phase).toBe("handoff");
  wing.air = safeAirReserve(wing) - 0.1;
  stepSimulation(state, freshControls(), STEP);
  expect(String(wing.mode)).toBe("ascending");
  expect(wing.air).toBeGreaterThan(10);
});

test("forward and back lines can rotate independently without assigning one replacement twice", (): void => {
  const state = settledTeam("3-3", 0, 2);
  const forward = findRole(state, 0, "RF");
  const back = findRole(state, 0, "RB");
  forward.air = 42;
  back.air = 40;
  planTeam(state, 0);
  const rotations = state.airRotations[0];
  expect(rotations).toHaveLength(2);
  const involved = rotations.flatMap((rotation): number[] => [
    rotation.incoming,
    rotation.outgoing,
  ]);
  expect(new Set(involved).size).toBe(4);
  expect(involved).not.toContain(findRole(state, 0, "LB").id);
  expect(involved).not.toContain(findRole(state, 0, "LF").id);
  planTeam(state, 0);
  expect(state.airRotations[0]).toHaveLength(2);
});

test("actual AI swimming reforms around a teammate's puck instead of orbiting or swapping sides", (): void => {
  for (const formation of formations) {
    const state = settledTeam(formation, 0, 0, 0);
    const human = state.players.find((player): boolean => player.slot === 0);
    if (!human) throw new Error("Missing carrier");
    human.human = true;
    human.position.set(0, FLOOR_HEIGHT, 0);
    human.yaw = 0;
    updateStick(human, STEP);
    state.puck.position.copy(puckSeat(human)).setY(PUCK_HEIGHT);
    state.puck.previous.copy(state.puck.position);
    state.puck.controlOwner = human.id;
    state.puck.controlKind = "carry";
    for (const player of state.players.filter(
      (other): boolean => other !== human,
    )) {
      player.position.x *= -1.8;
      player.position.z += 2;
      player.previous.copy(player.position);
      updateStick(player, STEP);
    }
    for (const unused of Array.from({ length: 2160 })) {
      void unused;
      for (const player of state.players) player.air = 100;
      stepSimulation(state, freshControls(), STEP);
    }
    expect(state.puck.controlOwner).toBe(human.id);
    for (const player of state.players.filter(
      (other): boolean => other !== human,
    )) {
      expect(
        player.position.distanceTo(player.formationTarget),
        `${formation} player ${player.id} must settle into formation`,
      ).toBeLessThan(0.65);
      expect(player.duty).not.toBe("pressure");
      expect(player.position.y).toBeCloseTo(FLOOR_HEIGHT, 5);
      const code = playerPosition(state, player).code;
      if (code.startsWith("L"))
        expect(player.position.x).toBeLessThan(state.puck.position.x);
      if (code.startsWith("R"))
        expect(player.position.x).toBeGreaterThan(state.puck.position.x);
      if (code.includes("F"))
        expect(player.position.z).toBeLessThan(state.puck.position.z);
    }
  }
});
