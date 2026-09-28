import { join } from "node:path";
import { characterRampStops } from "../../src/character-look";
import { CHARACTER_SPECIES } from "../../src/characters";
import { blenderExecutable } from "../blender";

const selected = CHARACTER_SPECIES.find((species) =>
  Bun.argv.includes(`--${species}`),
);

for (const species of selected ? [selected] : CHARACTER_SPECIES) {
  const source = join(import.meta.dir, `${species}.blend`);
  const code = `
import bpy, bmesh, math, json
from mathutils import Vector, noise
scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK '+${JSON.stringify(species)}.title()))
bpy.context.window.scene=scene
species=${JSON.stringify(species)}
if not scene.get('painted_finish'):
    objects=[o for o in scene.objects if o.type=='MESH']
    for obj in objects:
        if obj.get('asset_part')=='ContinuousCharacter':
            bm=bmesh.new();bm.from_mesh(obj.data)
            for iteration in range(3):
                bmesh.ops.smooth_vert(bm,verts=list(bm.verts),factor=.16,use_axis_x=True,use_axis_y=True,use_axis_z=True)
            bm.to_mesh(obj.data);bm.free()
            for v in obj.data.vertices:
                p=v.co
                torso=math.exp(-((p.y+.045)/.135)**4)*max(0,1-(abs(p.x)/.105)**6)
                p.x*=1+.035*torso;p.z*=1+.025*torso
        if obj.get('asset_part')=='Head' and species not in ['crocodile','dolphin','walrus']:
            for v in obj.data.vertices:
                p=v.co
                cheek=math.exp(-((p.z+.035)/.028)**2)*math.exp(-((p.y-.262)/.070)**4)
                p.x*=1+.055*cheek
        if obj.get('asset_part') in ['ContinuousCharacter','Head']:
            attr=obj.data.color_attributes.get('Coat')
            if attr:
                for v in obj.data.vertices:
                    p=v.co;rgb=list(attr.data[v.index].color[:3])
                    wash=noise.noise(p*Vector((32,23,18)))
                    for i in range(3):rgb[i]*=1+wash*.075
                    if species in ['otter','beaver']:
                        rgb=[rgb[0]*1.12,rgb[1]*1.065,rgb[2]*1.015]
                    if obj.get('asset_part')=='Head' and species not in ['crocodile','dolphin']:
                        cheek=math.exp(-((abs(p.x)-.069)/.026)**2-((p.z+.028)/.020)**2)*max(0,min(1,(p.y-.255)/.045))
                        blush=(.72,.28,.20) if species in ['otter','beaver','raccoon'] else (.52,.29,.34)
                        rgb=[rgb[i]*(1-cheek*.14)+blush[i]*cheek*.14 for i in range(3)]
                    attr.data[v.index].color=tuple(max(0,min(1,c)) for c in rgb)+(1,)
        obj.data.update()
    for side in ['L','R']:
        eye=next((o for o in objects if o.name=='Eye'+side),None)
        if not eye:continue
        center=sum((v.co for v in eye.data.vertices),Vector())/len(eye.data.vertices)
        for obj in objects:
            if obj.name not in ['Eye'+side,'EyeLight'+side,'UpperLid'+side]:continue
            for v in obj.data.vertices:
                v.co.x=center.x+(v.co.x-center.x)*1.10
                v.co.z=center.z+(v.co.z-center.z)*1.10
            obj.data.update()
    scene['painted_finish']=1
    scene['finish_provenance']='Otterpuck authored mesh and vertex-paint refinements; project MIT license'
for material in bpy.data.materials:
    if not material.use_nodes:continue
    ramp=material.node_tree.nodes.get('Shared Otterpuck shading palette')
    if ramp:
        stops=${JSON.stringify(characterRampStops)}
        while len(ramp.color_ramp.elements)>2:ramp.color_ramp.elements.remove(ramp.color_ramp.elements[-1])
        ramp.color_ramp.elements[0].position=0
        ramp.color_ramp.elements[1].position=1
        for index,stop in enumerate(stops):
            e=ramp.color_ramp.elements[0] if index==0 else ramp.color_ramp.elements[-1] if index==len(stops)-1 else ramp.color_ramp.elements.new(stop['position'])
            e.position=stop['position'];e.color=tuple(.9*c+.095 for c in stop['color'])+(1,)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(source)})
print('Refined '+species+'; preserved mesh topology, weights, rig and actions')
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
    throw new Error(`${species} refinement failed`);
}
