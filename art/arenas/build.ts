for (const args of [
  ["create.ts"],
  ["create.ts", "--city"],
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
