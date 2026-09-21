import { join } from "node:path";
import { CHARACTER_SPECIES } from "../../src/characters";
import { blenderExecutable } from "../blender";
import { geometryPython } from "./geometry";
import { rigPython } from "./rig";

const animationDefinition = rigPython.slice(
  rigPython.indexOf("def animate():"),
);
for (const species of CHARACTER_SPECIES) {
  const path = join(import.meta.dir, `${species}.blend`);
  const code = `${geometryPython}
scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK'))
bpy.context.window.scene=scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
beaver=${species === "beaver" ? "True" : "False"}
rig.animation_data_clear()
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
${animationDefinition}
animate()
bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(path)})
`;
  const task = Bun.spawn(
    [
      blenderExecutable,
      "--background",
      "--threads",
      "2",
      "--python-exit-code",
      "1",
      path,
      "--python-expr",
      code,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if ((await task.exited) !== 0)
    throw new Error(`${species} animation update failed`);
}
