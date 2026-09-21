import { ARENA_IDS } from "../../src/arena-catalog";

for (const args of [
  ...ARENA_IDS.map((id) => ["create.ts", `--arena=${id}`]),
  ["goals.ts"],
  ["export.ts"],
]) {
  const task = Bun.spawn([process.execPath, ...args], {
    cwd: import.meta.dir,
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await task.exited) !== 0) throw new Error("Arena authoring failed");
}
