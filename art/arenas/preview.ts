import { join } from "node:path";
import { blenderExecutable } from "../blender";

const output = join(import.meta.dir, "previews");
await Bun.$`mkdir -p ${output}`;
for (const arena of ["tropical", "city"]) {
  const code = `
import bpy, math
from mathutils import Vector
scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK'))
bpy.context.window.scene=scene
city=${arena === "city" ? "True" : "False"}
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=1100;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.use_nodes=True;nodes=scene.world.node_tree.nodes;links=scene.world.node_tree.links
texture=nodes.new('ShaderNodeTexEnvironment');texture.image=bpy.data.images.load(${JSON.stringify(join(import.meta.dir, `../../public/art/arenas/${arena}-panorama.png`))})
links.new(texture.outputs['Color'],nodes['Background'].inputs['Color']);nodes['Background'].inputs['Strength'].default_value=.55 if city else .8
def light(name,kind,position,energy,color,size=10):
    data=bpy.data.lights.new(name,kind);data.energy=energy;data.color=color
    if kind=='AREA':data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=position
    obj.rotation_euler=(Vector((0,0,2))-obj.location).to_track_quat('-Z','Y').to_euler()
light('Key','AREA',(-12,8,22),2200 if city else 6500,(.62,.70,1) if city else (1,.92,.78),18)
light('Fill','AREA',(12,-10,8),950 if city else 1800,(1,.24,.55) if city else (.46,.84,1),14)
for side in [-1,1]:light('UnderwaterFill','AREA',(side*5,0,2.3),180 if city else 270,(.22,.77,1),12)
water=bpy.data.materials.new('Preview water');water.use_nodes=True;p=water.node_tree.nodes['Principled BSDF']
p.inputs['Base Color'].default_value=(.11,.57,.68,1);p.inputs['Roughness'].default_value=.12;p.inputs['Metallic'].default_value=.15
p.inputs['Transmission Weight'].default_value=.75;p.inputs['IOR'].default_value=1.333
noise=water.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=4;noise.inputs['Detail'].default_value=1
bump=water.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.16;bump.inputs['Distance'].default_value=.018
water.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);water.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
bpy.ops.mesh.primitive_plane_add(size=1,location=(0,0,2.44));surface=bpy.context.object;surface.scale=(15,25,1);surface.data.materials.append(water)
data=bpy.data.cameras.new('Preview camera');cam=bpy.data.objects.new('Preview camera',data);scene.collection.objects.link(cam);scene.camera=cam
data.lens=27;data.clip_end=300
for name,position,target in [('overview',(17,-24,13),(0,1,2.1)),('surface',(6,-10,2.74),(-1,16,3.7)),('goal',(1.6,9.6,.65),(0,12.45,.10))]:
    cam.location=position;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    surface.hide_render=name=='goal'
    scene.render.filepath=${JSON.stringify(output)}+'/'+${JSON.stringify(arena)}+'-'+name+'.png'
    bpy.ops.render.render(write_still=True)
`;
  const task = Bun.spawn(
    [
      blenderExecutable,
      "--background",
      "--threads",
      "2",
      "--python-exit-code",
      "1",
      join(import.meta.dir, `${arena}.blend`),
      "--python-expr",
      code,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if ((await task.exited) !== 0) throw new Error(`${arena} preview failed`);
}
