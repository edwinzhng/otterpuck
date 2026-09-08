import { join } from "node:path";
import { continuousPython } from "./continuous";
import { geometryPython } from "./geometry";
import { rigPython } from "./rig";
import { stylePython } from "./style";

export const characterPython = (species: "otter" | "beaver"): string => `
${geometryPython}
species=${JSON.stringify(species)}
beaver=species=='beaver'
scene=bpy.data.scenes.new('OTTERPUCK '+species.title())
bpy.context.window.scene=scene
collection=bpy.data.collections.new(species.title()+' Character');scene.collection.children.link(collection)
scene.unit_settings.system='METRIC'
scene['reference']='Latest slim beaver and otter sheet, 2026-09-07'
${rigPython}
fur_rgb=(.31,.131,.056) if beaver else (.36,.17,.065)
cream_rgb=(.65,.37,.17) if beaver else (.91,.78,.54)
coat=color('Fur',(1,1,1),.8)
vc=coat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Coat'
coat.node_tree.links.new(vc.outputs['Color'],coat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
fur=color('Paw fur',fur_rgb,.76)
team=color('Team',(.60,.025,.036) if beaver else (.025,.18,.53),.85)
cap_mat=color('Cap',(.60,.025,.036) if beaver else (.025,.18,.53),.85)
seam=color('Team seam',(.82,.084,.090) if beaver else (.047,.33,.72),.85)
rubber=color('Rubber',(.006,.013,.017),.56)
nose_mat=color('Nose',(.030,.017,.012),.44)
eye_mat=color('Eyes',(.002,.008,.009),.50)
highlight=color('Eye highlight',(.93,.99,1),.2)
mouth_mat=color('Mouth',(.10,.039,.014),.8)
mitt=color('Mitten',(.82,.83,.80) if beaver else (.53,.82,.93),.60)
white=color('Cap number',(.97,.96,.89),.5)
lens=color('Lens',(.42,.055,.15) if beaver else (.025,.26,.48),.17,.75,.66)
lens_shader=lens.node_tree.nodes['Principled BSDF']
lens_shader.inputs['Coat Weight'].default_value=.55
lens_shader.inputs['Coat Roughness'].default_value=.20
lens['otterpuck_visor']='tinted-mirror'
lens.use_backface_culling=True
inner_ear=color('Ear inner',(.22,.075,.032) if beaver else (.29,.117,.045),.83)

def blend(a,b,t):return tuple(a[i]*(1-t)+b[i]*t for i in range(3))
sections=[(-.235,.008,.012,.005),(-.215,.062,.060,0),(-.185,.099,.088,-.006),(-.135,.123,.105,-.007),(-.075,.130,.112,-.002),(-.015,.126,.111,.004),(.045,.119,.104,.010),(.100,.110,.099,.016),(.145,.092,.087,.022),(.18,.074,.070,.026),(.215,.045,.041,.030),(.230,.01,.010,.030)]
def body_section(y,rx,rz,cz):
    fullness=math.exp(-((y+.055)/.16)**4) if beaver else 0
    haunch=math.exp(-((y+.145)/.075)**2) if beaver else 0
    width=1.035+.145*fullness+.14*haunch if beaver else 1
    return (y,rx*width,rz*(1+.12*fullness+.15*haunch),cz+.006*haunch)
body=loft('Body',[body_section(*section) for section in sections],coat)
soften(body,2)
def belly_color(p):
    boundary=-.047+.015*math.cos((p.y+.02)*9)
    shape=(p.x/(.096 if not beaver else .105))**2+((p.y+.005)/.215)**2
    marking=(1-smooth(.92,1.06,shape))*(1-smooth(boundary-.013,boundary+.004,p.z))
    shade=.94+.06*smooth(-.16,.09,p.z)
    return tuple(c*shade for c in blend(fur_rgb,cream_rgb,marking))
paint(body,belly_color)
spine_nodes=[(-.20,'pelvis'),(-.09,'spine'),(.015,'spineMid'),(.115,'chest'),(.20,'neck')]
skin(body,lambda p:chain(p.y,spine_nodes))

def face_surface(u,v):
    s=math.sin(v);front=math.cos(u)
    z=.018+math.cos(v)*(.116 if math.cos(v)>0 else .088)
    x=math.sin(u)*s*.151*(1-.05*smooth(.01,-.105,z))*(1.025 if beaver else 1)
    y=.302+front*s*.122
    forward=max(0,front)**5
    cheek=0
    eye_socket=0
    bridge=0
    chin_recess=.025*math.exp(-((z+.069)/.022)**2)
    y+=forward*(cheek+bridge-eye_socket-chin_recess)
    return (x,y,z)
head=uv_surface('Head',face_surface,coat,48,32)
soften(head,1)
def face_front(x,z):
    v=math.acos(max(-.99,min(.99,(z-.018)/(.116 if z>.018 else .088))))
    width=.151*math.sin(v)*(1-.05*smooth(.01,-.105,z))*(1.025 if beaver else 1)
    u=math.asin(max(-.99,min(.99,x/width)))
    base=face_surface(u,v)[1]
    muzzle_radius=1-(x/.078)**2-((z+.024)/.034)**2
    return max(base,.417+math.sqrt(muzzle_radius)*.035) if muzzle_radius>0 else base
def face_color(p):
    cheek=((abs(p.x)-.037)/.060)**2+((p.z+.030)/.039)**2
    chin=(p.x/.069)**2+((p.z+.042)/.024)**2
    marking=(1-smooth(.84,1.08,min(cheek,chin)))*smooth(.32,.375,p.y)
    shade=.95+.05*smooth(-.11,.10,p.z)
    face_cream=(.77,.55,.29) if beaver else (.95,.85,.65)
    return tuple(c*shade for c in blend(fur_rgb,face_cream,marking))
paint(head,face_color);rigid(head,'head')
muzzle=uv_surface('Muzzle',lambda u,v:(math.sin(u)*math.sin(v)*.078,.417+math.cos(u)*math.sin(v)*.035,-.024+math.cos(v)*.034),coat,40,28)
paint(muzzle,lambda p:(.77,.55,.29) if beaver else (.95,.85,.65));rigid(muzzle,'head')
for side,suffix in [(-1,'L'),(1,'R')]:
    ear=oval('Ear'+suffix,(side*.146,.267,.040),(.021,.022,.023),fur,'head',20,12)
    oval('EarInset'+suffix,(side*.161,.283,.043),(.011,.006,.013),inner_ear,'head',16,12)
    x=side*.058;eye_y=face_front(x,.035)+.002
    oval('Eye'+suffix,(x,eye_y,.035),(.021,.008,.023),eye_mat,'head',24,16)
    oval('EyeLight'+suffix,(x-side*.004,eye_y+.0085,.043),(.0036,.0015,.0043),highlight,'head',12,8)
    eyelid_points=[(x+side*dx,face_front(x+side*dx,.035+dz)+.006,.035+dz) for dx,dz in [(-.021,.008),(-.012,.019),(.004,.021),(.020,.012)]]
    eyelid=sweep('UpperLid'+suffix,catmull(eyelid_points,4),.0035,fur,8);rigid(eyelid,'head')
nose_y=face_front(0,-.018)+.009
nose=uv_surface('Nose',lambda u,v:(math.sin(u)*math.sin(v)*.020*(.83+.24*math.cos(v)),nose_y+math.cos(u)*math.sin(v)*.010,-.018+math.cos(v)*.011),nose_mat,24,16)
rigid(nose,'head')
smile_points=[(-.026,0,-.040),(-.016,0,-.047),(0,0,-.049),(.015,0,-.046),(.026,0,-.038)]
smile_points=[(x,face_front(x,z)+.004,z) for x,y,z in smile_points]
smile=sweep('Smile',catmull(smile_points,5),.0016,mouth_mat,8);rigid(smile,'head')
philtrum=sweep('Muzzle line',catmull([(0,face_front(0,z)+.004,z) for z in [-.024,-.028,-.031]],5),.0012,mouth_mat,8);rigid(philtrum,'head')
if beaver:
    for side in [-1,1]:
        tooth_y=face_front(side*.008,-.052)+.003
        vertices=[(side*.008+x,tooth_y+y,-.0615+z) for x in [-.0065,.0065] for y in [-.004,.004] for z in [-.009,.009]]
        tooth=mesh('Incisor'+str(side),vertices,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],white)
        bevel=tooth.modifiers.new('Rounded tooth edges','BEVEL');bevel.width=.002;bevel.segments=3
        rigid(tooth,'head')

def cap_surface(u,t):
    limit=.89+.88*((1-math.cos(u))/2)
    v=t*limit
    p=Vector(face_surface(u,v))
    direction=(p-Vector((0,.302,.018))).normalized()
    return p+direction*.006
cap_vertices=[cap_surface(j/48*math.tau,i/14) for i in range(15) for j in range(48)]
cap_faces=[(i*48+j,i*48+(j+1)%48,(i+1)*48+(j+1)%48,(i+1)*48+j) for i in range(14) for j in range(48)]
cap=mesh('ProtectiveCap',cap_vertices,cap_faces,cap_mat);rigid(cap,'head')
cap_hem=sweep('CapHem',[cap_surface(j/72*math.tau,1) for j in range(72)],.0025,cap_mat,6,True);rigid(cap_hem,'head')
def cap_panel_point(x,theta):
    cross=math.sqrt(1-(x/.151)**2)
    p=Vector((x,.302+math.cos(theta)*.122*cross,.018+math.sin(theta)*(.116 if math.sin(theta)>0 else .088)*cross))
    direction=(p-Vector((0,.302,.018))).normalized()
    return p+direction*.007
for x in [-.037,.037]:
    path=[cap_panel_point(x,.73+i/48*2.53) for i in range(49)]
    stripe=sweep('CapPanelLine',path,.0014,seam,6);rigid(stripe,'head')
for side,suffix in [(-1,'L'),(1,'R')]:
    oval('CapEarGuard'+suffix,(side*.148,.267,.040),(.028,.035,.034),cap_mat,'head',24,16)
def cap_print(center,normal,up,size):
    normal=Vector(normal).normalized();up=Vector(up).normalized();right=up.cross(normal).normalized()
    rotation=Matrix((right,up,normal)).transposed().to_euler()
    label=cap_number('7' if beaver else '3',center,rotation,size,white,'head')
    for vertex in label.data.vertices:
        delta=vertex.co-Vector((0,.302,.018))
        radial=math.sqrt((delta.x/.151)**2+(delta.y/.122)**2+(delta.z/(.116 if delta.z>0 else .088))**2)
        vertex.co=Vector((0,.302,.018))+delta/radial+delta.normalized()*.008
cap_print((0,.375,.113),(0,.72,.69),(0,-.69,.72),.046)
cap_print((0,.183,.070),(0,-.95,.31),(0,.31,.95),.050)

outline=[(-.113,.032),(-.100,.067),(-.058,.077),(0,.062),(.058,.077),(.100,.067),(.113,.032),(.093,.002),(.042,.000),(.021,-.025),(-.021,-.025),(-.042,.000),(-.093,.002)]
outline3=[Vector((x,face_front(x,z)+.009,z)) for x,z in outline]
rim_path=catmull(outline3,5,True)
rim=sweep('MaskFrame',rim_path,.006,rubber,10,True);rigid(rim,'head')
glass_vertices=[(0,face_front(0,.030)+.019,.030)]
for ring in range(1,7):
    for edge in rim_path:
        x=edge.x*ring/6;z=.030+(edge.z-.030)*ring/6
        glass_vertices.append((x,face_front(x,z)+.019-.008*(ring/6)**4,z))
glass_count=len(rim_path)
glass_faces=[(0,1+i,1+(i+1)%glass_count) for i in range(glass_count)]
for ring in range(5):
    for i in range(glass_count):
        a=1+ring*glass_count+i;b=1+ring*glass_count+(i+1)%glass_count
        glass_faces.append((a,b,b+glass_count,a+glass_count))
glass=mesh('MaskLens',glass_vertices,glass_faces,lens);rigid(glass,'head')
strap_path=catmull([(-.113,face_front(-.113,.032)+.010,.032),(-.139,.348,.027),(-.157,.300,.025),(-.130,.226,.025),(0,.172,.026),(.130,.226,.025),(.157,.300,.025),(.139,.348,.027),(.113,face_front(.113,.032)+.010,.032)],5)
strap=sweep('MaskStrap',strap_path,.008,rubber,8);rigid(strap,'head')
snorkel_path=catmull([(-.042,face_front(-.042,-.045)+.004,-.045),(-.094,.398,-.041),(-.145,.354,-.014),(-.161,.326,.055),(-.164,.306,.162),(-.166,.296,.200)],6)
snorkel=sweep('Snorkel',snorkel_path,.0105,rubber,10);rigid(snorkel,'head')
snorkel_tip=sweep('SnorkelTip',[Vector((-.165,.301,.180)),Vector((-.166,.296,.204))],.0115,seam,10);rigid(snorkel_tip,'head')

for side,suffix in [(-1,'L'),(1,'R')]:
    arm_path=catmull([(side*.075,.070,0),(side*.119,.108,-.027),(side*.155,.157,-.060),(side*.171,.195,-.077),(side*.164,.238,-.095)],4)
    arm=sweep('GripPaw'+suffix+'Arm',arm_path,lambda t:.064*(1-.48*t)+.003*math.sin(t*math.pi),fur,20)
    soften(arm,1)
    skin(arm,lambda p:chain(p.y,[(.075,'shoulder.'+suffix),(.135,'arm.'+suffix),(.195,'forearm.'+suffix),(.238,'paw.'+suffix)]))
    def paw_surface(u,v):
        return (side*.164+math.sin(u)*math.sin(v)*.041*(1+.08*math.cos(v)),.246+math.cos(v)*.049,-.095+math.cos(u)*math.sin(v)*.034)
    paw=uv_surface('GripPaw'+suffix,paw_surface,fur,24,18);rigid(paw,'paw.'+suffix)
    protected=uv_surface('GripPaw'+suffix+'Mitten',lambda u,v:Vector((side*.164,.246,-.095))+(Vector(paw_surface(u,v))-Vector((side*.164,.246,-.095)))*1.12,mitt,24,18);rigid(protected,'paw.'+suffix)
    wrist=oval('GripPaw'+suffix+'Wrist',(side*.164,.230,-.091),(.036,.025,.032),fur,'paw.'+suffix,20,14)
    cuff_path=catmull([(side*.171,.198,-.079),(side*.169,.208,-.084),(side*.167,.219,-.089)],3)
    cuff=sweep('GripPaw'+suffix+'Cuff',cuff_path,lambda t:.046-.002*t,team,24,False,.98)
    skin(cuff,lambda p:chain(p.y,[(.17,'forearm.'+suffix),(.238,'paw.'+suffix)]))
    leg_path=catmull([(side*.071,-.161,-.003),(side*.087,-.215,-.008),(side*.102,-.280,-.007),(side*.105,-.333,0)],6)
    leg=sweep('HindLeg'+suffix,leg_path,lambda t:.053+.009*math.sin(t*math.pi)-.016*t,fur,24);soften(leg,1)
    skin(leg,lambda p:chain(-p.y,[(.171,'pelvis'),(.22,'thigh.'+suffix),(.305,'shin.'+suffix),(.329,'foot.'+suffix)]))
    outline_fin=catmull([(-.035,-.321,0),(-.044,-.36,0),(-.077,-.506,0),(-.061,-.545,0),(-.021,-.550,0),(0,-.545,0),(.021,-.550,0),(.061,-.545,0),(.077,-.506,0),(.044,-.36,0),(.035,-.321,0)],4,True)
    verts=[]
    for z in [-.004,.007]:
        for p in outline_fin:verts.append((side*.105+p.x*.83,p.y,z+.010*math.sin(-(p.y+.321)/.23*math.pi)))
    n=len(outline_fin);faces=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    fin=mesh('FinBlade'+suffix,verts,faces,team)
    bevel=fin.modifiers.new('Soft blade edge','BEVEL');bevel.width=.0025;bevel.segments=2
    skin(fin,lambda p:chain(-p.y,[(.375,'foot.'+suffix),(.492,'finTip.'+suffix)]))
    oval('FinPocket'+suffix,(side*.105,-.348,.009),(.039,.052,.028),team,'foot.'+suffix,24,14)
    for x in [-.032,.032]:
        rib=sweep('FinRib'+suffix,catmull([(side*.105+x,-.374,.014),(side*.105+x*1.25,-.452,.019),(side*.105+x*1.45,-.518,.010)],6),.002,seam,6);skin(rib,lambda p:chain(-p.y,[(.375,'foot.'+suffix),(.492,'finTip.'+suffix)]))

if not beaver:
    tail_sections=[(-.195,.043,.033,.018),(-.22,.039,.031,.025),(-.25,.035,.027,.035),(-.29,.028,.022,.046),(-.33,.021,.016,.054),(-.365,.014,.010,.059),(-.392,.007,.006,.061),(-.406,.002,.003,.061)]
else:
    tail_sections=[(-.205,.030,.021,.024),(-.230,.027,.017,.039),(-.255,.031,.014,.052),(-.28,.055,.013,.062),(-.31,.072,.012,.068),(-.35,.074,.011,.071),(-.388,.064,.009,.073),(-.413,.043,.007,.074),(-.425,.019,.004,.074),(-.428,.001,.0015,.074)]
tail=loft('Tail',tail_sections,coat,28);soften(tail,1)
def tail_color(p):
    shade=1
    if beaver:
        grid1=abs(((p.x*17+p.y*13)%1)-.5)
        grid2=abs(((p.x*17-p.y*13)%1)-.5)
        shade=1-.32*(1-smooth(.025,.125,min(grid1,grid2)))*smooth(-.001,.022,p.z)*smooth(-.238,-.270,p.y)
    return tuple(c*shade for c in (fur_rgb if not beaver else (.125,.045,.019)))
paint(tail,tail_color);skin(tail,lambda p:chain(-p.y,[(.215+i*.042,'tail%02d'%(i+1)) for i in range(5)]))
${stylePython}
${continuousPython}
animate()
for obj in collection.objects:
    if obj.type=='MESH':obj.data.name=obj.name+'Mesh'
for obj in collection.objects:
    part=obj.get('asset_part','')
    if part.endswith('LCuff') or part.endswith('LMitten') or part=='GripPawR':obj.hide_render=True;obj.hide_set(True)
scene.world=bpy.data.worlds.new('Soft studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.56,.70,.77,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.28
for name,pos,energy,size in [('Key',(-1.2,1.8,2.7),90,2.7),('Fill',(1.8,1.2,.8),30,2.2),('Rim',(.1,-1.5,1.7),65,1.8)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Character review');camera=bpy.data.objects.new('Character review',data);scene.collection.objects.link(camera)
camera.location=(.85,1.45,.62);camera.rotation_euler=(Vector((0,.04,.015))-camera.location).to_track_quat('-Z','Y').to_euler()
data.type='ORTHO';data.ortho_scale=1.14;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=1000;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
scene.render.image_settings.file_format='PNG'
scene['Notes']='Fresh character surfaces, integrated muzzle and painted markings. Same gameplay scale and sockets.'
bpy.context.view_layer.update()
bpy.data.libraries.write(${JSON.stringify(join(import.meta.dir, `${species}.blend`))},{scene},compress=True)
result={'species':species,'meshes':sum(o.type=='MESH' for o in collection.objects),'vertices':sum(len(o.data.vertices) for o in collection.objects if o.type=='MESH'),'bones':len(armature.bones),'blend':${JSON.stringify(join(import.meta.dir, `${species}.blend`))}}
`;

const species = Bun.argv.includes("--beaver") ? "beaver" : "otter";
await Bun.write(
  join(import.meta.dir, `${species}-authoring.txt`),
  characterPython(species),
);
console.info(`Prepared Blender authoring for ${species}`);
