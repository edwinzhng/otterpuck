export const geometryPython = `
import bpy, bmesh, math, json
from mathutils import Vector, Quaternion, Matrix

def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)

def color(name,rgb,rough=.65,metal=0,alpha=1):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    p.inputs['Alpha'].default_value=alpha
    m.diffuse_color=(*rgb,alpha)
    if alpha<1:m.surface_render_method='DITHERED'
    return m

def mesh(name,vertices,faces,material):
    data=bpy.data.meshes.new(name); data.from_pydata(vertices,[],faces); data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    obj=bpy.data.objects.new(name,data); collection.objects.link(obj)
    obj['asset_part']=name
    obj.data.materials.append(material)
    for p in data.polygons:p.use_smooth=True
    obj.parent=rig
    return obj

def skin(obj,weights):
    groups={}
    for v in obj.data.vertices:
        influences=weights(v.co)
        total=sum(w for _,w in influences)
        for name,w in influences:
            if w<=.0001:continue
            group=groups.get(name)
            if not group:group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name); groups[name]=group
            group.add([v.index],w/total,'REPLACE')
    modifier=obj.modifiers.new('Character skin','ARMATURE');modifier.object=rig

def rigid(obj,bone):skin(obj,lambda p:[(bone,1)])

def chain(x,nodes):
    for a,b in zip(nodes,nodes[1:]):
        if a[0]<=x<=b[0]:
            t=smooth(a[0],b[0],x); return [(a[1],1-t),(b[1],t)]
    return [(nodes[0 if x<nodes[0][0] else -1][1],1)]

def paint(obj,fn):
    data=obj.data.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
    for v in obj.data.vertices:data.data[v.index].color=(*fn(v.co),1)

def soften(obj,levels=1):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    modifier=obj.modifiers.new('Rounded contours','SUBSURF');modifier.levels=levels
    bpy.ops.object.modifier_apply(modifier=modifier.name)

def catmull(points,steps=5,closed=False):
    points=[Vector(p) for p in points]
    output=[]
    for i in range(len(points) if closed else len(points)-1):
        a=points[(i-1)%len(points)] if closed else points[max(0,i-1)]
        b=points[i];c=points[(i+1)%len(points)]
        d=points[(i+2)%len(points)] if closed else points[min(len(points)-1,i+2)]
        for j in range(steps):
            t=j/steps
            output.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    if not closed:output.append(points[-1])
    return output

def sweep(name,path,radii,material,segments=12,closed=False,flatten=1):
    vertices=[];faces=[]
    for i,p in enumerate(path):
        before=path[(i-1)%len(path)] if closed else path[max(0,i-1)]
        after=path[(i+1)%len(path)] if closed else path[min(len(path)-1,i+1)]
        orientation=Vector((0,1,0)).rotation_difference((after-before).normalized())
        radius=radii(i/(len(path)-1)) if callable(radii) else radii
        for j in range(segments):
            angle=j/segments*math.tau
            vertices.append(p+orientation @ Vector((math.cos(angle)*radius,0,math.sin(angle)*radius*flatten)))
    for i in range(len(path) if closed else len(path)-1):
        for j in range(segments):
            a=i*segments+j;b=i*segments+(j+1)%segments;c=((i+1)%len(path))*segments
            faces.append((a,b,c+(j+1)%segments,c+j))
    if not closed:faces.extend([tuple(reversed(range(segments))),tuple((len(path)-1)*segments+j for j in range(segments))])
    return mesh(name,vertices,faces,material)

def uv_surface(name,fn,material,u_count=32,v_count=24):
    vertices=[fn(j/u_count*math.tau,i/v_count*math.pi) for i in range(v_count+1) for j in range(u_count)]
    faces=[]
    for i in range(v_count):
        for j in range(u_count):
            a=i*u_count+j;b=i*u_count+(j+1)%u_count
            faces.append((a,b,b+u_count,a+u_count))
    return mesh(name,vertices,faces,material)

def oval(name,center,size,material,bone,segments=24,rings=16):
    obj=uv_surface(name,lambda u,v:Vector(center)+Vector((size[0]*math.sin(v)*math.sin(u),size[1]*math.sin(v)*math.cos(u),size[2]*math.cos(v))),material,segments,rings)
    rigid(obj,bone)
    return obj

def loft(name,sections,material,segments=32):
    vertices=[];faces=[]
    for y,rx,rz,cz in sections:
        for j in range(segments):
            a=j/segments*math.tau
            vertices.append((math.sin(a)*rx,y,cz+math.cos(a)*rz))
    for i in range(len(sections)-1):
        for j in range(segments):
            a=i*segments+j;b=i*segments+(j+1)%segments
            faces.append((a,a+segments,b+segments,b))
    faces.extend([tuple(range(segments)),tuple((len(sections)-1)*segments+j for j in reversed(range(segments)))])
    return mesh(name,vertices,faces,material)

def cap_number(text,center,rotation,size,material,bone):
    curve=bpy.data.curves.new('Cap number','FONT');curve.body=text;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=size;curve.extrude=.0003;curve.offset=.0007;curve.resolution_u=4
    obj=bpy.data.objects.new('CapNumber',curve);collection.objects.link(obj);obj.location=center;obj.rotation_euler=rotation
    obj.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    obj.parent=rig;rigid(obj,bone)
    return obj
`;
