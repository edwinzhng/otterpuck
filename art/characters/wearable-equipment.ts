export const organizationPython = `
base_collection=collection.children.get('Animal Base')
if base_collection is None:
    base_collection=bpy.data.collections.new('Animal Base');collection.children.link(base_collection)
equipment_collection=collection.children.get('Equipment')
if equipment_collection is None:
    equipment_collection=bpy.data.collections.new('Equipment');collection.children.link(equipment_collection)
for obj in list(collection.all_objects):
    if obj.type!='MESH':continue
    part=obj.get('asset_part',obj.name)
    equipment=part.startswith(('ProtectiveCap','Cap','Mask','Snorkel','Fin')) or (part.startswith('GripPaw') and part.endswith(('Cuff','Mitten')))
    target=equipment_collection if equipment else base_collection
    obj['asset_role']='equipment' if equipment else 'animal-base'
    if obj.name not in target.objects:target.objects.link(obj)
    for owner in list(obj.users_collection):
        if owner!=target:owner.objects.unlink(obj)
`;

// Uses the shared geometry and rig helpers; animal surfaces and materials are explicit inputs.
export const wearableEquipmentPython = `
def create_cap(face_surface, number, cap_mat, seam, white, head_width_scale=1):
    def cap_surface(u,t):
        limit=.89+.88*((1-math.cos(u))/2)
        v=t*limit
        p=Vector(face_surface(u,v))
        direction=(p-Vector((0,.302,.018))).normalized()
        return p+direction*.006
    cap_vertices=[cap_surface(j/48*math.tau,i/14) for i in range(15) for j in range(48)]
    cap_faces=[(i*48+j,i*48+(j+1)%48,(i+1)*48+(j+1)%48,(i+1)*48+j) for i in range(14) for j in range(48)]
    cap=mesh('ProtectiveCap',cap_vertices,cap_faces,cap_mat)
    bm=bmesh.new();bm.from_mesh(cap.data)
    for x in [-.037,.037]:
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(x,0,0),plane_no=(1,0,0))
    bm.to_mesh(cap.data);bm.free();rigid(cap,'head')
    cap.data.materials.append(seam)
    for polygon in cap.data.polygons:
        x=sum(cap.data.vertices[i].co.x for i in polygon.vertices)/len(polygon.vertices)
        polygon.material_index=1 if abs(x)<.037 else 0
    cap_hem=sweep('CapHem',[cap_surface(j/72*math.tau,1) for j in range(72)],.0025,cap_mat,6,True);rigid(cap_hem,'head')
    def cap_panel_point(x,theta):
        cross=math.sqrt(1-(x/.151)**2)
        p=Vector((x,.302+math.cos(theta)*.122*cross,.018+math.sin(theta)*(.116 if math.sin(theta)>0 else .088)*cross))
        direction=(p-Vector((0,.302,.018))).normalized()
        return p+direction*.007
    for x in [-.037,.037]:
        path=[cap_panel_point(x,.73+i/48*2.53) for i in range(49)]
        stripe=sweep('CapPanelLine',path,.0014,seam,6);rigid(stripe,'head')
    for side,suffix in [(-1,'L'),(1,'R')]:
        oval('CapEarGuard'+suffix,(side*.153*head_width_scale,.302,.040),(.023,.032,.030),cap_mat,'head',24,16)
    def cap_print(center,normal,up,size):
        normal=Vector(normal).normalized();up=Vector(up).normalized();right=up.cross(normal).normalized()
        rotation=Matrix((right,up,normal)).transposed().to_euler()
        label=cap_number(number,center,rotation,size,white,'head')
        for vertex in label.data.vertices:
            delta=vertex.co-Vector((0,.302,.018))
            radial=math.sqrt((delta.x/.151)**2+(delta.y/.122)**2+(delta.z/(.116 if delta.z>0 else .088))**2)
            vertex.co=Vector((0,.302,.018))+delta/radial+delta.normalized()*.012
    for side in [-1,1]:
        cap_print((side*.130,.302,.082),(side*.86,0,.51),(-side*.51,0,.86),.050)
    

def create_mask(face_front, face_surface, rubber, lens, width_scale=1):
    outline=[(-.113,.032),(-.100,.067),(-.058,.081),(0,.085),(.058,.081),(.100,.067),(.113,.032),(.093,.002),(.060,.000),(.032,.011),(0,.022),(-.032,.011),(-.060,.000),(-.093,.002)]
    outline=[(x*1.08*width_scale,.044+(z-.044)*.86) for x,z in outline]
    outline3=[Vector((x,face_front(x,z)+.010,z)) for x,z in outline]
    rim_path=catmull(outline3,5,True)
    rim=sweep('MaskFrame',rim_path,.008,rubber,10,True);rigid(rim,'head')
    glass_vertices=[(0,face_front(0,.030)+.019,.030)]
    for ring in range(1,7):
        for edge in rim_path:
            x=edge.x*ring/6;z=.030+(edge.z-.030)*ring/6
            glass_vertices.append((x,face_front(x,z)+.019-.008*(ring/6)**4,z))
    glass_count=len(rim_path)
    glass_faces=[(0,1+i,1+(i+1)%glass_count) for i in range(glass_count)]
    for ring in range(5):
        for i in range(glass_count):
            a=1+ring*glass_count+i;b=1+ring*glass_count+(i+1)%glass_count
            glass_faces.append((a,b,b+glass_count,a+glass_count))
    glass=mesh('MaskLens',glass_vertices,glass_faces,lens);rigid(glass,'head')
    strap_vertices=[]
    for i in range(65):
        u=.88+(math.tau-1.76)*i/64
        for z,offset in [(.027,.007),(.045,.007),(.045,.012),(.027,.012)]:
            v=math.acos((z-.018)/.116)
            p=Vector(face_surface(u,v))
            p+=Vector((math.sin(u),math.cos(u),0))*offset
            strap_vertices.append(p)
    strap_faces=[(i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j) for i in range(64) for j in range(4)]
    strap_faces.extend([(3,2,1,0),(256,257,258,259)])
    strap=mesh('MaskStrap',strap_vertices,strap_faces,rubber);rigid(strap,'head')
    bevel=strap.modifiers.new('Rounded strap edges','BEVEL');bevel.width=.002;bevel.segments=2

def create_snorkel(face_front, rubber, seam, mouth_corner, radius=.014, top=.162):
    snorkel_path=catmull([(mouth_corner,face_front(mouth_corner,-.043)+.012,-.043),(-.135,.408,-.035),(-.168,.365,0),(-.181,.330,.060),(-.183,.309,top-.032),(-.185,.302,top)],6)
    snorkel=sweep('Snorkel',snorkel_path,lambda t:.006+(radius-.006)*smooth(0,.30,t),rubber,12);rigid(snorkel,'head')
    snorkel_tip=sweep('SnorkelTip',[Vector((-.184,.306,top-.019)),Vector((-.185,.302,top+.004))],radius+.001,seam,12);rigid(snorkel_tip,'head')

def create_mitten(side, suffix, mitt):
    # Compensate the shared body proportions so the exported glove stays spherical.
    protected=uv_surface('GripPaw'+suffix+'Mitten',lambda u,v:(side*.164+.040/.80*math.sin(u)*math.sin(v),.246+.040/.76*math.cos(v),-.095+.040/.74*math.cos(u)*math.sin(v)),mitt,24,18);rigid(protected,'paw.'+suffix)

def create_cuff(side, suffix, team):
    cuff_path=catmull([(side*.171,.198,-.079),(side*.169,.208,-.084),(side*.167,.219,-.089)],3)
    cuff=sweep('GripPaw'+suffix+'Cuff',cuff_path,lambda t:.046-.002*t,team,24,False,.98)
    skin(cuff,lambda p:chain(p.y,[(.17,'forearm.'+suffix),(.238,'paw.'+suffix)]))

def create_fin(side, suffix, team, seam):
    outline_fin=catmull([(-.035,-.321,0),(-.044,-.36,0),(-.077,-.506,0),(-.061,-.545,0),(-.021,-.550,0),(0,-.545,0),(.021,-.550,0),(.061,-.545,0),(.077,-.506,0),(.044,-.36,0),(.035,-.321,0)],4,True)
    verts=[]
    for z in [-.004,.007]:
        for p in outline_fin:verts.append((side*.105+p.x*.83,p.y,z+.010*math.sin(-(p.y+.321)/.23*math.pi)))
    n=len(outline_fin);faces=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    fin=mesh('FinBlade'+suffix,verts,faces,team)
    bevel=fin.modifiers.new('Soft blade edge','BEVEL');bevel.width=.0025;bevel.segments=2
    skin(fin,lambda p:chain(-p.y,[(.375,'foot.'+suffix),(.492,'finTip.'+suffix)]))
    oval('FinPocket'+suffix,(side*.105,-.348,.009),(.039,.052,.028),team,'foot.'+suffix,24,14)
    for x in [-.032,.032]:
        rib=sweep('FinRib'+suffix,catmull([(side*.105+x,-.374,.014),(side*.105+x*1.25,-.452,.019),(side*.105+x*1.45,-.518,.010)],6),.002,seam,6);skin(rib,lambda p:chain(-p.y,[(.375,'foot.'+suffix),(.492,'finTip.'+suffix)]))
`;
