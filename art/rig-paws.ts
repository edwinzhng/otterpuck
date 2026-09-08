import { blenderExecutable } from "./blender";

const assetDirectory = import.meta.dir;
const code = `
import bpy, bmesh, json, math
from mathutils import Vector
rig = bpy.data.objects['Otter']
body = bpy.data.objects['Body']
rig.rotation_euler = (0, 0, 0)
for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'
    bone.rotation_quaternion = (1, 0, 0, 0)
bpy.context.view_layer.update()
to_rig = rig.matrix_world.inverted() @ body.matrix_world
adjacency = {v.index: [] for v in body.data.vertices}
for edge in body.data.edges:
    a, b = edge.vertices
    adjacency[a].append(b)
    adjacency[b].append(a)
remaining = set(adjacency)
components = []
while remaining:
    pending = [remaining.pop()]
    component = []
    while pending:
        index = pending.pop()
        component.append(index)
        for neighbor in adjacency[index]:
            if neighbor in remaining:
                remaining.remove(neighbor)
                pending.append(neighbor)
    center = sum((to_rig @ body.data.vertices[i].co for i in component), Vector()) / len(component)
    components.append((center, component))
paws = {}
for side, suffix in [(-1, 'L'), (1, 'R')]:
    centers = [Vector((side * .164, .073, -.051))] + [Vector((side * .17 + (j - 1) * .02, .018, -.060)) for j in range(3)]
    matches = [indices for center, indices in components if any((center - expected).length < .002 for expected in centers)]
    assert len(matches) == 4, (suffix, len(matches))
    paws[suffix] = sorted(i for indices in matches for i in indices)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for side, suffix in [(-1, 'L'), (1, 'R')]:
    bone = rig.data.edit_bones.new('paw.' + suffix)
    bone.head = (side * .164, .073, -.051)
    bone.tail = (side * .164, .123, -.051)
    bone.parent = rig.data.edit_bones['spine']
    arm = rig.data.edit_bones.new('arm.' + suffix)
    arm.head = (side * .18, .08, -.18)
    arm.tail = bone.head
    arm.parent = rig.data.edit_bones['spine']
bpy.ops.object.mode_set(mode='OBJECT')
fur = next(m for m in body.data.materials if m.name.startswith('Chestnut fur'))
collection = bpy.data.collections['Otter Player']
for side, suffix in [(-1, 'L'), (1, 'R')]:
    paw_center = Vector((side * .164, .073, -.051))
    hand = bmesh.new()
    bmesh.ops.create_uvsphere(hand, u_segments=16, v_segments=12, radius=.036)
    hand.verts.ensure_lookup_table()
    hand.verts.index_update()
    vertices = [paw_center + vertex.co for vertex in hand.verts]
    faces = [tuple(vertex.index for vertex in face.verts) for face in hand.faces]
    material_indices = [list(body.data.materials).index(fur)] * len(faces)
    hand.free()
    paw_count = len(vertices)
    shoulder = Vector((side * .18, .08, -.18))
    wrist = Vector((side * .164, .073, -.051))
    arm_rotation = Vector((0, 1, 0)).rotation_difference((wrist - shoulder).normalized())
    rings, segments = 7, 12
    for ring in range(rings):
        t = ring / (rings - 1)
        center = shoulder.lerp(wrist, t)
        center += arm_rotation @ Vector((side * .012 * math.sin(t * math.pi), 0, 0))
        radius = max(.002, (.026 - .006 * t) * math.sqrt(min(1, t * 5)))
        for segment in range(segments):
            angle = segment / segments * math.tau
            vertices.append(center + arm_rotation @ Vector((math.cos(angle) * radius, 0, math.sin(angle) * radius)))
    for ring in range(rings - 1):
        for segment in range(segments):
            a = paw_count + ring * segments + segment
            b = paw_count + ring * segments + (segment + 1) % segments
            faces.append((a, b, b + segments, a + segments))
            material_indices.append(list(body.data.materials).index(fur))
    faces.append(tuple(paw_count + index for index in reversed(range(segments))))
    material_indices.append(list(body.data.materials).index(fur))
    mesh = bpy.data.meshes.new('GripPaw' + suffix)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('GripPaw' + suffix, mesh)
    collection.objects.link(obj)
    for material in body.data.materials:
        mesh.materials.append(material)
    for polygon, material_index in zip(mesh.polygons, material_indices):
        polygon.material_index = material_index
        polygon.use_smooth = True
    obj.parent = rig
    modifier = obj.modifiers.new('Paw motion', 'ARMATURE')
    modifier.object = rig
    paw_group = obj.vertex_groups.new(name='paw.' + suffix)
    arm_group = obj.vertex_groups.new(name='arm.' + suffix)
    paw_group.add(list(range(paw_count)), 1, 'REPLACE')
    arm_group.add(list(range(paw_count, len(vertices))), 1, 'REPLACE')
bm = bmesh.new()
bm.from_mesh(body.data)
bm.verts.ensure_lookup_table()
removed = set(paws['L'] + paws['R'])
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in removed], context='VERTS')
bm.to_mesh(body.data)
bm.free()
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=${JSON.stringify(`${assetDirectory}/../public/models/otter-paws.glb`)}, export_format='GLB', use_selection=True, use_active_scene=True, export_animations=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(`${assetDirectory}/otter-paws.blend`)})
print(json.dumps({'paw_vertices': {key: len(value) for key, value in paws.items()}, 'bones': len(rig.data.bones), 'vertices': sum(len(o.data.vertices) for o in collection.objects if o.type == 'MESH')}))
`;

const process = Bun.spawn(
  [
    blenderExecutable,
    "--background",
    `${assetDirectory}/otter.blend`,
    "--threads",
    "2",
    "--python-expr",
    code,
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if ((await process.exited) !== 0) throw new Error("Paw rig export failed");
