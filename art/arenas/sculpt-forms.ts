export const sculptForms = `
import bpy, math, re
from mathutils import Vector, noise
scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK'))
bpy.context.window.scene=scene
def bounds(obj):
    points=[obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return Vector(tuple(min(p[i] for p in points) for i in range(3))),Vector(tuple(max(p[i] for p in points) for i in range(3)))
def subdivision(obj,level,ratio=None):
    mod=obj.modifiers.get('Sculpted rounded silhouette') or obj.modifiers.new('Sculpted rounded silhouette','SUBSURF')
    mod.levels=level;mod.render_levels=level
    if ratio:
        decimate=obj.modifiers.get('Scenery silhouette budget') or obj.modifiers.new('Scenery silhouette budget','DECIMATE')
        decimate.ratio=ratio;decimate.use_collapse_triangulate=False
    for p in obj.data.polygons:p.use_smooth=True
def bevel(obj,width,segments=3):
    mod=next((m for m in obj.modifiers if m.type=='BEVEL'),None)
    if not mod:mod=obj.modifiers.new('Rounded crafted corners','BEVEL')
    mod.width=width;mod.segments=segments
    mod.harden_normals=True
    normal=obj.modifiers.get('Broad weighted planes') or obj.modifiers.new('Broad weighted planes','WEIGHTED_NORMAL')
    normal.keep_sharp=True;normal.weight=35
def reshape(obj,scale):
    low,high=bounds(obj);center=(low+high)*.5;inverse=obj.matrix_world.inverted()
    for vertex in obj.data.vertices:
        p=obj.matrix_world @ vertex.co
        vertex.co=inverse @ Vector(tuple(center[i]+(p[i]-center[i])*scale[i] for i in range(3)))
for obj in list(scene.objects):
    if obj.type!='MESH' or not obj.data.materials:continue
    name=obj.name
    materials=[m.get('arena_original',m.name) for m in obj.data.materials]
    if any(re.match(r'Pool |Goal |Trough ',name) for name in materials):continue
    if name.startswith(('Coping','Deck','Drain','Timber deck plank','Stone path')):continue
    fresh=not obj.get('sculpted_contours')
    if fresh and obj.data.users>1:obj.data=obj.data.copy()
    if name.startswith('PalmTrunk') and fresh:
        for row in range(17):
            ring=list(obj.data.vertices)[row*14:(row+1)*14]
            center=sum((v.co for v in ring),Vector())/len(ring)
            for v in ring:
                v.co.x=center.x+(v.co.x-center.x)*1.22
                v.co.y=center.y+(v.co.y-center.y)*1.22
    elif name.startswith('PalmFrond'):
        if fresh:
            for row in range(29):
                center=obj.data.vertices[row*5+2].co.copy()
                for col in range(5):
                    v=obj.data.vertices[row*5+col]
                    v.co.x=center.x+(v.co.x-center.x)*1.13
                    v.co.y=center.y+(v.co.y-center.y)*1.13
                    v.co.z-=abs(col-2)*.022*math.sin(row*math.pi/28)
        if not obj.get('leaf_cupping'):
            for row in range(29):
                center=obj.data.vertices[row*5+2].co.copy();arch=math.sin(row*math.pi/28)
                for col in range(5):
                    v=obj.data.vertices[row*5+col]
                    if col in [0,4]:
                        inner=obj.data.vertices[row*5+(1 if col==0 else 3)].co
                        v.co.x=center.x+((v.co.x-center.x)*.35+(inner.x-center.x)*1.30)*1.20
                        v.co.y=center.y+((v.co.y-center.y)*.35+(inner.y-center.y)*1.30)*1.20
                    elif col!=2:
                        v.co.x=center.x+(v.co.x-center.x)*1.20
                        v.co.y=center.y+(v.co.y-center.y)*1.20
                    v.co.z+=arch*(.20-.085*abs(col-2))
            obj['leaf_cupping']=True
    elif name.startswith('Canopy leaf spray') and not obj.get('leaf_cupping'):
        vertices=obj.data.vertices
        center=(vertices[1].co+vertices[3].co)*.5
        length=(vertices[4].co-vertices[0].co).length
        for i in [1,3]:
            vertices[i].co.x=center.x+(vertices[i].co.x-center.x)*1.22
            vertices[i].co.y=center.y+(vertices[i].co.y-center.y)*1.22
            vertices[i].co.z-=length*.045
        vertices[2].co.z+=length*.25
        vertices[4].co.z+=length*.065
        obj['leaf_cupping']=True
    elif name.startswith('Pine trunk'):
        inverse=obj.matrix_world.inverted()
        ground=min(2.3,terrain_height(obj.location.x,obj.location.y,2.44)-.8)
        for v in obj.data.vertices:
            if v.co.z<0:
                p=obj.matrix_world @ v.co;p.z=ground;target=inverse @ p
                if (v.co-target).length>1e-5:v.co=target
    elif name.startswith('Drooping tapered fir bough'):
        if fresh:reshape(obj,(1.13,1.13,1.42))
        subdivision(obj,1,.28)
    elif name.startswith(('Soft branch snow pillow','Low shrub snow')):
        if fresh:reshape(obj,(1.16,1.16,1.25))
        if not obj.get('snow_drape'):
            for v in obj.data.vertices:
                radius=math.hypot(v.co.x,v.co.y)
                angle=math.atan2(v.co.y,v.co.x)
                v.co.z-=radius*.035*(1+.45*math.sin(angle*3+obj.location.x))
            obj['snow_drape']=True
        subdivision(obj,1,.24)
    elif re.match(r'^(Snowbank granite|Grove ground rock)Snow(?:\\.|$)',name):
        for mod in list(obj.modifiers):
            if mod.name in ['Sculpted rounded silhouette','Scenery silhouette budget']:obj.modifiers.remove(mod)
    elif name.startswith('Sculpted alpine peak'):
        if fresh:
            low,high=bounds(obj);height=high.z-low.z
            for v in obj.data.vertices:
                t=(v.co.z-low.z)/max(.1,height)
                v.co.z-=.7*(1-t)**5
                v.co.x+=.35*math.sin(v.co.y*.16+v.co.z*.1)*math.sin(t*math.pi)
        for v in list(obj.data.vertices)[:24]:
            v.co.z=min(.8,terrain_height(v.co.x,v.co.y,2.44)-.6)
        subdivision(obj,1)
    elif name.startswith('Layered mesa'):
        if fresh:
            low,high=bounds(obj);center=(low+high)*.5;size=high-low
            for v in obj.data.vertices:
                t=(v.co.z-low.z)/size.z;a=math.atan2(v.co.y-center.y,v.co.x-center.x)
                v.co.x+=size.x*.055*math.sin(t*2.7+center.x*.1)+size.x*.025*math.sin(a*3+center.x)*math.sin(t*math.pi)
                v.co.y+=size.y*.035*math.sin(t*4+a*2)
                v.co.z+=.6*math.sin(a*3+center.x*.3)*t-.8*(1-t)**5
            for p in obj.data.polygons:p.material_index=0
        for v in list(obj.data.vertices)[:14]:
            v.co.z=min(-.8,terrain_height(v.co.x,v.co.y,.8)-.6)
        creases=obj.data.attributes.get('crease_edge') or obj.data.attributes.new('crease_edge','FLOAT','EDGE')
        for edge in obj.data.edges:
            a,b=edge.vertices
            creases.data[edge.index].value=.30 if a//14==b//14 and a//14 in [1,3,5] else 0
        subdivision(obj,2)
    elif name.startswith('GlacierRidge'):
        if fresh:
            reshape(obj,(1.12,1.45,1.15))
            low,high=bounds(obj)
            for v in obj.data.vertices:
                t=(v.co.z-low.z)/max(.1,high.z-low.z)
                v.co.x+=.6*math.sin(v.co.y*.32)*t
                v.co.z-=1.1*(1-t)
        if not obj.get('glacier_cliff_overlap'):
            reshape(obj,(1.04,1.65,1.))
            low,high=bounds(obj);center=(low+high)*.5
            for v in obj.data.vertices:
                v.co.x+=.55*math.sin(center.y*.55)
            obj['glacier_cliff_overlap']=True
        creases=obj.data.attributes.get('crease_edge') or obj.data.attributes.new('crease_edge','FLOAT','EDGE')
        for edge in obj.data.edges:
            a,b=sorted(edge.vertices)
            creases.data[edge.index].value=.32 if (a,b) in [(1,5),(2,6)] else .16
        subdivision(obj,2)
    elif name.startswith(('Waterfall crag','Cascade back wall','Mossy terrace boulder','Snowbank granite','Grove ground rock','ShoreBoulder','IceBoulder')):
        subdivision(obj,1,.60 if arena in ['tropical','alpine'] else None)
    elif name.startswith(('SkylineTower','TowerCrown','TowerUpperSetback','TowerShoulder')):
        bevel(obj,.38 if name.startswith('SkylineTower') else .23,2)
    elif name.startswith('FreightContainer'):
        bevel(obj,.14,3)
    elif name.startswith(('CraneGantry','CraneTop','Bridge','CargoHull')):
        bevel(obj,.18,3)
    elif name.startswith(('StationModule','SnowRoof','RadarBase')):
        bevel(obj,.25 if name.startswith('StationModule') else .16,3)
    elif name.startswith('RadarDome'):
        subdivision(obj,1)
    elif name.startswith('DomePanel') and arena=='glacier' and not obj.get('radome_fitted'):
        if abs(obj.location.x-8)<3 and abs(obj.location.y-25)<3:
            obj.location.x=8+(obj.location.x-8)*.65
            obj.location.y=25+(obj.location.y-25)*.65
        obj['radome_fitted']=True
    elif name.startswith(('Lodge walls','Lodge stone plinth','Main pitched roof','Deep roof snow','Supported porch canopy','Porch snow')):
        bevel(obj,.16 if 'roof' in name.lower() or 'snow' in name.lower() else .12,3)
    elif name.startswith(('Waterfall cliff','Fall lintel','Arcade roof','Arcade rear wall','Spring wall')):
        bevel(obj,.32 if name.startswith('Waterfall cliff') else .19,3)
        if fresh and name.startswith('Waterfall cliff'):
            obj.rotation_euler.z+=.013*math.sin(obj.location.x*1.3+obj.location.z*.6)
    elif name.startswith(('Ruined column','Column footing','Column capital','Terrace masonry','Guardian stepped plinth','Adobe arcade','Ruined gateway')):
        bevel(obj,.09,2)
    elif name.startswith(('Pavilion','Cabana','Lounge','Planter','Garden planter','Oasis planter')):
        for mod in obj.modifiers:
            if mod.type=='BEVEL':mod.width=max(mod.width,min(min(obj.dimensions)*.24,.14))
    if fresh:obj['sculpted_contours']=1
    obj.data.update()
`;
