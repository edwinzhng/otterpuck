import { join } from "node:path";
import { ARENA_LABELS, isArenaId } from "../../src/arena-catalog";
import { blenderExecutable } from "../blender";
import { alpineForestPython } from "./alpine-forest";
import { glacierTerminalPython } from "./glacier-terminal";
import { paintPython } from "./paint";
import { ruinsDesertPython } from "./ruins-desert";
import { sceneryPython } from "./scenery";

const directory = import.meta.dir;
const requested = Bun.argv
  .find((arg) => arg.startsWith("--arena="))
  ?.split("=")[1];
if (requested && !isArenaId(requested)) throw new Error("Unknown arena");
const arena = isArenaId(requested)
  ? requested
  : Bun.argv.includes("--city")
    ? "city"
    : "tropical";
const city = arena === "city";
const legacy = arena === "tropical" || city;
const code = `
import bpy, math, json
from mathutils import Vector
city=${city ? "True" : "False"}
arena=${JSON.stringify(arena)}
scene=bpy.data.scenes.new(${JSON.stringify(`OTTERPUCK ${ARENA_LABELS[arena]}`)})
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
scene['Dimensions']='25 m x 15 m x 2.44 m'
scene['Floor markings']='Authored centre dot, circle, 3m and 5m semicircles only'
scene['Goal']='3m low stainless trough; collision remains in simulation'
def material(name,color,rough=.7,metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    shader=m.node_tree.nodes['Principled BSDF']; shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=rough; shader.inputs['Metallic'].default_value=metal
    m['arena_surface']='metal' if metal else 'toon'
    return m
tile=material('Pool wall',(.28,.67,.76) if not city else (.17,.48,.58))
floor_mat=material('Pool floor',(.28,.67,.76) if not city else (.10,.40,.53))
stone=material('Warm limestone',(.83,.76,.59) if not city else (.105,.15,.23))
white=material('Canvas',(.95,.88,.69) if not city else (.86,.78,.65))
wood=material('Palm bark',(.37,.24,.12))
steel=material('Trough steel',(.40,.51,.53),.36,.48)
green=material('Palm green',(.06,.35,.11) if not city else (.035,.18,.13))
lime=material('Sunlit foliage',(.22,.48,.12) if not city else (.10,.32,.21))
rock=material('Island stone',(.30,.40,.29))
if arena=='tropical':
    rock_image=bpy.data.images.load(${JSON.stringify(join(directory, "../../public/art/arenas/island-rock-painted.webp"))});rock_image.pack()
    rock_reference=rock.node_tree.nodes.new('ShaderNodeTexImage');rock_reference.image=rock_image;rock_reference.label='Runtime triplanar paint; world scale .085'
    rock['paint_texture']='island-rock-painted.webp';rock['paint_scale']=.085
ocean=material('Distant ocean',(.075,.51,.65),.38)
cloud=material('Cloud',(.95,.98,1))
def mesh(name,verts,faces,mat):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); data.materials.append(mat)
    return obj
def box(name,center,size,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center); obj=bpy.context.object; obj.name=name
    obj.scale=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); obj.data.materials.append(mat)
    if bevel:
        m=obj.modifiers.new('Soft edges','BEVEL'); m.width=bevel; m.segments=2
    return obj
mesh('PoolFloor',[(-7.5,-12.5,0),(7.5,-12.5,0),(7.5,12.5,0),(-7.5,12.5,0)],[(0,1,2,3)],floor_mat)
for side in [-1,1]:
    box('PoolWallSide'+str(side),(side*7.61,0,1.22),(.22,25.44,2.44),tile)
    box('PoolWallEnd'+str(side),(0,side*12.61,1.22),(15,.22,2.44),tile)
    box('CopingSide'+str(side),(side*7.66,0,2.44),(.33,25.7,.13),white,.035)
    box('CopingEnd'+str(side),(0,side*12.67,2.44),(15,.33,.13),white,.035)
    box('DeckSide'+str(side),(side*10.3,0,2.31),(5.3,35,.26),stone,.04)
    box('DeckEnd'+str(side),(0,side*15.11,2.31),(15.5,4.8,.26),stone,.04)
    profile=[(.38,.004,1.50),(.32,.025,1.53),(.14,.025,1.62),(.015,.195,1.68),(-.008,.195,1.68),(-.008,.004,1.68)]
    verts=[(edge*width,side*(12.47-depth),height) for edge in [-1,1] for depth,height,width in profile]
    n=len(profile); faces=[(i,i+1,n+i+1,n+i) for i in range(n-1)]
    goal=mesh('TroughGoal'+str(side),verts,faces,steel)
    goal['scoring_width_m']=3.;goal['net']=False
    m=goal.modifiers.new('Sheet thickness','SOLIDIFY'); m.thickness=.004
    m=goal.modifiers.new('Soft folded edge','BEVEL');m.width=.003;m.segments=2
def ellipsoid(name,center,scale,mat,segments=12,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=center)
    obj=bpy.context.object; obj.name=name; obj.scale=scale; obj.data.materials.append(mat)
    for p in obj.data.polygons:p.use_smooth=True
    return obj
def palm(x,y,height,lean,index):
    verts=[]; faces=[]
    for i in range(17):
        t=i/16
        for j in range(14):
            a=j/14*math.tau; r=.22-.104*t+.055*math.exp(-t*12)
            verts.append((x+lean*t*t+math.cos(a)*r,y+math.sin(a)*r,2.43+height*t))
    for i in range(16):
        for j in range(14):
            a=i*14+j; b=i*14+(j+1)%14; faces.append((a,b,b+14,a+14))
    trunk=mesh('PalmTrunk%02d'%index,verts,faces,wood)
    for polygon in trunk.data.polygons:polygon.use_smooth=True
    crown=Vector((x+lean,y,2.43+height))
    for leaf in range(10):
        a=leaf/10*math.tau+index*.43+.23*math.sin(leaf*2.1+index); direction=Vector((math.cos(a),math.sin(a),0)); across=Vector((-math.sin(a),math.cos(a),0))
        length=2.65+(leaf%3)*.32+.24*math.sin(index+leaf); verts=[]; faces=[]
        lift=1.05+.48*math.sin(leaf*1.7+index);droop=1.05+.35*math.cos(leaf*2.2)
        for i in range(29):
            t=i/28; center=crown+direction*(t*length)+across*(.16*math.sin(t*math.pi)*math.sin(index+leaf))+Vector((0,0,lift*math.sin(t*math.pi*.87)-droop*t*t))
            width=(.53+.09*math.sin(leaf+index))*math.sin(t*math.pi)**.62+.004
            for cross in [-1,-.5,0,.5,1]:
                cuts=[5,9,13,17,21,25] if cross<0 else [7,11,15,19,23]
                edge=min([1]+[.62+(i-cut)*.19 for cut in cuts if 0<=i-cut<2])
                fold=.12*(1-abs(cross))*math.sin(t*math.pi)-.065*abs(cross)**2
                verts.append(center+across*(cross*width*(edge if abs(cross)==1 else 1))+Vector((0,0,fold)))
        for i in range(28):
            for j in range(4):
                a=i*5+j; faces.append((a,a+1,a+6,a+5))
        obj=mesh('PalmFrond%02d_%d'%(index,leaf),verts,faces,green if leaf%2 else lime)
        obj['wind_weight']=.025
        for p in obj.data.polygons:p.use_smooth=True
        obj.data.materials[0].use_backface_culling=False
${
  legacy
    ? `
for i,(x,y,h,lean) in enumerate([(-12.3,-10.0,6.5,.3),(12.3,-9.5,6.8,-.3),(-12.3,8.5,6.7,.3),(12.3,8.5,7.0,-.3),(-10.4,15.8,6.3,.6),(10.7,15.8,6.8,-.6)]):palm(x,y,h*(.94 if city else 1),lean,i)
for side in [-1,1]:
    for x in [side*8.9,side*11.5]:
        for y in [-15.5,-12.8]:box('ShadePost',(x,y,3.85),(.11,.11,2.9),wood,.02)
        box('ShadeSideBeam',(x,-14.15,5.27),(.15,3.10,.18),wood,.025)
    for y in [-15.5,-12.8]:box('ShadeEndBeam',(side*10.2,y,5.27),(2.95,.15,.18),wood,.025)
    if city:
        for i in range(8):box('ShadeLouver',(side*10.2,-15.55+i*.42,5.29),(3.2,.24,.10),wood,.035)
    else:
        vertices=[(side*8.65,-15.8,5.34),(side*11.75,-15.8,5.34),(side*11.75,-12.4,5.34),(side*8.65,-12.4,5.34),(side*10.2,-14.1,5.58)]
        sail=mesh('ShadeSail',vertices,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],white)
        m=sail.modifiers.new('Canvas thickness','SOLIDIFY');m.thickness=.025
${sceneryPython}
`
    : `
marking=material('Pool marking',(.78,.94,.94))
def ring(name,center,radius,start,end):
    count=max(24,round(abs(end-start)*radius*10));verts=[]
    for i in range(count+1):
        a=start+(end-start)*i/count
        for r in [radius-.013,radius+.013]:verts.append((center[0]+math.sin(a)*r,center[1]+math.cos(a)*r,.007))
    return mesh(name,verts,[(i*2+2,i*2+3,i*2+1,i*2) for i in range(count)],marking)
ring('CentreCircle',(0,0),1.35,0,math.tau)
mesh('FaceoffDot',[(0,0,.008)]+[(.07*math.sin(i/24*math.tau),.07*math.cos(i/24*math.tau),.008) for i in range(24)],[(0,(i+1)%24+1,i+1) for i in range(24)],marking)
for side in [-1,1]:
    for radius in [3,5]:ring('GoalSemicircle'+str(radius),(0,side*12.5),radius,math.pi/2 if side>0 else -math.pi/2,math.pi*1.5 if side>0 else math.pi/2)
${arena === "alpine" || arena === "forest" ? alpineForestPython : ruinsDesertPython}
${glacierTerminalPython}
`
}
${paintPython}
scene.world=bpy.data.worlds.new('Arena daylight');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.16,.28,1) if city else (.55,.77,.90,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4 if city else .6
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(join(directory, `${arena}.blend`))})
print(json.dumps({'objects':len(scene.objects),'vertices':sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH')}))
`;
await Bun.write(join(directory, `${arena}-authoring.txt`), code);
const task = Bun.spawn(
  [
    blenderExecutable,
    "--background",
    "--threads",
    "2",
    "--python-exit-code",
    "1",
    "--python-expr",
    code,
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if ((await task.exited) !== 0) throw new Error("Pool authoring failed");
