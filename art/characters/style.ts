import { characterRampStops } from "../../src/character-look";

export const stylePython = `
def cartoon_y(y):
    return y*.76 if y>=-.325 else -.247+(y+.325)*.80

def cartoon_position(p,head=False,tail=False):
    if head:return Vector((p.x*.83,.222+(p.y-.302)*1.04,.019+(p.z-.018)*1.06))
    if tail:return Vector((p.x*.88,-.1634+(p.y+.215)*(.88 if beaver else .75),p.z*.88))
    return Vector((p.x*.80,cartoon_y(p.y),p.z*.74))

for obj in collection.objects:
    if obj.type!='MESH':continue
    groups={g.name for g in obj.vertex_groups}
    head_part=groups=={'head'}
    for vertex in obj.data.vertices:vertex.co=cartoon_position(vertex.co,head_part,obj.get('asset_part')=='Tail')
    obj.data.update()
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for b in armature.edit_bones:
    if b.name=='head':
        b.head=Vector((0,.1672,.014));b.tail=Vector((0,.344,.014))
    elif b.name.startswith('tuft'):
        b.head=cartoon_position(b.head,True);b.tail=cartoon_position(b.tail,True)
    else:
        b.head=cartoon_position(b.head,False,b.name.startswith('tail'))
        b.tail=cartoon_position(b.tail,False,b.name.startswith('tail'))
    if b.name.startswith('tail'):b.align_roll(Vector((0,0,-1)))
bpy.ops.object.mode_set(mode='OBJECT')
rig['asset_revision']='reference-04'
rig['material_style']='Soft toon, broad color regions, restrained highlights'

def soft_toon(material):
    if material.name.split('.')[0] in ['Lens','Eyes','Pupils','Nose']:return
    material['otterpuck_shading']='soft-toon'
    material['otterpuck_palette']='soft-color-ramp-1'
    nodes=material.node_tree.nodes;links=material.node_tree.links
    standard=nodes['Principled BSDF'];standard.inputs['Roughness'].default_value=.85
    geometry=nodes.new('ShaderNodeNewGeometry')
    direction=nodes.new('ShaderNodeVectorMath');direction.operation='DOT_PRODUCT'
    direction.inputs[1].default_value=Vector((-.45,.60,.85)).normalized()
    links.new(geometry.outputs['Normal'],direction.inputs[0])
    remap=nodes.new('ShaderNodeMapRange');remap.inputs['From Min'].default_value=-1;remap.inputs['From Max'].default_value=1
    links.new(direction.outputs['Value'],remap.inputs['Value'])
    ramp=nodes.new('ShaderNodeValToRGB');ramp.name='Shared Otterpuck shading palette';ramp.color_ramp.interpolation='EASE'
    stops=${JSON.stringify(characterRampStops)}
    for element in list(ramp.color_ramp.elements)[1:]:ramp.color_ramp.elements.remove(element)
    for index,stop in enumerate(stops):
        element=ramp.color_ramp.elements[0] if index==0 else ramp.color_ramp.elements.new(stop['position'])
        element.position=stop['position'];element.color=tuple(.9*c+.095 for c in stop['color'])+(1,)
    links.new(remap.outputs['Result'],ramp.inputs['Fac'])
    multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
    links.new(ramp.outputs['Color'],multiply.inputs[2])
    if standard.inputs['Base Color'].is_linked:
        links.new(standard.inputs['Base Color'].links[0].from_socket,multiply.inputs[1])
    else:multiply.inputs[1].default_value=standard.inputs['Base Color'].default_value
    emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=1
    links.new(multiply.outputs['Color'],emission.inputs['Color']);links.new(emission.outputs[0],nodes['Material Output'].inputs['Surface'])

for material in list(bpy.data.materials):
    if material.users:soft_toon(material)
`;
