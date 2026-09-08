import { join } from "node:path";
import { blenderExecutable } from "../blender";

const root = join(import.meta.dir, "../..");
const blender = blenderExecutable;
const run = async (arguments_: string[]): Promise<void> => {
  const task = Bun.spawn(arguments_, {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await task.exited) !== 0) throw new Error("Blender asset build failed");
};
for (const species of ["otter", "beaver"]) {
  await run([
    process.execPath,
    "art/characters/create.ts",
    ...(species === "beaver" ? ["--beaver"] : []),
  ]);
  await run([
    blender,
    "--background",
    "--threads",
    "2",
    "--python-exit-code",
    "1",
    "--python",
    `art/characters/${species}-authoring.txt`,
  ]);
}
await run([process.execPath, "art/characters/equipment.ts"]);
await run([
  blender,
  "--background",
  "--threads",
  "2",
  "--python-exit-code",
  "1",
  "--python",
  "art/characters/equipment-authoring.txt",
]);
await run([
  blender,
  "--background",
  "--threads",
  "2",
  "art/characters/equipment.blend",
  "--python-expr",
  "import bpy; bpy.context.window.scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK Equipment')); bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)",
]);
await run([process.execPath, "art/characters/export.ts"]);
