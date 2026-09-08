export const sceneryPython = `
def light_material(name,rgb,strength):
    m=material(name,rgb);shader=m.node_tree.nodes['Principled BSDF']
    shader.inputs['Emission Color'].default_value=(*rgb,1);shader.inputs['Emission Strength'].default_value=strength
    m['arena_surface']='emissive';return m
cyan=light_material('Cyan ribbon',(.06,.66,.82),.9)
pink=light_material('Rose ribbon',(.55,.065,.25),.7)
warm=light_material('Warm lamp',(.95,.47,.18),.75)
frame=material('Terrace metal',(.10,.20,.24) if not city else (.035,.065,.13),.65,.12)
planter_mat=material('Planter ceramic',(.72,.43,.27) if not city else (.14,.21,.31))
cushion=material('Aqua cushions',(.14,.55,.59) if not city else (.22,.21,.40))
marking=material('Pool marking',(.78,.94,.94))
def ring(name,center,radius,start,end):
    count=max(24,round(abs(end-start)*radius*10));verts=[]
    for i in range(count+1):
        a=start+(end-start)*i/count
        for r in [radius-.013,radius+.013]:verts.append((center[0]+math.sin(a)*r,center[1]+math.cos(a)*r,.007))
    return mesh(name,verts,[(i*2+2,i*2+3,i*2+1,i*2) for i in range(count)],marking)
ring('CentreCircle',(0,0),1.35,0,math.tau)
mesh('FaceoffDot',[(0,0,.008)]+[(.07*math.sin(i/24*math.tau),.07*math.cos(i/24*math.tau),.008) for i in range(24)],[(0,(i+1)%24+1,i+1) for i in range(24)],marking)
for side in [-1,1]:
    for radius in [3,5]:ring('GoalSemicircle'+str(radius),(0,side*12.5),radius,math.pi/2 if side>0 else -math.pi/2,math.pi*1.5 if side>0 else math.pi/2)
    for y in [-10,-5,0,5,10]:box('DrainCover',(side*8.0,y,2.447),(.15,1.1,.012),frame,.005)
    for y in [-11,0,11]:
        box('PathLamp',(side*12.2,y,2.76),(.18,.18,.58),frame,.035)
        box('PathLampLens',(side*12.2,y,3.055),(.19,.19,.045),warm if city else white,.02)
    for y in [-8.8,-5.8,7.3,10.3]:
        base=Vector((side*10.25,y,0));parts=[]
        parts.append(box('LoungeFrame',base+Vector((0,0,2.74)),(.78,1.95,.14),wood,.05))
        parts.append(box('LoungeCushion',base+Vector((0,-.15,2.85)),(.70,1.42,.14),white,.055))
        back=box('LoungeBack',base+Vector((0,.63,3.06)),(.70,.76,.14),cushion,.055);back.rotation_euler.x=.50;parts.append(back)
        for x in [-.26,.26]:
            for foot_y in [-.65,.65]:parts.append(box('LoungeLeg',base+Vector((x,foot_y,2.58)),(.10,.12,.27),frame,.02))
        angle=side*math.pi/2
        for obj in parts:
            p=obj.location-base;obj.location=base+Vector((p.x*math.cos(angle)-p.y*math.sin(angle),p.x*math.sin(angle)+p.y*math.cos(angle),p.z));obj.rotation_euler.z+=angle
    for y in [-7.3,8.8]:
        box('SideTable',(side*11.25,y,2.85),(.55,.55,.10),white,.055)
        box('TableStem',(side*11.25,y,2.65),(.12,.12,.40),frame,.025)
for x,y in [(-11.4,-1.8),(11.5,-.8),(-10.7,16),(10.7,16),(-10.7,-16.2),(10.7,-16.2)]:
    box('Planter',(x,y,2.69),(1.8,1.25,.50),planter_mat,.14)
    box('PlanterSoil',(x,y,2.941),(1.62,1.08,.018),wood,.065)
    for j in range(7):
        a=j*2.4;d=Vector((math.cos(a),math.sin(a),0));across=Vector((-d.y,d.x,0));base=Vector((x+(j%3-1)*.18,y+(j%2-.5)*.22,2.95));verts=[]
        for i in range(9):
            t=i/8;c=base+d*t*(.65+(j%3)*.16)+Vector((0,0,.70*math.sin(t*math.pi*.8)-.12*t*t));w=.20*math.sin(t*math.pi)**.75+.005
            verts.extend([c-across*w,c+Vector((0,0,.035)),c+across*w])
        faces=[]
        for i in range(8):
            for k in range(2):
                q=i*3+k;faces.append((q,q+1,q+4,q+3))
        leaf=mesh('BroadTropicalLeaf',verts,faces,green if j%2 else lime);leaf['wind_weight']=.02
        for polygon in leaf.data.polygons:polygon.use_smooth=True
if city:
    facades=[material('City facade '+str(i),rgb) for i,rgb in enumerate([(.075,.12,.23),(.12,.18,.30),(.17,.22,.35),(.10,.15,.25)])]
    glazing=material('City glazing',(.055,.17,.30),.36,.12)
    soft_cyan=light_material('City blue windows',(.10,.40,.63),.34)
    for side in [-1,1]:
        box('RooftopSideFascia',(side*12.9,0,1.63),(.22,35.2,1.6),frame,.055)
        box('RooftopEndFascia',(0,side*17.55,1.63),(25.8,.22,1.6),frame,.055)
        box('RoofEdgeLight',(side*13.02,0,2.13),(.012,35,.035),cyan if side<0 else pink)
        box('UnderCopingLight',(side*7.485,0,2.30),(.012,24.7,.025),cyan if side<0 else pink)
        for y in [-17,-11,-5,1,7,13,17]:box('GuardPost',(side*12.75,y,3.0),(.065,.065,1.1),frame,.018)
        box('SideGuardTop',(side*12.75,0,3.55),(.065,35,.065),frame,.025)
        box('SideGuardBase',(side*12.75,0,2.73),(.05,35,.05),frame,.02)
        for x in [-12.6,-8.4,-4.2,0,4.2,8.4,12.6]:box('EndGuardPost',(x,side*17.4,3.0),(.065,.065,1.1),frame,.018)
        box('EndGuardTop',(0,side*17.4,3.55),(25.5,.065,.065),frame,.025)
        box('EndGuardBase',(0,side*17.4,2.73),(25.5,.05,.05),frame,.02)
    for i in range(18):
        a=i/18*math.tau+.05*math.sin(i*3.1);distance=52+(i%4)*10;h=39+((i*17)%26);w=4+(i%4)*1.7;x=math.sin(a)*distance;y=math.cos(a)*distance;bottom=-29
        obj=box('SkylineTower',(x,y,bottom+h/2),(w,w*.76,h),facades[i%4],.30);obj.rotation_euler.z=-a
        obj=box('TowerCrown',(x,y,bottom+h+.45),(w*.91,w*.68,.9),facades[(i+1)%4],.20);obj.rotation_euler.z=-a
        if i%3==0:
            for tier in range(3):
                obj=box('TowerUpperSetback',(x,y,bottom+h+1.2+tier*1.1),(w*(.72-tier*.15),w*(.53-tier*.11),1.25),facades[(i+2)%4],.18);obj.rotation_euler.z=-a
            box('CrownSpire',(x,y,bottom+h+5.6),(.12,.12,4),cyan,.025)
        if i%3==1:
            obj=box('TowerShoulder',(x+w*.35,y,bottom+h*.37),(w*.58,w*.8,h*.74),facades[(i+1)%4],.1);obj.rotation_euler.z=-a
        for face in range(4):
            verts=[];faces=[];lit=[]
            angle=-a+face*math.pi/2
            halfdepth=w*(.38 if face%2==0 else .50)+.07
            width=w*(.84 if face%2==0 else .60)
            for row in range(17,int((h-.4)/1.13)):
                z=bottom+row*1.13
                for column in range(6):
                    lx=(column-2.5)*width/6;ly=halfdepth
                    base=len(verts);ww=width*.058;hh=.34 if row%5 else .26
                    for dx,dz in [(-ww,-hh),(ww,-hh),(ww,hh),(-ww,hh)]:
                        px=lx+dx;verts.append((x+px*math.cos(angle)-ly*math.sin(angle),y+px*math.sin(angle)+ly*math.cos(angle),z+dz))
                    faces.append((base,base+1,base+2,base+3))
                    pattern=(row*17+(column//2)*13+i*7+face*11)%23
                    lit.append(3 if pattern in [0,1] else 2 if pattern in [3,4,5] else 1 if pattern<14 else 0)
            panels=mesh('CityWindowPanels',verts,faces,glazing)
            for window_material in [soft_cyan,cyan,warm]:panels.data.materials.append(window_material)
            for polygon,light_index in zip(panels.data.polygons,lit):polygon.material_index=light_index
            for edge in [-1,1]:
                lx=edge*width*.54;ly=halfdepth+.045
                px=x+lx*math.cos(angle)-ly*math.sin(angle);py=y+lx*math.sin(angle)+ly*math.cos(angle)
                rib=box('FacadeVerticalRib',(px,py,bottom+h*.5),(.065,.085,h-.5),facades[(i+1)%4],.018);rib.rotation_euler.z=angle
            lx=0;ly=halfdepth+.045
            px=x-ly*math.sin(angle);py=y+ly*math.cos(angle)
            band=box('CrownLightTrim',(px,py,bottom+h-.24),(width,.06,.06),cyan if i%3 else pink,.012);band.rotation_euler.z=angle
        if i%4==0:box('CrownBeacon',(x,y,bottom+h+1.4),(.15,.15,.2),pink,.04)
else:
    sand=material('Island sand',(.76,.67,.44))
    verts=[];faces=[]
    for ring_index in range(4):
        for j in range(96):
            a=j/96*math.tau;c=math.cos(a);s=math.sin(a)
            ray=min(12.96/max(.0001,abs(c)),17.6/max(.0001,abs(s)))
            if ring_index==0:x=c*ray;y=s*ray;z=2.27
            else:
                shape=1+.024*math.sin(a*7)+.016*math.cos(a*11)
                radius=[0,1,1.13,1.19][ring_index]
                x=math.copysign(abs(c)**.50,c)*18.2*radius*shape
                y=math.copysign(abs(s)**.50,s)*24.2*radius*shape+1.2
                z=[0,2.10,1.20,.5][ring_index]+.10*math.sin(a*5)
            verts.append((x,y,z))
    for level in range(3):
        for j in range(96):
            a=level*96+j;b=level*96+(j+1)%96;faces.append((a,b,b+96,a+96))
    shore=mesh('SculptedResortShore',verts,faces,sand)
    for polygon in shore.data.polygons:polygon.use_smooth=True
    for x0,x1,y0,y1 in [(-1200,-18,-1200,1200),(18,1200,-1200,1200),(-18,18,-1200,-20),(-18,18,26,1200)]:
        mesh('OceanPlane',[(x0,y0,1.25),(x1,y0,1.25),(x1,y1,1.25),(x0,y1,1.25)],[(0,1,2,3)],ocean)
    from mathutils import noise
    ridges=[
        [(-27,53,1),(-18,57,4.5),(-12,62,7),(-7,65,15.5),(-4,68,18),(1,71,12),(9,77,11),(18,81,6),(28,88,1)],
        [(-7,65,15.5),(-4,61,10),(1,55,5.3),(7,47,1.2)],
        [(-12,62,7),(-17,55,5.2),(-19,48,1.2)],
        [(1,71,12),(9,65,8.5),(16,61,4.2),(28,58,1.2)],
        [(9,77,11),(3,82,7.5),(-7,89,1.2)],
    ]
    segments=[(Vector(a),Vector(b)) for ridge in ridges for a,b in zip(ridge,ridge[1:])]
    def ridge_height(x,y):
        heights=[]
        for a,b in segments:
            dx=b.x-a.x;dy=b.y-a.y;t=max(0,min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)))
            distance=math.hypot(x-a.x-dx*t,y-a.y-dy*t)
            heights.append(a.z+(b.z-a.z)*t-distance**.88*1.60)
        return max(heights)
    verts=[];faces=[];nx=112;ny=100
    for row in range(ny+1):
        y=39+row/ny*56
        for column in range(nx+1):
            x=-35+column/nx*72;p=Vector((x*.12,y*.12,1.7))
            broad=noise.noise(p);detail=noise.noise(p*2.7)
            envelope=max(0,1-((x+1)/37)**2-((y-68)/30)**2)
            low=1+3.1*envelope+broad*.65
            z=max(low,ridge_height(x+broad*.7,y+detail*.35)+broad*.45+detail*.08)
            coast=min(1,envelope*6)
            z=z*coast+.15*(1-coast)
            verts.append((x,y,z))
    for row in range(ny):
        for column in range(nx):
            q=row*(nx+1)+column;faces.extend([(q,q+1,q+nx+2),(q,q+nx+2,q+nx+1)])
    terrain=mesh('SculptedIslandPeakRidge',verts,faces,rock)
    for polygon in terrain.data.polygons:polygon.use_smooth=True
    soften=terrain.modifiers.new('Broad weathered ridges','SMOOTH');soften.factor=.5;soften.iterations=3
    for i,(x,y,h,lean) in enumerate([(-16,12,6,.5),(16,12,6,-.7),(-16,-7,6.8,.6),(16,2,6.3,-.5)]):palm(x,y,h,lean,i+10)
    for side in [-1,1]:
        for cluster,y in enumerate([-13,-11.9,-10.7,-2,-.9,.4,11.7,13,14.2,19.2]):
            base=Vector((side*(14.5+.7*math.sin(cluster*1.9)),y,2.11))
            for j in range(8):
                a=j*2.4+cluster*.71;d=Vector((math.cos(a),math.sin(a),0));across=Vector((-d.y,d.x,0));verts=[];faces=[]
                length=.75+.25*math.sin(j+cluster);height=.80+.28*math.cos(j*1.7+cluster)
                for row in range(11):
                    t=row/10;c=base+d*(t*length)+Vector((0,0,height*math.sin(t*math.pi*.73)));width=.27*math.sin(t*math.pi)**.65+.002
                    for cross in [-1,-.5,0,.5,1]:verts.append(c+across*(cross*width)+Vector((0,0,.065*(1-abs(cross))*math.sin(t*math.pi))))
                for row in range(10):
                    for column in range(4):
                        q=row*5+column;faces.append((q,q+1,q+6,q+5))
                leaf=mesh('CoastalBroadLeaf',verts,faces,green if (j+cluster)%3 else lime);leaf['wind_weight']=.02
                for polygon in leaf.data.polygons:polygon.use_smooth=True
    for x in [-7,-1,5]:
        ellipsoid('ShoreBoulder',(x,24.8+math.sin(x),1.8),(1.8,1.2,.95),rock,16,10)
for side in [-1,1]:
    box('CabanaCounter',(side*10.3,-15.05,3.02),(2.05,.65,1.2),white,.12)
    box('CabanaCounterTop',(side*10.3,-15.05,3.65),(2.17,.74,.13),wood,.06)
    for i in range(3):
        box('FoldedTowel',(side*10.3+(i-1)*.53,-15.05,3.76),(.41,.38,.08),cushion if i%2 else white,.04)
    for y in [-7.3,8.8]:
        ellipsoid('RoundTableVase',(side*11.25,y,3.04),(.11,.11,.15),planter_mat,16,10)
    for x in [side*9.6,side*11.1]:
        box('CabanaSeat',(x,-13.9,2.91),(.65,.75,.28),cushion,.12)
        box('CabanaSeatBase',(x,-13.9,2.63),(.47,.57,.40),wood,.06)
`;
