import { join } from "node:path";
import { ARENA_IDS } from "../../src/arena-catalog";
import {
  GOAL_FACES,
  GOAL_PROFILE,
  GOAL_VERTICES,
} from "../../src/goal-profile";
import { blenderExecutable } from "../blender";

for (const arena of ARENA_IDS.filter(
  (id) =>
    !Bun.argv.some((arg) => arg.startsWith("--arena=")) ||
    Bun.argv.includes(`--arena=${id}`),
)) {
  const source = join(import.meta.dir, `${arena}.blend`);
  const code = `
import bpy
scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK'))
bpy.context.window.scene=scene
for obj in list(scene.objects):
    if obj.name.startswith(('TroughGoal','GoalAccent')):bpy.data.objects.remove(obj,do_unlink=True)
steel=bpy.data.materials.get('Goal brushed steel') or bpy.data.materials.new('Goal brushed steel')
steel.diffuse_color=(.48,.57,.61,1);steel.use_nodes=True
p=steel.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=steel.diffuse_color;p.inputs['Metallic'].default_value=.65;p.inputs['Roughness'].default_value=.32
profile=${JSON.stringify(GOAL_PROFILE)}
tray=steel.copy();tray.name="Goal tray steel";tray.diffuse_color=(.36,.43,.46,1);tray.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=tray.diffuse_color
fold=steel.copy();fold.name="Goal inner fold";fold.diffuse_color=(.27,.33,.36,1);fold.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=fold.diffuse_color
for side in [-1,1]:
    verts=[(x,side*(12.47-depth),height) for x,depth,height in ${JSON.stringify(GOAL_VERTICES)}]
    faces=${JSON.stringify(GOAL_FACES)}
    mesh=bpy.data.meshes.new('Folded trough');mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new('TroughGoal'+str(side),mesh);scene.collection.objects.link(obj);obj.data.materials.append(steel);obj.data.materials.append(tray);obj.data.materials.append(fold)
    for face in mesh.polygons:face.material_index=1 if face.index==3 else 2 if face.index==2 else 0
    obj['scoring_width_m']=2.25;obj['profile_source']='src/goal-profile.ts'
    solid=obj.modifiers.new('Steel sheet','SOLIDIFY');solid.thickness=.003;solid.offset=-1
    bevel=obj.modifiers.new('Fold edges','BEVEL');bevel.width=.002;bevel.segments=2
    team=bpy.data.materials.new('Goal accent '+str(side));team.diffuse_color=(.03,.35,.75,1) if side==-1 else (.8,.055,.09,1)
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0,side*(12.47-.017),.136))
    accent=bpy.context.object;accent.name='GoalAccent'+str(side);accent.scale=(2.23,.005,.015);accent.data.materials.append(team)
bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(source)})
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
  if ((await task.exited) !== 0)
    throw new Error(`${arena} goal authoring failed`);
}
