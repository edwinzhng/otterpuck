import { expect, test } from "bun:test";
import { ARENA_IDS, ARENA_LABELS, isArenaId } from "./arena-catalog";
import { lobbyMarkup } from "./lobby";
import { clientMessageSchema } from "./multiplayer/protocol";
import { runtimeContent } from "./offline-assets";

test("every arena is selectable, cacheable after use, and valid on the wire", (): void => {
  const menu = lobbyMarkup();
  for (const id of ARENA_IDS) {
    expect(isArenaId(id)).toBe(true);
    expect(menu).toContain(`data-arena="${id}"`);
    expect(menu).toContain(ARENA_LABELS[id]);
    expect(runtimeContent).toContain(`/models/arenas/${id}.glb`);
    expect(
      clientMessageSchema.safeParse({ type: "settings", arena: id }).success,
    ).toBe(true);
  }
  for (const arena of ["moon", "constructor", "", null, 1]) {
    expect(isArenaId(arena)).toBe(false);
    expect(
      clientMessageSchema.safeParse({ type: "settings", arena }).success,
    ).toBe(false);
  }
});
