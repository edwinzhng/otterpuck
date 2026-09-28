import { join } from "node:path";
import { ARENA_IDS } from "../../src/arena-catalog";
import { blenderExecutable } from "../blender";

for (const arena of ARENA_IDS.filter(
  (id) =>
    !Bun.argv.some((arg) => arg.startsWith("--arena=")) ||
    Bun.argv.includes(`--arena=${id}`),
)) {
  const source = join(import.meta.dir, `${arena}.blend`);
  const code = `
import bpy, bmesh, math, re
scene=next(s for s in bpy.data.scenes if s.name.startswith('OTTERPUCK'))
bpy.context.window.scene=scene
if not scene.get('painted_finish'):
    softened=0
    for obj in scene.objects:
        if obj.type!='MESH' or not obj.data.materials:continue
        names=' '.join(m.name for m in obj.data.materials)
        if re.search(r'Pool |Goal |Waterfall|waterfall|Distant ocean',names):continue
        foliage=bool(re.search(r'needles|Canopy .*green|Palm green|Sunlit foliage',names))
        rock=bool(re.search(r'granite|sandstone|Glacier blue|Ice edge|Rock moss',names,re.I))
        if foliage or rock:
            obj.data=obj.data.copy()
            bm=bmesh.new();bm.from_mesh(obj.data)
            for iteration in range(2):
                bmesh.ops.smooth_vert(bm,verts=list(bm.verts),factor=.12 if foliage else .08,use_axis_x=True,use_axis_y=True,use_axis_z=True)
            bm.to_mesh(obj.data);bm.free()
            for polygon in obj.data.polygons:polygon.use_smooth=True
            if foliage:obj['wind_weight']=.035
            softened+=1
        for modifier in obj.modifiers:
            if modifier.type=='BEVEL' and modifier.width<.12:modifier.width=min(.12,modifier.width*1.25)
        obj.data.update()
    scene['painted_finish']=1
    scene['finish_provenance']='Otterpuck authored contour refinements; project MIT license'
    print('Softened '+str(softened)+' scenery pieces')
for obj in scene.objects:
    if obj.name.startswith('Canopy leaf spray') and not obj.modifiers.get('Rounded leaf contour'):
        modifier=obj.modifiers.new('Rounded leaf contour','SUBSURF')
        modifier.levels=1
        modifier.render_levels=1
    if obj.name.startswith(('Soft branch snow pillow','Low shrub snow')):
        obj['wind_weight']=.035
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(source)})
`;
  const task = Bun.spawn(
    [
      blenderExecutable,
      "--background",
      "--threads",
      "2",
      "--python-exit-code",
      "1",
      source,
      "--python-expr",
      code,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if ((await task.exited) !== 0) throw new Error(`${arena} refinement failed`);
}
