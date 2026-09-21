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
flower=material('Coral flowers',(.94,.28,.24))
def shade_lounge(side,y):
    x=side*11.0
    for dx in [-1.35,1.35]:
        for dy in [-1.8,1.8]:box('PavilionPost',(x+dx,y+dy,3.91),(.13,.13,2.94),wood,.025)
        box('PavilionSideBeam',(x+dx,y,5.38),(.16,3.76,.20),wood,.025)
    for dy in [-1.8,1.8]:box('PavilionEndBeam',(x,y+dy,5.38),(2.86,.16,.20),wood,.025)
    roof=mesh('PavilionCanvas',[(x-1.65,y-2.05,5.35),(x+1.65,y-2.05,5.35),(x+1.65,y+2.05,5.35),(x-1.65,y+2.05,5.35),(x,y,5.72)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],white)
    solid=roof.modifiers.new('Canvas hem','SOLIDIFY');solid.thickness=.06
    box('PavilionSofaBase',(x+side*.55,y,2.69),(1.0,2.8,.50),wood,.10)
    box('PavilionSeat',(x+side*.42,y,3.02),(1.0,2.6,.22),white,.10)
    box('PavilionBack',(x+side*.89,y,3.35),(.24,2.8,.76),cushion,.10)
    for dy in [-1.25,1.25]:box('PavilionArm',(x+side*.42,y+dy,3.26),(1.04,.22,.56),white,.09)
    for dy in [-.72,.72]:
        pillow=box('PavilionPillow',(x+side*.62,y+dy,3.37),(.25,.57,.51),cushion,.12);pillow.rotation_euler.y=-side*.15
    box('PavilionCoffeeTable',(x-side*.62,y,2.88),(.72,1.35,.12),wood,.05)
    for dy in [-.47,.47]:box('CoffeeTableLeg',(x-side*.62,y+dy,2.66),(.50,.09,.38),frame,.02)
for side in [-1,1]:shade_lounge(side,3.0 if side<0 else -1.0)
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
    for y in [-8.8,-5.8,7.3,10.3]:
        base=Vector((side*10.25,y,0));parts=[]
        parts.append(box('LoungeFrame',base+Vector((0,0,2.74)),(.78,1.95,.14),wood,.05))
        parts.append(box('LoungeCushion',base+Vector((0,-.15,2.85)),(.70,1.42,.14),white,.055))
        back=box('LoungeBack',base+Vector((0,.63,3.13)),(.70,.82,.20),white,.075);back.rotation_euler.x=.50;parts.append(back)
        for x in [-.26,.26]:
            for foot_y in [-.65,.65]:parts.append(box('LoungeLeg',base+Vector((x,foot_y,2.58)),(.10,.12,.27),frame,.02))
        angle=-side*math.pi/2
        for obj in parts:
            p=obj.location-base;obj.location=base+Vector((p.x*math.cos(angle)-p.y*math.sin(angle),p.x*math.sin(angle)+p.y*math.cos(angle),p.z));obj.rotation_euler.z+=angle
    for y in [-7.3,8.8]:
        box('SideTable',(side*11.25,y,2.85),(.55,.55,.10),white,.055)
        box('TableStem',(side*11.25,y,2.65),(.12,.12,.40),frame,.025)
for x,y in [(-11.4,-2.0),(11.5,4.5),(-8.5,16.4),(8.5,16.4),(-6.0,-15.4),(6.0,-15.4)]:
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
    for j in range(3):
        px=x+(j-1)*.40;py=y+.20*math.sin(j*2);pz=3.30+.10*(j%2)
        for petal in range(5):
            a=petal/5*math.tau
            ellipsoid('PlanterFlower',(px+.095*math.cos(a),py+.095*math.sin(a),pz),(.10,.08,.055),flower,8,4)
if city:
    facades=[material('City facade '+str(i),rgb) for i,rgb in enumerate([(.075,.12,.23),(.12,.18,.30),(.17,.22,.35),(.10,.15,.25)])]
    glazing=material('City glazing',(.055,.17,.30),.36,.12)
    soft_cyan=light_material('City blue windows',(.10,.40,.63),.34)
    for side in [-1,1]:
        cable_verts=[]
        for i in range(33):
            t=i/32;y=-15+30*t;z=7.55-1.6*math.sin(t*math.pi)
            cable_verts.extend([(side*12.4-.018,y,z),(side*12.4+.018,y,z)])
        mesh('TerraceLightCable',cable_verts,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(32)],frame)
        for y in [-15,15]:box('TerraceLightPole',(side*12.4,y,5.025),(.09,.09,5.15),frame,.025)
        for i in range(13):
            t=i/12;ellipsoid('TerraceStringBulb',(side*12.4,-15+30*t,7.43-1.6*math.sin(t*math.pi)),(.08,.08,.11),warm,8,4)
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
    for i in range(16):
        a=i/16*math.tau+.05*math.sin(i*3.1);distance=72+(i%4)*12;h=36+((i*17)%19);w=5+(i%4)*1.7;x=math.sin(a)*distance;y=math.cos(a)*distance;bottom=-29
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
        [(-32,64,1),(-22,67,5),(-15,70,10),(-9,74,23),(-6,75,24),(-2,76,23.7),(1,76,22),(7,78,13),(16,83,9),(34,90,1)],
        [(-9,74,22),(-12,65,14),(-15,57,7),(-25,49,1.2)],
        [(-5,75,24),(-5,65,15),(-8,56,7),(-14,46,1.2)],
        [(-2,76,20),(1,66,11),(4,57,5),(7,47,1.2)],
        [(2,76,23),(7,69,13),(14,61,6),(28,54,1.2)],
        [(7,78,15),(17,73,9),(27,67,4),(36,64,1.2)],
        [(-15,70,10),(-24,63,6),(-32,56,1.2)],
    ]
    segments=[(Vector(a),Vector(b)) for ridge in ridges for a,b in zip(ridge,ridge[1:])]
    def ridge_height(x,y):
        heights=[]
        for a,b in segments:
            dx=b.x-a.x;dy=b.y-a.y;t=max(0,min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)))
            distance=math.hypot(x-a.x-dx*t,y-a.y-dy*t)
            heights.append(a.z+(b.z-a.z)*t-max(0,distance-.12)*1.16)
        return max(heights)
    verts=[];faces=[];nx=104;ny=92
    for row in range(ny+1):
        y=40+row/ny*62
        for column in range(nx+1):
            x=-42+column/nx*86;p=Vector((x*.12,y*.12,1.7))
            broad=noise.noise(p);detail=noise.noise(p*2.7)
            envelope=max(0,1-((x+1)/43)**2-((y-72)/33)**2)
            low=.6+1.5*envelope+broad*.25
            z=max(low,ridge_height(x+broad*.35,y+detail*.20)+broad*.25+detail*.05)
            shoulder=16.4-max(0,abs(x-12)-1.8)*1.55-max(0,abs(y-79)-1.2)*1.15
            outer_shoulder=10.2-max(0,abs(x-23)-1.4)*1.35-abs(y-79)*.92
            foothills=max(5.4-abs(x+23)*.62-abs(y-60)*.82,4.1-abs(x+30)*.85-abs(y-67)*.58,6.2-abs(x-19)*.72-abs(y-61)*.82)
            z=max(z,shoulder,outer_shoulder,foothills)
            front=max(0,min(1,(74-y)/9))*max(0,min(1,(y-49)/8))
            gullies=max(0,1-abs(x-(-8+(y-61)*.28))/1.8)+max(0,1-abs(x-(3+(y-61)*.16))/2.4)
            z=max(low,z-front*gullies*1.55)
            z=min(z,22.8+.10*x+.18*broad)
            coast=min(1,envelope*6)
            z=z*coast+.15*(1-coast)
            summit=max(0,min(1,(z-8)/14))
            verts.append(((x+3)*(1-summit*.45)-3,y,z))
    for row in range(ny):
        for column in range(nx):
            q=row*(nx+1)+column;faces.extend([(q,q+1,q+nx+2),(q,q+nx+2,q+nx+1)])
    terrain=mesh('SculptedIslandPeakRidge',verts,faces,rock)
    for polygon in terrain.data.polygons:polygon.use_smooth=True
    soften=terrain.modifiers.new('Broad weathered ridges','SMOOTH');soften.factor=.18;soften.iterations=1
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
