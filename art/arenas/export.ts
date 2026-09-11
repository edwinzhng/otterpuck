import { join } from "node:path";
import { blenderExecutable } from "../blender";

for (const arena of ["tropical", "city"]) {
  const source = join(import.meta.dir, `${arena}.blend`);
  const destination = join(
    import.meta.dir,
    `../../public/models/arenas/${arena}.glb`,
  );
  const code = `
import bpy, json
scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK'))
bpy.context.window.scene=scene
bpy.ops.object.select_all(action='DESELECT')
objects=[o for o in scene.objects if o.type=='MESH']
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.convert(target='MESH')
for obj in objects:
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
batches={}
for obj in objects:
    surface=obj.data.materials[0].name
    key=obj.name if obj.name.startswith(('TroughGoal','GoalAccent')) else surface if surface.startswith('Pool ') else 'Wind' if obj.get('wind_weight') else 'Architecture'
    batches.setdefault(key,[]).append(obj)
for key,batch in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in batch:obj.select_set(True)
    bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join()
    bpy.context.object.name=key;bpy.context.object['arena_part']=key
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type=='MESH':obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=${JSON.stringify(destination)},export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_extras=True)
print(json.dumps({'glb':${JSON.stringify(destination)},'vertices':sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH'),'batches':len(batches)}))
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
  if ((await task.exited) !== 0) throw new Error(`${arena} export failed`);
}
