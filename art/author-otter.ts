import { join } from "node:path";
import { blenderExecutable } from "./blender";

const directory = import.meta.dir;
const code = `
import bpy, bmesh, math, json
from mathutils import Vector, Quaternion
rig=bpy.data.objects['Otter']
source=bpy.data.objects['Body']
rig.rotation_euler=(0,0,0)
for b in rig.pose.bones:
    b.rotation_mode='QUATERNION'
    b.rotation_quaternion=(1,0,0,0)
bpy.context.view_layer.update()
collection=bpy.data.collections['Otter Player']
adj={v.index:[] for v in source.data.vertices}
for edge in source.data.edges:
    a,b=edge.vertices; adj[a].append(b); adj[b].append(a)
remaining=set(adj); parts=[]
while remaining:
    stack=[remaining.pop()]; indices=[]
    while stack:
        i=stack.pop(); indices.append(i)
        for n in adj[i]:
            if n in remaining: remaining.remove(n); stack.append(n)
    parts.append(indices)
assert len(parts)==57
materials={m.name:m for m in source.data.materials}
def mat(name,color,rough=.6,metal=0):
    m=materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=rough
    shader.inputs['Metallic'].default_value=metal
    m.diffuse_color=(*color,1)
    materials[name]=m
    return m
fur=mat('Chestnut fur',(.32,.142,.059))
cream=mat('Cream muzzle',(.84,.71,.48))
team=mat('Team',(.022,.19,.56),.38)
capmat=mat('Cap',(.022,.19,.56),.52)
rubber=mat('Rubber',(.014,.025,.032),.5)
mitt=mat('Mitten',(.48,.77,.89),.52)
mat('Ear velvet',(.24,.09,.037))
mat('Obsidian eyes',(.007,.009,.012),.21)
mat('Nose',(.018,.012,.009),.34)
mat('Pearl',(.96,.96,.87),.38)
trim=mat('Aqua trim',(.08,.65,.80),.35)
lens=mat('Mask Lens',(.12,.48,.56),.15)
lens.surface_render_method='DITHERED'
lens.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.23
lens.diffuse_color=(.12,.48,.56,.23)
def mesh_object(name,verts,faces,mats,material_ids=None):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); collection.objects.link(obj)
    for material in mats: mesh.materials.append(material)
    for p in mesh.polygons:
        p.use_smooth=True
        if material_ids: p.material_index=material_ids[p.index]
    obj.parent=rig
    modifier=obj.modifiers.new('Otter deformation','ARMATURE'); modifier.object=rig
    return obj
def weight(obj,name,indices,value=1):
    group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
    if indices: group.add(indices,value,'REPLACE')
def rigid(obj,bone): weight(obj,bone,list(range(len(obj.data.vertices))))
def extract(name,part_ids):
    indices=sorted(i for part in part_ids for i in parts[part]); mapping={v:i for i,v in enumerate(indices)}
    selected=[p for p in source.data.polygons if p.vertices[0] in mapping]
    obj=mesh_object(name,[source.matrix_world @ source.data.vertices[i].co for i in indices],[[mapping[i] for i in p.vertices] for p in selected],list(source.data.materials),[p.material_index for p in selected])
    return obj
def subdivide(obj,levels=1):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
    modifier=obj.modifiers.new('Soft silhouette','SUBSURF'); modifier.levels=levels
    bpy.ops.object.modifier_apply(modifier=modifier.name)
def ellipsoid(name,center,scale,material,bone,segments=20,rings=12):
    bm=bmesh.new(); bmesh.ops.create_uvsphere(bm,u_segments=segments,v_segments=rings,radius=1)
    bm.verts.ensure_lookup_table(); bm.verts.index_update()
    verts=[Vector(center)+Vector((v.co.x*scale[0],v.co.y*scale[1],v.co.z*scale[2])) for v in bm.verts]
    faces=[tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
    obj=mesh_object(name,verts,faces,[material]); rigid(obj,bone); return obj
def tube(name,centers,radii,material,segments=12):
    verts=[]; faces=[]
    for i,(center,radius) in enumerate(zip(centers,radii)):
        tangent=Vector(centers[min(i+1,len(centers)-1)])-Vector(centers[max(0,i-1)])
        orientation=Vector((0,1,0)).rotation_difference(tangent.normalized())
        for j in range(segments):
            a=j/segments*math.tau
            verts.append(Vector(center)+orientation @ Vector((math.cos(a)*radius,0,math.sin(a)*radius*.82)))
    for i in range(len(centers)-1):
        for j in range(segments):
            a=i*segments+j; b=i*segments+(j+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces += [tuple(reversed(range(segments))),tuple((len(centers)-1)*segments+j for j in range(segments))]
    return mesh_object(name,verts,faces,[material])
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent):
    b=rig.data.edit_bones.get(name) or rig.data.edit_bones.new(name)
    b.head=head; b.tail=tail
    b.parent=rig.data.edit_bones.get(parent) if parent else None
    return b
bone('pelvis',(0,-.18,0),(0,-.085,0),None)
bone('spine',(0,-.085,0),(0,.015,0),'pelvis')
bone('spineMid',(0,.015,0),(0,.11,.008),'spine')
bone('chest',(0,.11,.008),(0,.185,.015),'spineMid')
bone('neck',(0,.185,.015),(0,.24,.02),'chest')
bone('head',(0,.24,.02),(0,.43,.03),'neck')
for side,suffix in [(-1,'L'),(1,'R')]:
    bone('shoulder.'+suffix,(side*.08,.11,0),(side*.14,.10,-.01),'chest')
    bone('arm.'+suffix,(side*.14,.10,-.01),(side*.185,.155,-.055),'shoulder.'+suffix)
    bone('forearm.'+suffix,(side*.185,.155,-.055),(side*.164,.225,-.082),'arm.'+suffix)
    bone('paw.'+suffix,(side*.164,.225,-.082),(side*.164,.275,-.082),'chest')
    bone('tuft.'+suffix,(side*.137,.19,-.012),(side*.159,.145,-.018),'neck')
for i in range(5):
    bone('tail%02d'%(i+1),(0,-.25-i*.042,.042),(0,-.292-i*.042,.048),'pelvis' if i==0 else 'tail%02d'%i)
bpy.ops.object.mode_set(mode='OBJECT')
torso=extract('Body',[0]); belly=extract('Belly',[1]); head=extract('Face',[7,8,9,10,11,12,13,14,15,22,23,24,25,26,27,28,29,36,37,38,39])
subdivide(torso,2); subdivide(belly,2)
spine_nodes=[(-.18,'pelvis'),(-.065,'spine'),(.035,'spineMid'),(.135,'chest'),(.22,'neck')]
def chain_weight(obj,coordinate,nodes):
    for v in obj.data.vertices:
        x=coordinate(v.co)
        pair=next(((a,b) for a,b in zip(nodes,nodes[1:]) if a[0]<=x<=b[0]),None)
        if pair:
            a,b=pair; t=(x-a[0])/(b[0]-a[0]); t=t*t*(3-2*t)
            if t<1: weight(obj,a[1],[v.index],1-t)
            if t>0: weight(obj,b[1],[v.index],t)
        else: weight(obj,nodes[0 if x<nodes[0][0] else -1][1],[v.index])
chain_weight(torso,lambda p:p.y,spine_nodes); chain_weight(belly,lambda p:p.y,spine_nodes); rigid(head,'head')
for side,suffix,leg_id in [(-1,'L',5),(1,'R',6)]:
    leg=extract('HindLeg'+suffix,[leg_id]); subdivide(leg,1)
    chain_weight(leg,lambda p:-p.y,[(.18,'pelvis'),(.235,'thigh.'+suffix),(.31,'shin.'+suffix)])
    centers=[]; radii=[]
    a=Vector((side*.14,.10,-.01)); b=Vector((side*.185,.155,-.055)); c=Vector((side*.164,.225,-.082))
    for i in range(13):
        t=i/12
        center=(1-t)**2*a+2*(1-t)*t*b+t*t*c
        centers.append(center); radii.append(.037*(1-.27*t))
    arm=tube('GripPaw'+suffix+'Arm',centers,radii,fur)
    chain_weight(arm,lambda p:p.y,[(.1,'arm.'+suffix),(.175,'forearm.'+suffix),(.225,'paw.'+suffix)])
    ellipsoid('GripPaw'+suffix,(side*.164,.225,-.082),(.040,.051,.035),fur,'paw.'+suffix)
    ellipsoid('GripPaw'+suffix+'Mitten',(side*.164,.225,-.081),(.043,.054,.039),mitt,'paw.'+suffix)
    ellipsoid('GripPaw'+suffix+'Cuff',(side*.164,.195,-.073),(.038,.018,.033),team,'paw.'+suffix,16,8)
    ellipsoid('FinPocket'+suffix,(side*.112,-.355,0),(.052,.081,.036),rubber,'foot.'+suffix)
    verts=[]
    for z in [-.006,.008]:
        for x,y in [(-.046,-.365),(-.082,-.585),(-.059,-.61),(.059,-.61),(.082,-.585),(.046,-.365)]:
            verts.append((side*.112+x,y,z))
    faces=[(5,4,3,2,1,0),(6,7,8,9,10,11)]+[(j,(j+1)%6,(j+1)%6+6,j+6) for j in range(6)]
    fin=mesh_object('FinBlade'+suffix,verts,faces,[team]); rigid(fin,'foot.'+suffix)
    for x in [-.043,.043]:
        rail=tube('FinRail'+suffix+str(x),[(side*.112+x,-.38,.012),(side*.112+x*1.4,-.57,.012)],[.004,.003],trim,6); rigid(rail,'foot.'+suffix)
tail_centers=[(0,-.246-i*.018,.043+.016*math.sin(i/12*math.pi*.65)) for i in range(13)]
tail=tube('Tail',tail_centers,[.050*(1-i/12)**.8+.0015 for i in range(13)],fur,14)
chain_weight(tail,lambda p:-p.y,[(.25+i*.042,'tail%02d'%(i+1)) for i in range(5)])
for side,suffix in [(-1,'L'),(1,'R')]:
    tuft=tube('CheekTuft'+suffix,[(side*.133,.205,-.01),(side*.156,.166,-.018),(side*.147,.137,-.024)],[.022,.016,.0006],fur,8)
    rigid(tuft,'tuft.'+suffix)
cap=ellipsoid('ProtectiveCap',(0,.289,.071),(.145,.13,.138),capmat,'head',24,14)
for side,suffix in [(-1,'L'),(1,'R')]:
    ellipsoid('EarGuard'+suffix,(side*.142,.313,.085),(.018,.034,.034),team,'head',16,10)
    ellipsoid('EarInset'+suffix,(side*.157,.313,.085),(.006,.019,.021),trim,'head',12,8)
outline=[(-.104,.035),(-.09,.067),(-.038,.076),(0,.063),(.038,.076),(.09,.067),(.104,.035),(.10,-.005),(.058,-.021),(.033,-.019),(.022,-.070),(-.022,-.070),(-.033,-.019),(-.058,-.021),(-.10,-.005)]
centers=[(x,.435,z+.011) for x,z in outline+[outline[0]]]
frame=tube('MaskFrame',centers,[.012]*len(centers),rubber,10); rigid(frame,'head')
mask=mesh_object('MaskLens',[(x,.436,z+.011) for x,z in outline],[tuple(reversed(range(len(outline))))],[lens]); rigid(mask,'head')
strap=tube('MaskStrap',[(-.105,.416,.032),(-.145,.32,.027),(-.13,.22,.033),(0,.18,.048),(.13,.22,.033),(.145,.32,.027),(.105,.416,.032)],[.011]*7,rubber,8); rigid(strap,'head')
snorkel=tube('Snorkel',[(-.027,.412,-.09),(-.119,.396,-.08),(-.16,.371,-.03),(-.166,.33,.09),(-.169,.307,.22)],[.011,.014,.014,.014,.014],rubber,12); rigid(snorkel,'head')
tip=tube('SnorkelTip',[(-.169,.307,.22),(-.170,.304,.246)],[.015,.014],trim,12); rigid(tip,'head')
for obj in [source,bpy.data.objects.get('GripPawL'),bpy.data.objects.get('GripPawR')]:
    if obj: bpy.data.objects.remove(obj,do_unlink=True)
for obj in collection.objects:
    if obj.type=='MESH': obj.name=obj.name.replace('.001','')
rig.animation_data_create()
clips=[('Float',80),('Glide',64),('Swim',40),('Sprint',28),('SwimUp',40),('SwimDown',40),('Dive',36),('BankLeft',40),('BankRight',40),('Brake',36),('Reach',32)]
for name,duration in clips:
    action=bpy.data.actions.new(name); action.use_fake_user=True; rig.animation_data.action=action
    for frame_number in range(0,duration+1,4):
        phase=frame_number/duration*math.tau
        envelope=math.sin(frame_number/duration*math.pi)**2
        rotations={}
        moving=name in ['Swim','Sprint','SwimUp','SwimDown','Dive']
        intensity=1.45 if name=='Sprint' else 1 if moving else .06 if name=='Float' else .015
        for i,bone_name in enumerate(['pelvis','spine','spineMid','chest']):
            rotations[bone_name]=(math.sin(phase-i*.48)*.024*intensity,0,0)
        for side,suffix in [(0,'L'),(math.pi,'R')]:
            kick=phase+side
            rotations['thigh.'+suffix]=(math.sin(kick)*.24*intensity,0,0)
            rotations['shin.'+suffix]=(math.sin(kick-.65)*.21*intensity,0,0)
            rotations['foot.'+suffix]=(math.sin(kick-1.15)*.23*intensity,0,0)
            rotations['forearm.'+suffix]=(math.sin(phase-.7)*.018*intensity,0,0)
        for i in range(5): rotations['tail%02d'%(i+1)]=(math.sin(phase-1.1-i*.42)*.035*intensity,0,0)
        if name in ['SwimUp','SwimDown','Dive']:
            sign=-1 if name=='SwimDown' or name=='Dive' else 1
            for i,bone_name in enumerate(['spine','spineMid','chest','neck']):
                rotations[bone_name]=(sign*.065*(envelope if name=='Dive' else 1),0,0)
        if name in ['BankLeft','BankRight']:
            sign=1 if name=='BankLeft' else -1
            for i,bone_name in enumerate(['spine','spineMid','chest','neck']): rotations[bone_name]=(0,sign*.05*envelope,sign*.09*envelope)
        if name=='Brake':
            rotations['spine']=(.11*envelope,0,0)
            for side,suffix in [(-1,'L'),(1,'R')]:
                rotations['thigh.'+suffix]=(-.23*envelope,0,side*.14*envelope)
                rotations['foot.'+suffix]=(.38*envelope,0,0)
        if name=='Reach': rotations['chest']=(0,0,-.07*envelope)
        for b in rig.pose.bones:
            angles=rotations.get(b.name,(0,0,0))
            b.rotation_mode='QUATERNION'
            b.rotation_quaternion=Quaternion((1,0,0),angles[0]) @ Quaternion((0,1,0),angles[1]) @ Quaternion((0,0,1),angles[2])
            b.keyframe_insert('rotation_quaternion',frame=frame_number,group=b.name)
    track=rig.animation_data.nla_tracks.new(); track.name=name
    track.strips.new(name,0,action); track.mute=True
rig.animation_data.action=None
for b in rig.pose.bones: b.rotation_quaternion=(1,0,0,0)
bpy.context.scene.frame_set(0)
bpy.context.scene.render.fps=30
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene['Asset']='OTTERPUCK compact river otter'
bpy.context.scene['Source']='Derived from otter-paws.blend; face retained, rig and equipment revised'
bpy.context.scene['Forward']='+Y in Blender; -Z in glTF; metres'
rig['StickSocket']='paw.L / paw.R; runtime pusher remains separate'
rig['Clips']='In place; controller owns translation'
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(join(directory, "otterpuck.blend"))})
bpy.ops.object.select_all(action='DESELECT')
export_body=[o for o in collection.objects if o.type=='MESH' and not o.name.startswith('GripPaw')]
for obj in export_body: obj.select_set(True)
bpy.context.view_layer.objects.active=torso
bpy.ops.object.join()
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects: obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=${JSON.stringify(join(directory, "../public/models/otterpuck.glb"))},export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_step=2)
print(json.dumps({'bones':len(rig.data.bones),'clips':[a.name for a in bpy.data.actions],'vertices':sum(len(o.data.vertices) for o in collection.objects if o.type=='MESH')}))
`;
const task = Bun.spawn(
  [
    blenderExecutable,
    "--background",
    "--threads",
    "2",
    "--python-exit-code",
    "1",
    join(directory, "otter-paws.blend"),
    "--python-expr",
    code,
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if ((await task.exited) !== 0) throw new Error("Otter authoring failed");
