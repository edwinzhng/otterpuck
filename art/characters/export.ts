import { join } from "node:path";
import { blenderExecutable } from "../blender";

const requested = Bun.argv.includes("--beaver")
  ? ["beaver"]
  : Bun.argv.includes("--otter")
    ? ["otter"]
    : ["otter", "beaver"];
for (const species of requested) {
  const source = join(import.meta.dir, `${species}.blend`);
  const target = join(
    import.meta.dir,
    `../../public/models/characters/${species}.glb`,
  );
  const code = String.raw`
import bpy, re, json
scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK '+${JSON.stringify(species)}.title()))
bpy.context.window.scene=scene
collection=next(c for c in scene.collection.children if 'Character' in c.name)
for obj in scene.objects:obj.name=re.sub(r'\.\d{3}$','',obj.name)
for material in bpy.data.materials:material.name=re.sub(r'\.\d{3}$','',material.name)
for action in bpy.data.actions:action.name=re.sub(r'\.\d{3}$','',action.name)
rig=next(o for o in collection.objects if o.type=='ARMATURE')
rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_quaternion=(1,0,0,0)
scene.frame_set(0)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(source)})
for material in bpy.data.materials:
    if material.get('otterpuck_shading')=='soft-toon':
        nodes=material.node_tree.nodes;links=material.node_tree.links
        links.new(nodes['Principled BSDF'].outputs[0],nodes['Material Output'].inputs['Surface'])
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:
    obj.hide_set(False);obj.hide_render=False
body=[o for o in collection.objects if o.type=='MESH' and not o.name.startswith('GripPaw')]
for obj in body:obj.select_set(True)
bpy.context.view_layer.objects.active=body[0]
bpy.ops.object.join()
bpy.context.object.name='CharacterBody'
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=${JSON.stringify(target)},export_format='GLB',use_selection=True,use_active_scene=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_step=2,export_yup=True,export_extras=True)
print(json.dumps({'export':${JSON.stringify(target)},'bones':len(rig.data.bones),'clips':[a.name for a in bpy.data.actions if a.users>0]}))
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
  if ((await task.exited) !== 0) throw new Error(`${species} export failed`);
}
