export const detailPrimitives = `
import bpy, math
from mathutils import Vector, noise
scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK'))
bpy.context.window.scene=scene
for obj in list(scene.objects):
    if obj.get('otterpuck_detail'):
        data=obj.data
        bpy.data.objects.remove(obj,do_unlink=True)
        if data.users==0:bpy.data.meshes.remove(data)
collection=next((c for c in scene.collection.children if c.get('otterpuck_details')),None)
if not collection:
    collection=bpy.data.collections.new('Scenic Details')
    collection['otterpuck_details']=True
    scene.collection.children.link(collection)
materials={m.get('arena_original',m.name):m for o in scene.objects if o.type=='MESH' for m in o.data.materials}
def dm(name,rgb=None,glow=False):
    if name in materials:return materials[name]
    if rgb is None:raise ValueError('Missing authored material '+name)
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1);m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*rgb,1)
    shader.inputs['Roughness'].default_value=.72
    if glow:
        shader.inputs['Emission Color'].default_value=(*rgb,1)
        shader.inputs['Emission Strength'].default_value=.7
    else:
        node=m.node_tree.nodes.get('Detail paint') or m.node_tree.nodes.new('ShaderNodeVertexColor')
        node.name='Detail paint';node.layer_name='Color'
        m.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
        m['arena_original']=name
    m['arena_surface']='emissive' if glow else 'toon'
    materials[name]=m
    return m
def tagged(obj):
    obj['otterpuck_detail']=True
    for c in list(obj.users_collection):c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj
def dmesh(name,vertices,faces,mat,smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);collection.objects.link(obj)
    obj['otterpuck_detail']=True;data.materials.append(mat)
    for p in data.polygons:p.use_smooth=smooth
    return obj
def dbox(name,center,size,mat,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=tagged(bpy.context.object);obj.name=name;obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Crafted soft edge','BEVEL');mod.width=bevel;mod.segments=1
    return obj
def dbeam(name,a,b,width,mat):
    a,b=Vector(a),Vector(b)
    obj=dbox(name,(a+b)*.5,(width,width,(b-a).length),mat,0)
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj
def doval(name,center,size,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,location=center)
    obj=tagged(bpy.context.object);obj.name=name;obj.scale=size;obj.data.materials.append(mat)
    for p in obj.data.polygons:p.use_smooth=True
    return obj
def dlathe(name,center,profile,mat,segments=12):
    verts=[];faces=[]
    for radius,z in profile:
        for i in range(segments):
            a=i*math.tau/segments;verts.append((radius*math.cos(a),radius*math.sin(a),z))
    for row in range(len(profile)-1):
        for i in range(segments):
            n=row*segments+i;j=row*segments+(i+1)%segments
            faces.append((n,j,j+segments,n+segments))
    obj=dmesh(name,verts,faces,mat,True);obj.location=center
    return obj
def dring(name,center,radius,tube,mat,vertical=False):
    verts=[];faces=[]
    for i in range(16):
        a=i*math.tau/16
        for j in range(6):
            b=j*math.tau/6;r=radius+tube*math.cos(b)
            verts.append((r*math.cos(a),r*math.sin(a),tube*math.sin(b)))
    for i in range(16):
        for j in range(6):faces.append((i*6+j,((i+1)%16)*6+j,((i+1)%16)*6+(j+1)%6,i*6+(j+1)%6))
    obj=dmesh(name,verts,faces,mat,True);obj.location=center
    if vertical:obj.rotation_euler.x=math.pi/2
    return obj
def dleaf(name,base,direction,length,width,mat):
    base=Vector(base);direction=Vector(direction).normalized();across=Vector((-direction.y,direction.x,0)).normalized()
    verts=[];faces=[]
    for row in range(5):
        t=row/4;c=base+direction*length*t+Vector((0,0,.35*length*math.sin(t*math.pi)))
        for side in [-1,0,1]:verts.append(c+across*side*width*math.sin(t*math.pi)+Vector((0,0,.05*(1-abs(side))*math.sin(t*math.pi))))
    for row in range(4):
        for col in range(2):
            n=row*3+col;faces.append((n,n+1,n+4,n+3))
    obj=dmesh(name,verts,faces,mat,True);obj['wind_weight']=.035
    return obj
def dplant(x,y,z,scale,mat):
    for i in range(7):
        a=i*2.4;dleaf('Curved garden leaf',(x,y,z),(math.cos(a),math.sin(a),.22),scale,.23*scale,mat)
def dpot(x,y,z,scale,mat,leaf):
    dlathe('Wheel-thrown garden pot',(x,y,z),[(.26*scale,0),(.43*scale,.17*scale),(.47*scale,.62*scale),(.36*scale,.82*scale),(.38*scale,.9*scale),(.28*scale,.9*scale),(.27*scale,.75*scale)],mat)
    dplant(x,y,z+.83*scale,.8*scale,leaf)
def dbench(x,y,z,wood,trim,snow=None):
    for side in [-1,1]:dbox('Bench trestle',(x+side*.78,y,z+.27),(.18,.65,.54),wood)
    for row in [-1,0,1]:dbox('Rounded bench slat',(x,y+row*.20,z+.57),(2.25,.17,.12),trim,.045)
    for side in [-1,1]:dbox('Bench back support',(x+side*.88,y+.27,z+.83),(.12,.13,.94),wood)
    dbox('Bench backrest',(x,y+.28,z+1.13),(2.25,.16,.28),trim,.06)
    if snow:doval('Soft bench snow',(x,y,z+.69),(1.03,.30,.075),snow)
def dlantern(x,y,z,frame,glow):
    dbox('Lantern foot',(x,y,z+.09),(.48,.48,.18),frame,.05)
    dbox('Lantern warm core',(x,y,z+.43),(.28,.28,.52),glow,.035)
    for dx in [-.2,.2]:
        for dy in [-.2,.2]:dbeam('Lantern frame',(x+dx,y+dy,z+.15),(x+dx,y+dy,z+.74),.045,frame)
    dbox('Lantern cap',(x,y,z+.77),(.52,.52,.15),frame,.06)
def dpaint():
    bpy.context.view_layer.update()
    for obj in collection.objects:
        if obj.type!='MESH':continue
        attr=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        obj.data.color_attributes.active_color=attr
        for p in obj.data.polygons:
            rgb=obj.data.materials[p.material_index].diffuse_color[:3]
            for index in p.loop_indices:
                point=obj.matrix_world @ obj.data.vertices[obj.data.loops[index].vertex_index].co
                wash=.97+noise.noise(point*2.3)*.06
                attr.data[index].color=tuple(max(0,min(1,c*wash)) for c in rgb)+(1,)
`;
