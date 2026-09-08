export const continuousPython = `
fur_points=[]
for side,suffix in [(-1,'L'),(1,'R')]:
    fur_points.extend([
        ('tuft.'+suffix,'head',Vector((side*.106,.204,-.025)),Vector((side*.126,.180,-.022)),.026),
        ('shoulderFur.'+suffix,'spineMid',Vector((side*.075,.006,.054)),Vector((side*.087,-.039,.059)),.024),
        ('hipFur.'+suffix,'pelvis',Vector((side*.063,-.109,.051)),Vector((side*.073,-.154,.047)),.022)
    ])
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name,parent,base,tip,radius in fur_points:
    b=armature.edit_bones.get(name) or armature.edit_bones.new(name)
    b.head=base;b.tail=tip;b.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
surfaces=[o for o in collection.objects if o.type=='MESH' and (o.get('asset_part') in ['Body','Head','Muzzle','Tail','HindLegL','HindLegR','GripPawLArm','GripPawRArm','GripPawL','GripPawR','GripPawLWrist','GripPawRWrist'] or o.name.startswith('SilhouetteFur'))]
source_vertices=[];source_triangles=[];source_weights=[];source_colors=[]
for obj in surfaces:
    offset=len(source_vertices)
    obj.data.calc_loop_triangles()
    source_vertices.extend([v.co.copy() for v in obj.data.vertices])
    source_triangles.extend([tuple(offset+i for i in tri.vertices) for tri in obj.data.loop_triangles])
    source_weights.extend([{obj.vertex_groups[g.group].name:g.weight for g in v.groups} for v in obj.data.vertices])
    attribute=obj.data.color_attributes.get('Coat')
    source_colors.extend([tuple(attribute.data[v.index].color[:3]) if attribute else fur_rgb for v in obj.data.vertices])
for obj in surfaces:
    obj.modifiers.clear();obj.vertex_groups.clear()
    obj.data.materials.clear();obj.data.materials.append(coat)
bpy.ops.object.select_all(action='DESELECT')
for obj in surfaces:obj.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.object.join()
body=bpy.context.object;body.name='ContinuousCharacter'
body['asset_part']='ContinuousCharacter'
body.data.remesh_voxel_size=.0053
body.data.use_remesh_preserve_volume=True
bpy.ops.object.voxel_remesh()
relax=body.modifiers.new('Smooth joint transitions','SMOOTH');relax.factor=.62;relax.iterations=3
bpy.ops.object.modifier_apply(modifier=relax.name)
shoulder_blend=body.vertex_groups.new(name='ShoulderTransition')
for vertex in body.data.vertices:
    p=vertex.co
    weight=smooth(.040,.065,abs(p.x))*(1-smooth(.028,.065,abs(p.y-.075)))
    if weight>0:shoulder_blend.add([vertex.index],weight,'REPLACE')
relax=body.modifiers.new('Continuous rounded shoulders','SMOOTH');relax.factor=.48;relax.iterations=4;relax.vertex_group=shoulder_blend.name
bpy.ops.object.modifier_apply(modifier=relax.name)
haunch_blend=body.vertex_groups.new(name='HaunchTransition')
for vertex in body.data.vertices:
    p=vertex.co
    weight=smooth(.035,.065,abs(p.x))*(1-smooth(.026,.066,abs(p.y+.148)))
    if weight>0:haunch_blend.add([vertex.index],weight,'REPLACE')
relax=body.modifiers.new('Rounded haunch transitions','SMOOTH');relax.factor=.52;relax.iterations=5;relax.vertex_group=haunch_blend.name
bpy.ops.object.modifier_apply(modifier=relax.name)
muzzle_blend=body.vertex_groups.new(name='MuzzleRootBlend')
for vertex in body.data.vertices:
    p=vertex.co;weight=(1-smooth(.045,.072,abs(p.x)))*(1-smooth(.030,.060,abs(p.z+.009)))*(1-smooth(.037,.063,abs(p.y-.335)))
    if weight>0:muzzle_blend.add([vertex.index],weight,'REPLACE')
relax=body.modifiers.new('Sculpted muzzle transition','SMOOTH');relax.factor=.7;relax.iterations=7;relax.vertex_group=muzzle_blend.name
bpy.ops.object.modifier_apply(modifier=relax.name)
reduce=body.modifiers.new('Game surface density','DECIMATE');reduce.ratio=.72
bpy.ops.object.modifier_apply(modifier=reduce.name)
for poly in body.data.polygons:poly.use_smooth=True
for layer in list(body.data.color_attributes):body.data.color_attributes.remove(layer)


from mathutils.bvhtree import BVHTree
source_tree=BVHTree.FromPolygons(source_vertices,source_triangles,all_triangles=True)
transferred=[];transferred_colors=[]
for vertex in body.data.vertices:
    point,normal,triangle_index,distance=source_tree.find_nearest(vertex.co)
    indices=source_triangles[triangle_index]
    a,b,c=[source_vertices[i] for i in indices]
    ab=b-a;ac=c-a;ap=point-a
    d00=ab.dot(ab);d01=ab.dot(ac);d11=ac.dot(ac);d20=ap.dot(ab);d21=ap.dot(ac)
    denominator=d00*d11-d01*d01
    v=(d11*d20-d01*d21)/denominator if abs(denominator)>1e-15 else 0
    w=(d00*d21-d01*d20)/denominator if abs(denominator)>1e-15 else 0
    factors=[max(0,1-v-w),max(0,v),max(0,w)]
    total=sum(factors);factors=[f/total for f in factors]
    weights={};rgb=[0,0,0]
    for i,factor in zip(indices,factors):
        for name,value in source_weights[i].items():weights[name]=weights.get(name,0)+value*factor
        for channel in range(3):rgb[channel]+=source_colors[i][channel]*factor
    for name,parent,base,tip,radius in fur_points:
        if name.startswith('tuft.'):continue
        influence=(1-smooth(radius*.5,radius*1.7,(vertex.co-base).length))*.38
        if influence>0:
            weights={key:value*(1-influence) for key,value in weights.items()};weights[name]=influence
    if beaver and sum(value for name,value in weights.items() if name.startswith('tail'))>.8:
        p=vertex.co
        rgb=tail_color(Vector((p.x/.88,(p.y+.1634)/.88-.215,p.z/.88)))
    transferred.append(weights);transferred_colors.append(rgb)
neighbors=[set() for v in body.data.vertices]
for edge in body.data.edges:
    a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
for iteration in range(8):
    smoothed=[]
    for i,weights in enumerate(transferred):
        if iteration>=3 and not any(name.startswith(('shoulder.','arm.','forearm.','thigh.','shin.','foot.')) for name in weights):
            smoothed.append(weights);continue
        blended={name:value*.65 for name,value in weights.items()}
        for j in neighbors[i]:
            for name,value in transferred[j].items():blended[name]=blended.get(name,0)+value*.35/max(1,len(neighbors[i]))
        smoothed.append(blended)
    transferred=smoothed
body.vertex_groups.clear()
for index,weights in enumerate(transferred):
    p=body.data.vertices[index].co
    shoulder_region=smooth(.010,.040,p.y)*(1-smooth(.165,.195,p.y))*(1-smooth(.060,.090,p.z))
    if shoulder_region>0:
        suffix='L' if p.x<0 else 'R'
        shoulder_mix=smooth(.045,.075,abs(p.x))*smooth(.018,.078,p.y)
        arm_mix=smooth(.068,.126,abs(p.x))
        elbow_mix=smooth(.105,.150,p.y)
        target={name:value*(1-shoulder_mix) for name,value in chain(p.y,[(-.152,'pelvis'),(-.0684,'spine'),(.0114,'spineMid'),(.0874,'chest'),(.152,'neck')])}
        target['shoulder.'+suffix]=shoulder_mix*(1-arm_mix)
        target['arm.'+suffix]=shoulder_mix*arm_mix*(1-elbow_mix)
        target['forearm.'+suffix]=shoulder_mix*arm_mix*elbow_mix
        head_distance=(p.x/.130)**2+((p.y-.222)/.129)**2+((p.z-.019)/.112)**2
        head_mix=smooth(.095,.165,p.y)*smooth(-.090,-.010,p.z)*(1-smooth(.86,1.35,head_distance))
        target={name:value*(1-head_mix) for name,value in target.items()}
        target['head']=head_mix
        blended={name:value*(1-shoulder_region) for name,value in weights.items()}
        for name,value in target.items():blended[name]=blended.get(name,0)+value*shoulder_region
        weights=blended
        chest_marking=shoulder_region*(1-smooth(.095,.135,abs(p.x)))*(1-smooth(.105,.135,p.y))
        torso_color=belly_color(Vector((p.x/.80,p.y/.76,p.z/.74)))
        transferred_colors[index]=blend(transferred_colors[index],torso_color,chest_marking)
    strongest=sorted(weights.items(),key=lambda item:item[1],reverse=True)[:4]
    total=sum(value for name,value in strongest)
    for name,value in strongest:
        if value<.00001:continue
        group=body.vertex_groups.get(name) or body.vertex_groups.new(name=name)
        group.add([index],value/total,'REPLACE')
attribute=body.data.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
for index,rgb in enumerate(transferred_colors):attribute.data[index].color=(*rgb,1)
modifier=body.modifiers.new('Continuous deforming skin','ARMATURE');modifier.object=rig
body['surface']='Connected torso, head, shoulders, legs, hips, tail and silhouette tufts'
body['fur_amplitude_m']=.0015
`;
