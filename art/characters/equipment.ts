import { join } from "node:path";
import { STICK_OUTLINE } from "../../src/types";
import { geometryPython } from "./geometry";

const output = join(import.meta.dir, "equipment.blend");
const code = `
${geometryPython}
scene=bpy.data.scenes.new('OTTERPUCK Equipment');bpy.context.window.scene=scene
collection=bpy.data.collections.new('Modular Equipment');scene.collection.children.link(collection)
rig=bpy.data.objects.new('Equipment',None);collection.objects.link(rig)
scene.unit_settings.system='METRIC'
charcoal=color('Pusher charcoal',(.011,.021,.035),.86)
inset=color('Pusher inset',(.006,.009,.015),.95)
steel=color('Trough satin steel',(.36,.51,.56),.62,.25)
lip=color('Trough edge',(.49,.63,.66),.66,.15)
outline=${JSON.stringify(STICK_OUTLINE)}
n=len(outline)
vertices=[(x,-z,h) for h in [-.0085,.0085] for x,z in outline]
faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
stick=mesh('Pusher',vertices,faces,charcoal)
bevel=stick.modifiers.new('Soft rounded edges','BEVEL');bevel.width=.002;bevel.segments=3
for polygon in stick.data.polygons:polygon.use_smooth=False
stick['grip_local_blender']=[.1,-.077,0]
stick['gameplay_outline_preserved']=True
inset_path=catmull([(-.127,-.046,.011),(-.125,-.011,.011),(-.108,-.031,.011),(-.070,-.046,.011),(-.015,-.058,.011),(-.107,-.057,.011)],4,True)
recess=mesh('Pusher recess',inset_path,[tuple(range(len(inset_path)))],inset)
recess.parent=stick
for p in recess.data.polygons:p.use_smooth=False
profile=[(.38,.004,1.50),(.32,.025,1.53),(.14,.025,1.62),(.015,.195,1.68),(-.008,.195,1.68),(-.008,.004,1.68)]
vertices=[(side*width,y,z) for side in [-1,1] for y,z,width in profile]
n=len(profile)
faces=[(i,i+1,n+i+1,n+i) for i in range(n-1)]
goal=mesh('Trough goal',vertices,faces,steel)
for polygon in goal.data.polygons:polygon.use_smooth=False
solid=goal.modifiers.new('Sheet metal thickness','SOLIDIFY');solid.thickness=.004
bevel=goal.modifiers.new('Soft metal edges','BEVEL');bevel.width=.003;bevel.segments=2
edge=sweep('Entry lip',[Vector((-1.5,.38,.005)),Vector((1.5,.38,.005))],.005,lip,8);edge.parent=goal
back=sweep('Rear folded edge',[Vector((-1.68,.002,.194)),Vector((1.68,.002,.194))],.006,lip,8);back.parent=goal
goal['scoring_width_m']=3.0;goal['net']=False;goal['origin']='Rear wall, floor level'
scene.world=bpy.data.worlds.new('Equipment studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.82,.9,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
scene.view_settings.view_transform='Standard'
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active=goal;goal.select_set(True)
bpy.data.libraries.write(${JSON.stringify(output)},{scene},compress=True)
result={'blend':${JSON.stringify(output)}}
`;
await Bun.write(join(import.meta.dir, "equipment-authoring.txt"), code);
console.info("Prepared Blender equipment authoring");
