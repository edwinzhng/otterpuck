import { expect, test } from "bun:test";
import { packSnapshot, parseSnapshot } from "./multiplayer/snapshot";
import { playerName, teamScorers } from "./player-names";
import { advancePuck } from "./puck-physics";
import { createSimulation } from "./simulation";
import type { Simulation, Team } from "./types";

const score = (state: Simulation, team: Team, scorer: number): void => {
  state.puck.orientation.identity();
  state.puck.velocity.set(0, 0, 0);
  state.puck.position.set(0, 0.026, team === 0 ? -12.385 : 12.385);
  state.puck.lastTouch = scorer;
  advancePuck(state, 0);
};

test("a goal records the scoring team, the last touch and the match time", (): void => {
  const state = createSimulation();
  state.seconds = state.duration - 42;
  score(state, 0, 1);
  expect(state.scores).toEqual([1, 0]);
  expect(state.goals).toEqual([{ team: 0, scorer: 1, second: 42 }]);
});

test("scorers group by player and mark own goals", (): void => {
  const state = createSimulation();
  const [you, teammate] = state.players.filter(
    (player): boolean => player.team === 0,
  );
  const opponent = state.players.find((player): boolean => player.team === 1);
  if (!you || !teammate || !opponent) throw new Error("Missing players");
  score(state, 0, teammate.id);
  score(state, 0, you.id);
  score(state, 0, teammate.id);
  score(state, 0, opponent.id);
  const names = new Map<number, string>();
  expect(teamScorers(state, 0, names)).toEqual([
    { name: playerName(state, teammate, names), goals: 2, ownGoal: false },
    { name: "You", goals: 1, ownGoal: false },
    { name: playerName(state, opponent, names), goals: 1, ownGoal: true },
  ]);
  expect(teamScorers(state, 1, names)).toEqual([]);
});

test("a remote human is named from the room", (): void => {
  const state = createSimulation();
  const remote = state.players.at(1);
  if (!remote) throw new Error("Missing player");
  remote.human = true;
  expect(playerName(state, remote, new Map([[remote.id, "Edwin"]]))).toBe(
    "Edwin",
  );
});

test("snapshots carry the goals", (): void => {
  const state = createSimulation();
  score(state, 1, 3);
  const parsed = parseSnapshot(JSON.parse(JSON.stringify(packSnapshot(state))));
  expect(parsed?.goals).toEqual(state.goals);
});
