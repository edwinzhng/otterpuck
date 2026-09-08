import bpy, math, os
from mathutils import Vector
previous_scene = bpy.context.window.scene
scene = bpy.data.scenes.new("Otter Hockey — Player")
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
asset = bpy.data.collections.new("Otter Player")
scene.collection.children.link(asset)
def material(name, color, roughness=.5, metallic=0):
    mat=bpy.data.materials.new(name)
    mat.diffuse_color=(*color,1)
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Metallic'].default_value=metallic
    return mat
skin=material("Suit",(.018,.075,.092),.68)
team=material("Team",(.19,.16,.52),.32,.15)
capmat=material("Cap",(.02,.10,.16),.5)
carbon=material("Carbon",(.035,.047,.055),.34,.3)
weave=material("Carbon Weave",(.042,.053,.060),.43,.22)
dark=material("Rubber",(.012,.028,.033),.6)
glass=material("Mask Lens",(.08,.30,.36),.12,.55)
white=material("Pearl",(.78,.85,.88),.34,.16)
stickmat=material("Stick",(.032,.045,.052),.46)
objects=[]
skinparts=[]
armparts=[]
def move_collection(obj):
    for col in list(obj.users_collection): col.objects.unlink(obj)
    asset.objects.link(obj)
def ellipsoid(name, location, scale, mat, bone=None, group=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=location)
    obj=bpy.context.object
    obj.name=name
    obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    move_collection(obj)
    obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth=True
    if group is not None: group.append(obj)
    else: objects.append((obj,bone))
    return obj
def segment(name,a,b,r1,r2,mat,group=None,bone=None):
    av,bv=Vector(a),Vector(b)
    obj=ellipsoid(name,(av+bv)/2,(r1,r1,(bv-av).length/2+r2),mat,bone,group)
    obj.rotation_mode='QUATERNION'
    obj.rotation_quaternion=Vector((0,0,1)).rotation_difference(bv-av)
    return obj
def profile_mesh(name,centres,radii,group):
    vertices=[]
    rings=16
    for (x,y,z),(width,depth) in zip(centres,radii):
        for j in range(rings):
            angle=j/rings*math.tau
            vertices.append((x+math.cos(angle)*width,y,z+math.sin(angle)*depth))
    faces=[]
    for i in range(len(centres)-1):
        for j in range(rings): faces.append((i*rings+j,i*rings+(j+1)%rings,(i+1)*rings+(j+1)%rings,(i+1)*rings+j))
    faces.append(tuple(range(rings-1,-1,-1)))
    faces.append(tuple((len(centres)-1)*rings+j for j in range(rings)))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    obj=bpy.data.objects.new(name,mesh)
    asset.objects.link(obj)
    obj.data.materials.append(skin)
    group.append(obj)
def union_parts(parts,name,voxel):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts: obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    remesh=obj.modifiers.new("Continuous skin","REMESH")
    remesh.mode='VOXEL'
    remesh.voxel_size=voxel
    remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=obj.modifiers.new("Soft anatomy","SMOOTH")
    smooth.factor=1.1
    smooth.iterations=4
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate=obj.modifiers.new("Game topology","DECIMATE")
    decimate.ratio=.55
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    return obj
def tube(name,points,radius,mat,bone):
    curve=bpy.data.curves.new(name,'CURVE')
    curve.dimensions='3D'; curve.resolution_u=4; curve.bevel_depth=radius; curve.bevel_resolution=1
    spline=curve.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points,points):
        p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve); asset.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=obj; obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj=bpy.context.object; obj.data.materials.append(mat)
    objects.append((obj,bone)); obj.select_set(False)

fur=material("Chestnut fur",(.19,.105,.067),.85)
cream=material("Cream muzzle",(.64,.47,.31),.86)
inner=material("Ear velvet",(.30,.17,.13),.87)
eye=material("Obsidian eyes",(.006,.009,.012),.19)
nosemat=material("Nose",(.03,.021,.021),.38)
glow=material("Ice light",(.16,.70,.81),.3,.15)
lavender=material("Violet shell",(.38,.34,.69),.25,.28)
ellipsoid("Round body",(0,-.025,.006),(.172,.275,.135),fur,bone="spine")
ellipsoid("Cream belly",(0,.015,-.113),(.127,.222,.035),cream,bone="spine")
ellipsoid("Teal harness",(0,.015,.040),(.178,.153,.123),skin,bone="spine")
ellipsoid("Harness shell",(0,.014,.158),(.116,.116,.018),lavender,bone="spine")
ellipsoid("Team light",(0,.028,.177),(.042,.05,.007),team,bone="spine")
for side in [-1,1]:
    ellipsoid("Front paw",(side*.164,.073,-.051),(.049,.084,.044),fur,bone="spine")
    for j in range(3):
        ellipsoid("Paw toe",(side*.17+(j-1)*.02,.018,-.060),(.013,.024,.021),cream,bone="spine")
    ellipsoid("Hind paw",(side*.112,-.266,-.006),(.057,.08,.049),fur,bone="thigh.L" if side<0 else "thigh.R")
face_origin=Vector((0,.307,.038))

face_normal=Vector((0,.88,-.475)).normalized()
face_up=Vector((0,.475,.88)).normalized()
def face_point(u,v,d):
    return face_origin+Vector((u,0,0))+face_up*v+face_normal*d
def feature(name,u,v,d,scale,mat):
    obj=ellipsoid(name,face_point(u,v,d),scale,mat,bone="head")
    obj.rotation_mode='QUATERNION'
    obj.rotation_quaternion=Vector((0,1,0)).rotation_difference(face_normal)
    return obj
headparts=[]
for name,u,v,d,scale in [("Skull",0,.022,0,(.143,.113,.145)),("Jaw",0,-.049,.023,(.12,.087,.092)),("Neck",0,-.139,-.006,(.078,.066,.080))]:
    obj=feature(name,u,v,d,scale,fur)
    objects.pop()
    headparts.append(obj)
head=union_parts(headparts,"Otter head",.008)
objects.append((head,"head"))
for side in [-1,1]:
    feature("Cream cheek",side*.076,-.043,.082,(.058,.029,.065),cream)
    feature("Muzzle",side*.033,-.064,.117,(.047,.035,.037),cream)
    feature("Ear",side*.132,.079,-.019,(.032,.022,.033),fur)
    feature("Inner ear",side*.135,.078,.001,(.020,.005,.021),inner)
    feature("Eye socket",side*.060,.031,.089,(.035,.019,.034),inner)
    feature("Eye",side*.060,.034,.104,(.027,.015,.030),eye)
    feature("Catchlight",side*.053,.044,.117,(.006,.003,.007),white)
    tube("Brow",[face_point(side*.031,.058,.078),face_point(side*.048,.066,.079),face_point(side*.073,.062,.066)],.006,fur,"head")
    for i in range(3):
        feature("Whisker pore",side*(.037+i*.009),-.050-(i%2)*.014,.123,(.0016,.0018,.0016),nosemat)
        tube("Whisker",[face_point(side*.052,-.06-i*.009,.12),face_point(side*.116,-.059+(i-1)*.017,.13),face_point(side*.177,-.048+(i-1)*.034,.102)],.0009,white,"head")
feature("Chin",0,-.097,.071,(.051,.025,.021),cream)
feature("Nose",0,-.040,.155,(.027,.014,.016),nosemat)
tube("Mouth",[face_point(-.047,-.083,.119),face_point(-.018,-.088,.13),face_point(0,-.077,.132),face_point(.018,-.088,.13),face_point(.047,-.083,.119)],.0018,nosemat,"head")
tube("Nose line",[face_point(0,-.047,.14),face_point(0,-.076,.133)],.0018,nosemat,"head")
for side in [-1,1]:
    rim=[face_point(side*.054+math.cos(a)*.043,.098+math.sin(a)*.025,.070) for a in [i/16*math.tau for i in range(17)]]
    tube("Goggle rim",rim,.007,white,"head")
    feature("Goggle lens",side*.054,.098,.070,(.038,.005,.020),glass)
tube("Goggle bridge",[face_point(-.013,.099,.075),face_point(0,.092,.087),face_point(.013,.099,.075)],.006,dark,"head")
tube("Goggle strap",[face_point(-.106,.099,.066),face_point(-.12,.091,-.02),face_point(-.073,.087,-.085),face_point(0,.088,-.095),face_point(.073,.087,-.085),face_point(.12,.091,-.02),face_point(.106,.099,.066)],.006,capmat,"head")
tube("Compact snorkel",[face_point(-.079,-.078,.1),face_point(-.127,-.046,.082),face_point(-.136,.044,.037),face_point(-.123,.160,-.015)],.007,dark,"head")
feature("Snorkel tip",-.123,.160,-.015,(.009,.011,.012),glow)
for side in [-1,1]:
    foot="foot.L" if side<0 else "foot.R"
    ellipsoid("Fin pocket",(side*.112,-.352,.001),(.059,.077,.039),white,bone=foot)
    ellipsoid("Fin opening",(side*.112,-.313,.022),(.043,.033,.017),glow,bone=foot)
    verts=[]
    rows=[(-.378,.053,.012),(-.422,.069,.012),(-.497,.081,.021),(-.514,.075,.023)]
    for y,width,z in rows:
        for j in range(5):verts.append((side*.112+(j/4-.5)*width*2,y,z+.007*math.cos(j/4*math.pi)))
    faces=[(r*5+j,r*5+j+1,(r+1)*5+j+1,(r+1)*5+j) for r in range(3) for j in range(4)]
    mesh=bpy.data.meshes.new("Short fin");mesh.from_pydata(verts,[],faces)
    obj=bpy.data.objects.new("Fin",mesh);asset.objects.link(obj);obj.data.materials.append(lavender)
    solid=obj.modifiers.new("Fin thickness","SOLIDIFY");solid.thickness=.004
    objects.append((obj,foot))
    tube("Fin ridge",[(side*.112,-.40,.03),(side*.112,-.45,.032),(side*.112,-.505,.034)],.0025,glow,foot)
tailpoints=[(0,-.21,.066),(0,-.30,.072),(.014,-.39,.073),(.039,-.47,.088),(.080,-.54,.117),(.116,-.57,.144),(.136,-.57,.166)]
tailwidth=[.066,.061,.047,.036,.026,.014,.002]
vertices=[]
for (x,y,z),r in zip(tailpoints,tailwidth):
    for j in range(12):
        a=j/12*math.tau;vertices.append((x+math.cos(a)*r,y,z+math.sin(a)*r*.7))
faces=[(i*12+j,i*12+(j+1)%12,(i+1)*12+(j+1)%12,(i+1)*12+j) for i in range(6) for j in range(12)]
faces.extend([tuple(range(11,-1,-1)),tuple(6*12+j for j in range(12))])
mesh=bpy.data.meshes.new("Tapered tail");mesh.from_pydata(vertices,[],faces)
obj=bpy.data.objects.new("Tail",mesh);asset.objects.link(obj);obj.data.materials.append(fur)
for p in mesh.polygons:p.use_smooth=True
objects.append((obj,"pelvis"))
bones={
"pelvis":((0,-.18,0),(0,-.02,0),None),
"spine":((0,-.02,0),(0,.19,.02),"pelvis"),
"head":((0,.19,.02),(0,.43,.03),"spine"),
"thigh.L":((-.112,-.18,0),(-.112,-.29,0),"pelvis"),
"shin.L":((-.112,-.29,0),(-.112,-.33,0),"thigh.L"),
"foot.L":((-.112,-.33,0),(-.112,-.48,.02),"shin.L"),
"thigh.R":((.112,-.18,0),(.112,-.29,0),"pelvis"),
"shin.R":((.112,-.29,0),(.112,-.33,0),"thigh.R"),
"foot.R":((.112,-.33,0),(.112,-.48,.02),"shin.R"),
}
rigdata=bpy.data.armatures.new("Otter Rig")
rig=bpy.data.objects.new("Otter",rigdata)
asset.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name,(a,b,parent) in bones.items():
    bone=rigdata.edit_bones.new(name)
    bone.head=a; bone.tail=b
    if parent: bone.parent=rigdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
def bind(obj,fixed=None):
    obj.parent=rig
    mod=obj.modifiers.new("Swim motion","ARMATURE")
    mod.object=rig
    if fixed:
        group=obj.vertex_groups.new(name=fixed)
        group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
for obj,bone in objects:
    if bone: bind(obj,bone)

bpy.context.view_layer.update()
for obj in list(asset.objects):
    if obj.type!='MESH': continue
    for mod in list(obj.modifiers):
        if mod.type=='SOLIDIFY':
            bpy.context.view_layer.objects.active=obj
            bpy.ops.object.modifier_apply(modifier=mod.name)
batches={}
for obj in list(asset.objects):
    if obj.type!='MESH':continue
    key="Body"
    batches.setdefault(key,[]).append(obj)
for name,parts in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    bpy.context.object.name=name
bpy.ops.object.select_all(action='DESELECT')
for obj in asset.objects: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath='/private/tmp/uwh-game/public/models/otter.glb',export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_yup=True)
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED'
scene.render.threads=4
scene.world=bpy.data.worlds.new("Otter studio")
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.105,.20,.27,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.5
def area(name,location,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=location
    ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
area("Key",(-3,4,5),340,(.78,.88,1),4)
area("Fill",(3,1,-2),180,(.65,.8,1),3)
area("Rim",(1,-3,3),440,(.3,.9,1),3)
camera_data=bpy.data.cameras.new("Portrait");camera=bpy.data.objects.new("Portrait",camera_data);scene.collection.objects.link(camera)
rig.rotation_euler.x=math.pi/2
pb=rig.pose.bones['head']
pb.rotation_mode='XYZ'
pb.rotation_euler.x=-.50
bpy.context.view_layer.update()
camera.location=(1.9,4.8,2.6)
target=Vector((0,0,-.06))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO';camera_data.ortho_scale=1.38
scene.camera=camera
scene.render.resolution_x=800;scene.render.resolution_y=950;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath='/private/tmp/uwh-game/art/otter-preview.png'
scene.render.film_transparent=True
bpy.ops.wm.save_as_mainfile(filepath='/private/tmp/uwh-game/art/otter.blend')
bpy.ops.render.render(write_still=True)
print({'asset_bytes':os.path.getsize('/private/tmp/uwh-game/public/models/otter.glb'),'meshes':[(o.name,len(o.data.vertices)) for o in asset.objects if o.type=='MESH']})
