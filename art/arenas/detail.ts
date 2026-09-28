import { join } from "node:path";
import { ARENA_IDS, isArenaId } from "../../src/arena-catalog";
import { blenderExecutable } from "../blender";
import { detailPrimitives } from "./detail-primitives";
import { detailScenes } from "./detail-scenes";

const requested = Bun.argv.find((arg) => arg.startsWith("--arena="))?.slice(8);
if (requested && !isArenaId(requested)) throw new Error("Unknown arena");
for (const arena of ARENA_IDS.filter((id) => !requested || id === requested)) {
  const source = join(import.meta.dir, `${arena}.blend`);
  const code = `
${detailPrimitives}
arena=${JSON.stringify(arena)}
${detailScenes}
dpaint()
scene['detail_provenance']='Otterpuck authored scenery props and vertex paint; project MIT license'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(source)})
print('Detailed '+arena+': '+str(len(collection.objects))+' editable scenery pieces')
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
  if ((await task.exited) !== 0) throw new Error(`${arena} detailing failed`);
}
