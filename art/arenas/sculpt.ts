import { join } from "node:path";
import { ARENA_IDS, isArenaId } from "../../src/arena-catalog";
import { blenderExecutable } from "../blender";
import { sculptForms } from "./sculpt-forms";
import { sculptPaint } from "./sculpt-paint";
import { sculptTerrain, terrainHeight } from "./sculpt-terrain";

const requested = Bun.argv.find((arg) => arg.startsWith("--arena="))?.slice(8);
if (requested && !isArenaId(requested)) throw new Error("Unknown arena");
for (const arena of ARENA_IDS.filter((id) => !requested || id === requested)) {
  const source = join(import.meta.dir, `${arena}.blend`);
  const code = `
arena=${JSON.stringify(arena)}
${terrainHeight}
${sculptForms}
${sculptTerrain}
${sculptPaint}
scene['sculpt_provenance']='Otterpuck authored scenery silhouettes, terrain, and vertex paint; project MIT license'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(source)})
print('Saved sculpted scenery: '+arena)
`;
  const task = Bun.spawn(
    [
      blenderExecutable,
      "--background",
      "--threads",
      "2",
      "--python-exit-code",
      "1",
      source,
      "--python-expr",
      code,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if ((await task.exited) !== 0) throw new Error(`${arena} sculpt failed`);
}
