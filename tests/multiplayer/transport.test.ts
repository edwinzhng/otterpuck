import { expect, test } from "bun:test";
import { createNetworkMatch } from "../../src/multiplayer/match";
import {
  packSnapshot,
  parseSnapshot,
  stringifySnapshot,
} from "../../src/multiplayer/snapshot";
import { createSimulation } from "../../src/simulation";

test("compact snapshots preserve state and optional fields within wire precision", () => {
  const match = createNetworkMatch();
  for (let i = 0; i < 1200; i++) match.advance(1 / 60);
  const full = JSON.parse(JSON.stringify(match.state));
  const text = stringifySnapshot(packSnapshot(match.state));
  const decoded = parseSnapshot(JSON.parse(text));
  expect(decoded).toBeDefined();
  expect(JSON.parse(stringifySnapshot(decoded))).toEqual(
    JSON.parse(stringifySnapshot(full)),
  );
  expect(text.length).toBeLessThan(JSON.stringify(full).length * 0.6);
  expect(
    match.state.players[0]?.position.distanceTo(
      decoded?.players[0]?.position ?? match.state.puck.position,
    ),
  ).toBeLessThan(0.0001);
});
test("malformed compact snapshots are rejected; full checkpoints still decode", () => {
  expect(
    parseSnapshot({ wire: 1, state: [], players: [], puck: [] }),
  ).toBeUndefined();
  expect(
    parseSnapshot(JSON.parse(JSON.stringify(createSimulation()))),
  ).toBeDefined();
});
test("finished matches emit the final state once and stop work", () => {
  const initial = createSimulation();
  initial.faceoff = undefined;
  initial.seconds = 0.001;
  const match = createNetworkMatch(initial);
  expect(match.advance(1 / 60)).toBe(true);
  expect(match.state.finished).toBe(true);
  const time = match.state.time;
  for (let i = 0; i < 120; i++) expect(match.advance(1 / 60)).toBe(false);
  expect(match.state.time).toBe(time);
});
