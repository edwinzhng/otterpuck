import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CHARACTER_SPECIES } from "../../src/characters";
import { blenderExecutable } from "../blender";

const sequence = Bun.argv.includes("--sequence");
const sequenceDirectory = join(import.meta.dir, "motion-review");
if (sequence) await mkdir(sequenceDirectory, { recursive: true });

const species =
  CHARACTER_SPECIES.find((id): boolean => Bun.argv.includes(`--${id}`)) ??
  "otter";
const pair = Bun.argv.includes("--pair");
const pose = Bun.argv.includes("--standing") || pair ? "standing" : "swimming";
const standing = pose === "standing" ? "True" : "False";
const motion = Bun.argv
  .find((argument): boolean => argument.startsWith("--motion="))
  ?.slice(9);
const requestedFrame = Bun.argv
  .find((argument): boolean => argument.startsWith("--frame="))
  ?.slice(8);
const sampleFrame =
  requestedFrame === undefined ? undefined : Number(requestedFrame);
if (
  sampleFrame !== undefined &&
  (!Number.isInteger(sampleFrame) || sampleFrame < 0)
) {
  throw new Error("Preview frame must be a nonnegative integer");
}
const cameraView =
  ["side", "rear", "front", "above", "below"].find((view): boolean =>
    Bun.argv.includes(`--${view}`),
  ) ?? "three-quarter";
const source =
  Bun.argv.find((value): boolean => value.startsWith("--source="))?.slice(9) ??
  join(import.meta.dir, `${species}.blend`);
const output =
  Bun.argv.find((value): boolean => value.startsWith("--output="))?.slice(9) ??
  join(
    import.meta.dir,
    pair
      ? "characters-lineup.png"
      : `${species}-${motion ?? pose}-${cameraView}${sampleFrame === undefined ? "" : `-frame-${sampleFrame}`}.png`,
  );
const code = `
import bpy, math
from mathutils import Vector,Matrix,Quaternion
scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK'))
bpy.context.window.scene=scene
if ${pair ? "True" : "False"}:
    with bpy.data.libraries.load(${JSON.stringify(join(import.meta.dir, "beaver.blend"))}) as (source,target):
        target.collections=[name for name in source.collections if 'Character' in name]
    for added in target.collections:scene.collection.children.link(added)
rig=next(o for o in scene.objects if o.type=='ARMATURE')
rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_quaternion=(1,0,0,0)
scene.frame_set(0)
standing=${standing}
for obj in scene.objects:
    n=obj.name.split('.')[0]
    if n.endswith('LCuff') or n.endswith('LMitten') or n=='GripPawR':obj.hide_render=True
    if obj.type=='LIGHT':obj.data.energy=90 if obj.name.startswith('Key') else 30 if obj.name.startswith('Fill') else 65
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.6,.75,.80,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.28
if standing:
    for side,suffix in [(-1,'L'),(1,'R')]:
        shoulder=rig.data.bones['arm.'+suffix].head_local.copy()
        elbow=Vector((side*.149,.010,-.046));end=Vector((side*.146,-.065,-.080))
        if rig.get('species') in ['raccoon','crocodile','penguin','walrus']:
            end=shoulder+Vector((side*.020,-.105,-.075))
            direction=(end-shoulder).normalized()
            distance=(end-shoulder).length
            a=rig.data.bones['arm.'+suffix].length;b=rig.data.bones['forearm.'+suffix].length
            along=(a*a-b*b+distance*distance)/(2*distance)
            pole=Vector((side,0,0));pole=(pole-direction*pole.dot(direction)).normalized()
            elbow=shoulder+direction*along+pole*math.sqrt(max(0,a*a-along*along))
        for name,a,b in [('arm.'+suffix,shoulder,elbow),('forearm.'+suffix,elbow,end)]:
            bone=rig.pose.bones[name]
            bone.matrix=Matrix.Translation(a) @ Vector((0,1,0)).rotation_difference((b-a).normalized()).to_matrix().to_4x4()
            bpy.context.view_layer.update()
        paw=rig.pose.bones['paw.'+suffix]
        paw.matrix=Matrix.Translation(end) @ Vector((0,1,0)).rotation_difference((end-elbow).normalized()).to_matrix().to_4x4()
        bpy.context.view_layer.update()
    rig.rotation_euler.x=math.pi/2;rig.location.z=.43
    rig.pose.bones['head'].rotation_mode='QUATERNION';rig.pose.bones['head'].rotation_quaternion=Quaternion((1,0,0),-math.pi/2)
    scene.camera.location=(.65,1.8,.84);target=Vector((0,0,.41));floor_z=0
    scene.camera.data.ortho_scale=1.15
else:
    scene.camera.location=(.85,1.45,.62);target=Vector((0,-.02,.015));floor_z=-.24
    scene.camera.data.ortho_scale=1.04
    motion=${JSON.stringify(motion ?? "")}
    if motion:
        action=bpy.data.actions.get(motion)
        if action:
            rig.animation_data.action=action
            scene.frame_set(${sampleFrame ?? "round(action.frame_range[1]*.25)"})
if not standing and motion=='Dive':scene.camera.data.ortho_scale=1.36;target.z=-.10
if ${JSON.stringify(cameraView)}=='side':scene.camera.location=(1.8,0,.64 if standing else .22)
if ${JSON.stringify(cameraView)}=='rear':scene.camera.location=(.7,-1.6,1 if standing else .55)
if ${JSON.stringify(cameraView)}=='front':scene.camera.location=(0,2,.69 if standing else .1)
if ${JSON.stringify(cameraView)}=='above':scene.camera.location=(0,-.08,1.8)
if ${JSON.stringify(cameraView)}=='below':scene.camera.location=(0,-.08,-1.8)
if ${pair ? "True" : "False"}:
    other=next(o for o in scene.objects if o.type=='ARMATURE' and o!=rig)
    other.animation_data.action=None
    for b in other.pose.bones:
        b.matrix_basis=rig.pose.bones[b.name].matrix_basis.copy()
    other.rotation_euler=rig.rotation_euler.copy();other.location=rig.location.copy()
    rig.location.x=-.28;other.location.x=.28
    scene.camera.location=(.55,3.8,1.0);target=Vector((0,0,.40));scene.camera.data.ortho_scale=1.40
scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
world_nodes=scene.world.node_tree.nodes;world_links=scene.world.node_tree.links
camera_background=world_nodes.new('ShaderNodeBackground');camera_background.inputs[0].default_value=(.82,.91,.96,1)
light_path=world_nodes.new('ShaderNodeLightPath');mix=world_nodes.new('ShaderNodeMixShader')
world_links.new(light_path.outputs['Is Camera Ray'],mix.inputs[0]);world_links.new(world_nodes['Background'].outputs[0],mix.inputs[1]);world_links.new(camera_background.outputs[0],mix.inputs[2]);world_links.new(mix.outputs[0],world_nodes['World Output'].inputs[0])
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=${pair ? 1400 : 1000};scene.render.resolution_y=${pair ? 1000 : 850};scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=${JSON.stringify(output)}
bpy.context.view_layer.update()
if ${sequence ? "True" : "False"}:
    scene.cycles.samples=16;scene.render.resolution_x=800;scene.render.resolution_y=640
    for index in range(8):
        scene.frame_set(round(action.frame_range[1]*index/7))
        scene.render.filepath=${JSON.stringify(sequenceDirectory)}+'/'+${JSON.stringify(species)}+'-'+motion+'-'+${JSON.stringify(cameraView)}+'-'+str(index)+'.png'
        bpy.ops.render.render(write_still=True)
else:bpy.ops.render.render(write_still=True)
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
if ((await task.exited) !== 0) throw new Error("Character preview failed");
console.info(output);
