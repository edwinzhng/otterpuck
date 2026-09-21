import { expect, test } from "bun:test";
import { CHARACTER_SPECIES, randomOpponent } from "./characters";

test("random opponents cover every other character and never the selected one", () => {
  for (const selected of CHARACTER_SPECIES) {
    const opponents = Array.from(
      { length: CHARACTER_SPECIES.length - 1 },
      (_, i) =>
        randomOpponent(
          selected,
          () => (i + 0.5) / (CHARACTER_SPECIES.length - 1),
        ),
    );
    expect(opponents).not.toContain(selected);
    expect(new Set(opponents)).toEqual(
      new Set(CHARACTER_SPECIES.filter((species) => species !== selected)),
    );
  }
});
