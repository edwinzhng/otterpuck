import { expect, test } from "bun:test";
import { matchResult } from "../src/match-result";

test("results celebrate only the human team winning", (): void => {
  expect(matchResult([3, 1], 0).outcome).toBe("win");
  expect(matchResult([3, 1], 1)).toEqual({
    outcome: "loss",
    title: "DEFEAT",
    score: "1 — 3",
    teams: "BEAVERS · OTTERS",
  });
  expect(matchResult([1, 3], 1).title).toBe("YOU WIN!");
  expect(matchResult([1, 3], 0).outcome).toBe("loss");
  expect(matchResult([2, 2], 1).outcome).toBe("draw");
});
