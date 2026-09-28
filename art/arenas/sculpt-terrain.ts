export const terrainHeight = `
def terrain_height(x,y,base):
    distance=max(abs(x)/42,abs(y)/65)
    blend=min(1,max(0,(distance-1)/1.2));blend=blend*blend*(3-2*blend)
    outer=max(0,math.hypot(x,y*.85)-48)
    falloff=outer*outer/(outer+40)*.74
    return base+blend*(1.8+1.2*math.sin(x*.032+y*.015)+.8*math.cos(y*.039-x*.013))-falloff
`;

export const sculptTerrain = `
terrain_names={
    'alpine':('Continuous wooded ground','Continuous rear mountain ground','Distant wooded ground'),
    'forest':('Continuous wooded ground','Continuous rear mountain ground','Distant wooded ground'),
    'ruins':('Jungle ground side','Jungle ground near','Jungle ground far'),
    'desert':('Desert shelf side','Desert shelf near','Desert shelf far'),
    'glacier':('SnowShelfSide','SnowShelfEnd'),
}
if arena in terrain_names:
    sources=[o for o in scene.objects if o.type=='MESH' and (o.name.startswith(terrain_names[arena]) or o.get('painted_terrain'))]
    if sources:
        mat=sources[0].data.materials[0]
        base={'alpine':2.44,'forest':2.44,'ruins':2.16,'desert':.8,'glacier':2.225}[arena]
        half_x=8.5 if arena in ['ruins','desert'] else 13
        half_y=13.5 if arena in ['ruins','desert'] else 17.5
        coordinates=[-220,-160,-115,-95,-80,-65,-55,-42,-32,-24,-19,0,19,24,32,42,55,65,80,95,115,160,220]
        xs=sorted(set(coordinates+[-half_x,half_x,-9,-4,4,9]))
        ys=sorted(set(coordinates+[-half_y,half_y,-9,-4,4,9]))
        vertices=[];faces=[]
        for y in ys:
            for x in xs:
                vertices.append((x,y,terrain_height(x,y,base)))
        for row in range(len(ys)-1):
            for col in range(len(xs)-1):
                if abs((xs[col]+xs[col+1])*.5)<half_x and abs((ys[row]+ys[row+1])*.5)<half_y:continue
                n=row*len(xs)+col;faces.append((n,n+1,n+len(xs)+1,n+len(xs)))
        data=bpy.data.meshes.new('Continuous sculpted terrain');data.from_pydata(vertices,[],faces);data.update()
        data.materials.append(mat)
        obj=bpy.data.objects.new('Painted rolling terrain',data);scene.collection.objects.link(obj)
        obj['painted_terrain']=True
        for p in data.polygons:p.use_smooth=True
        for source in sources:
            old=source.data;bpy.data.objects.remove(source,do_unlink=True)
            if old.users==0:bpy.data.meshes.remove(old)
        obj.name='Painted rolling terrain';data.name='Continuous sculpted terrain'
`;
