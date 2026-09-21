export const paintPython = `
from mathutils import noise
bpy.context.view_layer.update()
painted_materials={}
def mix_color(a,b,t):return tuple(a[i]*(1-t)+b[i]*t for i in range(3))
for obj in list(scene.objects):
    if obj.type!='MESH' or not obj.data.materials:continue
    names=[m.name for m in obj.data.materials]
    if any(n.startswith('Pool ') or n in ['Trough steel','Cyan ribbon','Rose ribbon','Warm lamp'] for n in names):continue
    attr=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    obj.data.color_attributes.active_color=attr
    normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
    for polygon in obj.data.polygons:
        source=obj.data.materials[polygon.material_index]
        for loop_index in polygon.loop_indices:
            vertex=obj.data.vertices[obj.data.loops[loop_index].vertex_index]
            p=obj.matrix_world @ vertex.co
            n=(normal_matrix @ vertex.normal).normalized()
            broad=noise.noise(p*.62);fine=noise.noise(p*2.8)
            if 'SculptedIslandPeak' in obj.name or 'IslandShoreBoulder' in obj.name:
                broad=noise.noise(p*.13);fine=noise.noise(p*.3)
            rgb=tuple(source.diffuse_color[:3]);wash=.94+broad*.12+fine*.035
            if 'SculptedIslandPeak' in obj.name or 'IslandShoreBoulder' in obj.name:
                moss=max(0,min(1,(12+broad*2-p.z)/6))
                moss=max(moss,max(0,min(.75,(n.z-.65)*2))*(1-max(0,min(1,(p.z-13)/5))))
                sun=max(0,min(1,.5-n.x*.8-n.y*.25))
                dry=mix_color((.08,.24,.44),(.98,.55,.23),sun)
                lush=mix_color((.045,.26,.14),(.32,.56,.055),sun)
                rgb=mix_color(dry,lush,moss)
                if 'SculptedIslandPeak' in obj.name:
                    shadow=max(0,min(1,(p.x+3)/8))
                    dry=mix_color(mix_color((.76,.34,.12),(.98,.53,.23),sun),(.065,.18,.39),shadow*.92)
                    patches=noise.noise(Vector((p.x*.19,p.y*.16,2.6)))
                    moss=max(0,min(1,(10.8+patches*4.2-p.z)/5.0))
                    moss=max(moss,max(0,min(.65,(n.z-.56)*2.4))*(1-max(0,min(1,(p.z-11)/7))))
                    lush=mix_color((.035,.22,.14),(.27,.48,.075),sun)
                    lush=mix_color(lush,(.025,.19,.11),max(0,min(.5,(patches-.12)*1.8)))
                    rgb=mix_color(dry,lush,moss)
                if p.z<1.65:rgb=mix_color(rgb,(.70,.66,.43),.68)
                wash=.98+broad*.045+fine*.015
            elif source.name in ['Palm green','Sunlit foliage']:
                rgb=mix_color(tuple(source.diffuse_color[:3]),(.32,.53,.14),max(0,n.z)*.24)
                wash+=.045*math.sin(p.x*4+p.y*3)
            elif source.name=='Palm bark':wash+=.045*math.sin(p.z*17+broad)
            elif source.name.startswith('City facade') or source.name=='City glazing':
                height=max(0,min(1,(p.z+12)/52))
                rgb=mix_color(rgb,tuple(min(1,c*1.45) for c in rgb),height*.65)
                wash+=n.x*.065+n.y*.045
            attr.data[loop_index].color=tuple(max(0,min(1,c*wash)) for c in rgb)+(1,)
    for index,source in enumerate(list(obj.data.materials)):
        if source.name not in painted_materials:
            name=source.name
            painted=source.copy();painted.name=name+' painted';painted['arena_original']=name
            vertex_color=painted.node_tree.nodes.new('ShaderNodeVertexColor');vertex_color.layer_name='Color'
            painted.node_tree.links.new(vertex_color.outputs['Color'],painted.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
            painted_materials[name]=painted
        obj.data.materials[index]=painted_materials[source.name]
`;
