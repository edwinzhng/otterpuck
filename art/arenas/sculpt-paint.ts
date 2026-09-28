export const sculptPaint = `
def blend(a,b,t):return tuple(a[i]*(1-t)+b[i]*t for i in range(3))
bpy.context.view_layer.update()
for obj in scene.objects:
    if obj.type!='MESH' or not obj.data.materials:continue
    names=[m.get('arena_original',m.name) for m in obj.data.materials]
    if any(re.match(r'Pool |Goal |Trough |Distant ocean|Waterfall|Mountain waterfall',n) for n in names):continue
    if obj.name.startswith(('SculptedIslandPeak','Coping','Deck','Drain','Timber deck plank','Stone path')):continue
    attr=obj.data.color_attributes.get('Color')
    if not attr and obj.get('painted_terrain'):
        attr=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    if not attr:continue
    obj.data.color_attributes.active_color=attr
    normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
    low,high=bounds(obj)
    for polygon in obj.data.polygons:
        material=obj.data.materials[polygon.material_index];name=material.get('arena_original',material.name)
        for index in polygon.loop_indices:
            vertex=obj.data.vertices[obj.data.loops[index].vertex_index]
            p=obj.matrix_world @ vertex.co;n=(normal_matrix @ vertex.normal).normalized()
            wash=noise.noise(Vector((p.x*.24,p.y*.24,p.z*.45)))
            broad=noise.noise(p*.075)
            rgb=tuple(material.diffuse_color[:3])
            if obj.name.startswith('Sculpted alpine peak'):
                elevation=max(0,(p.z-1.5)/max(.1,high.z-1.5))
                ridge=.5+.5*math.sin(p.x*.17+p.y*.07+wash*.7)
                rgb=blend((.20,.28,.43),(.52,.49,.48),max(0,min(1,.36-n.x*.24+n.z*.19+ridge*.18)))
                if arena=='alpine':
                    snow=max(0,min(1,(elevation-.42+broad*.17)*5))
                    rgb=blend(rgb,(.83,.89,.97),snow)
                else:
                    moss=max(0,min(1,(.68-elevation+broad*.12)*2))
                    rgb=blend(rgb,(.21,.34,.24),moss*.75)
            elif obj.name.startswith('Layered mesa'):
                elevation=max(0,p.z/max(.1,high.z))
                strata=.5+.5*math.sin(elevation*15+wash*.65+p.x*.025)
                rgb=blend((.57,.25,.32),(.94,.58,.31),strata)
                rgb=blend(rgb,(1.,.73,.44),max(0,n.z)*.28)
            elif obj.name.startswith('GlacierRidge'):
                elevation=(p.z-low.z)/max(.1,high.z-low.z)
                rgb=blend((.18,.42,.65),(.45,.69,.84),max(0,min(1,.4+n.z*.38+wash*.16)))
                rgb=blend(rgb,(.82,.90,.97),max(0,min(1,(elevation-.70+wash*.09)*4.5)))
            elif obj.get('painted_terrain'):
                if arena=='forest':rgb=blend((.12,.24,.16),(.30,.41,.21),.55+broad*.3)
                elif arena=='ruins':rgb=blend((.13,.23,.18),(.29,.36,.22),.55+broad*.25)
                elif arena=='desert':rgb=blend((.65,.40,.30),(.86,.65,.40),.6+broad*.25)
                else:rgb=blend((.63,.74,.89),(.86,.91,.98),.65+broad*.22)
            elif name.startswith('City facade'):
                rgb=blend((.10,.12,.29),(.24,.29,.53),max(0,min(1,(p.z+24)/65)))
            elif re.search(r'pine needles|Canopy .*green|Palm green|Sunlit foliage',name):
                rgb=blend(rgb,(.25,.43,.16),max(0,n.z)*.24)
            elif re.search(r'Container|Station blue|Crane blue|Structural navy',name):
                rgb=blend(rgb,(.33,.38,.48),.07)
            tint=blend((.83,.88,1.),(1.04,1.01,.92),max(0,min(1,.55+n.z*.32-n.x*.10)))
            attr.data[index].color=tuple(max(0,min(1,rgb[i]*tint[i]*(.99+wash*.045))) for i in range(3))+(1,)
`;
