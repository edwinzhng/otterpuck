export const alpineForestPython = `
af_snow=material('Fresh blue-white snow',(.83,.91,1))
af_stone=material('Blue granite',(.29,.36,.43))
af_lightstone=material('Granite lit planes',(.47,.55,.61))
af_wood=material('Cedar lodge timber',(.28,.115,.046))
af_trim=material('Honey cedar trim',(.56,.29,.095))
af_roof=material('Slate lodge roof',(.12,.22,.28))
af_pine=material('Deep pine needles',(.035,.19,.13))
af_needles=material('Sunlit pine needles',(.10,.31,.18))
af_window=material('Warm lodge windows',(1,.57,.12),.28)
af_window.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(1,.36,.055,1)
af_window.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.45
af_water=material('Mountain waterfall',(.42,.79,.88),.23)
af_foam=material('Waterfall white ribbons',(.84,.96,.98),.4)
af_moss=material('Rock moss',(.26,.39,.12))
af_deck=material('Weathered cedar decking',(.42,.28,.16))

def af_oval(name,center,scale,mat,segments=8,rings=5):
    verts=[(0,0,scale[2])];faces=[]
    for row in range(1,rings):
        v=row*math.pi/rings
        for col in range(segments):
            u=col*math.tau/segments
            verts.append((scale[0]*math.sin(v)*math.cos(u),scale[1]*math.sin(v)*math.sin(u),scale[2]*math.cos(v)))
    bottom=len(verts);verts.append((0,0,-scale[2]))
    for col in range(segments):
        faces.append((0,1+col,1+(col+1)%segments))
        faces.append((bottom,1+(rings-2)*segments+(col+1)%segments,1+(rings-2)*segments+col))
    for row in range(rings-2):
        for col in range(segments):
            a=1+row*segments+col;b=1+row*segments+(col+1)%segments
            faces.append((a,a+segments,b+segments,b))
    obj=mesh(name,verts,faces,mat);obj.location=center
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def af_beam(name,a,b,width,mat):
    a,b=Vector(a),Vector(b)
    obj=box(name,(a+b)*.5,(width,width,(b-a).length),mat,.025)
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj

def af_rock(name,x,y,z,sx,sy,sz,snow=False):
    verts=[]
    for ring in range(4):
        t=ring/3
        radius=[.81,1,.83,.32][ring]
        for j in range(9):
            a=j*math.tau/9
            irregular=1+.10*math.sin(j*3.7+x+y)
            verts.append((x+sx*math.cos(a)*radius*irregular,y+sy*math.sin(a)*radius*irregular,z+sz*t+.09*sz*math.sin(j*2.1)*math.sin(t*math.pi)))
    faces=[]
    for ring in range(3):
        for j in range(9):
            a=ring*9+j;b=ring*9+(j+1)%9
            faces.append((a,b,b+9,a+9))
    faces.append(tuple(range(27,36)))
    obj=mesh(name,verts,faces,af_stone)
    obj.data.materials.append(af_lightstone)
    for p in obj.data.polygons:p.material_index=int(p.index%5==0)
    if snow:
        af_oval(name+'Snow',(x,y,z+sz*.90),(sx*.82,sy*.80,sz*.19),af_snow,12,6)
    elif sz>1:
        obj.data.materials.append(af_moss)
        for p in obj.data.polygons:
            if p.index>=21 and p.index%3!=0:p.material_index=2

def af_pinetree(x,y,h,index,snow=False):
    base=2.44
    af_beam('Pine trunk',(x,y,base),(x,y,base+h*.84),.20+h*.021,af_wood)
    core_verts=[];core_faces=[]
    for row in range(8):
        t=row/7;radius=h*.135*(1-t)**.72+.015
        for col in range(10):
            a=col*math.tau/10
            r=radius*(1+.06*math.sin(col*3+index))
            core_verts.append((x+math.cos(a)*r,y+math.sin(a)*r,base+h*(.16+.84*t)))
    for row in range(7):
        for col in range(10):
            a=row*10+col;b=row*10+(col+1)%10
            core_faces.append((a,b,b+10,a+10))
    core=mesh('Continuous fir heart',core_verts,core_faces,af_pine)
    if snow:core.data.materials.append(af_snow)
    for p in core.data.polygons:p.use_smooth=True
    if snow:
        for p in core.data.polygons:
            if p.index>=60:p.material_index=1
    for tier in range(5):
        z=base+h*(.20+.14*tier)
        radius=h*(.24-.042*tier)
        for branch in range(4):
            a=branch*math.pi/2+index*.71+tier*.78
            reach=radius*(.46+.08*math.sin(index+branch*2))
            px=x+math.cos(a)*reach;py=y+math.sin(a)*reach
            pz=z+h*.023*math.sin(branch*2.3+index)
            verts=[];faces=[]
            for surface in [-1,1]:
                for row in range(4):
                    t=row/3
                    width=radius*(.10+.53*math.sin(t*math.pi))
                    for across in [-1,0,1]:
                        reach=radius*(-.20+1.62*t-.28*abs(across)*t*t)
                        lateral=width*across
                        zoff=h*(.035*math.sin(t*math.pi)-.048*t*t+surface*.072*(1-t)**.65)
                        verts.append((x+math.cos(a)*reach-math.sin(a)*lateral,y+math.sin(a)*reach+math.cos(a)*lateral,pz+zoff))
            for row in range(3):
                for col in range(2):
                    q=row*3+col
                    faces.append((q,q+1,q+4,q+3))
                    faces.append((q+12,q+15,q+16,q+13))
            for row in range(3):
                q=row*3;faces.append((q,q+3,q+15,q+12))
                q=row*3+2;faces.append((q,q+12,q+15,q+3))
            faces.extend([(0,12,13,14,2,1),(9,10,11,23,22,21)])
            obj=mesh('Drooping tapered fir bough',verts,faces,af_pine if branch%3 else af_needles)
            for p in obj.data.polygons:p.use_smooth=True
            if snow:
                cap=af_oval('Soft branch snow pillow',(px,py,pz+h*.080),(radius*.80,radius*.54,h*.045),af_snow,8,3)
                cap.rotation_euler.z=a

def af_understory(x,y,index,snow=False):
    for j in range(3):
        radius=.50+.18*math.sin(index+j)**2
        px=x+.42*math.sin(j*2.2);py=y+.38*math.cos(j*2.2)
        af_oval('Grounded shrub branches',(px,py,2.44+radius*.53),(radius,radius*.75,radius*.62),af_pine if j%2 else af_needles,8,5)
        if snow:af_oval('Low shrub snow',(px,py,2.44+radius*.90),(radius*.92,radius*.69,radius*.24),af_snow,8,4)

def af_roof_mesh(name,cx,cy,width,depth,eave,ridge,mat,thickness=.18):
    vertices=[(cx-width/2,cy-depth/2,eave),(cx,cy-depth/2,ridge),(cx+width/2,cy-depth/2,eave),(cx-width/2,cy+depth/2,eave),(cx,cy+depth/2,ridge),(cx+width/2,cy+depth/2,eave)]
    obj=mesh(name,vertices,[(0,3,4,1),(1,4,5,2)],mat)
    solid=obj.modifiers.new('Roof thickness','SOLIDIFY');solid.thickness=thickness
    return obj

def af_lodge(cx,cy,width,depth,height,snow=False):
    base=2.44;eave=base+height;ridge=eave+width*.28
    box('Lodge stone plinth',(cx,cy,base+.28),(width+.4,depth+.4,.56),af_stone,.12)
    box('Lodge walls',(cx,cy,base+height*.5),(width,depth,height),af_wood,.055)
    mesh('Lodge gable',[(cx-width/2,cy-depth/2-.02,eave),(cx+width/2,cy-depth/2-.02,eave),(cx,cy-depth/2-.02,ridge)],[(0,1,2)],af_wood)
    af_roof_mesh('Main pitched roof',cx,cy,width+1.35,depth+1.20,eave-.10,ridge+.16,af_roof,.22)
    if snow:af_roof_mesh('Deep roof snow',cx,cy,width+1.44,depth+1.25,eave+.13,ridge+.40,af_snow,.24)
    front=cy-depth/2-.09
    for side in [-1,1]:
        af_beam('Gable rake',(cx+side*(width/2+.6),front-.48,eave),(cx,front-.48,ridge+.10),.20,af_trim)
        box('Corner timber',(cx+side*(width/2-.12),front,base+height/2),(.24,.22,height),af_trim,.025)
    for row in range(1,7):
        box('Horizontal cedar course',(cx,front+.03,base+height*row/7),(width,.07,.06),af_trim,.015)
    for side in [-1,1]:
        wx=cx+side*width*.30;w=width*.18;z=base+height*.55
        box('Glowing lodge window',(wx,front-.055,z),(w,.09,height*.42),af_window,.045)
        for edge in [-1,0,1]:
            box('Window mullion',(wx+edge*w/2,front-.13,z),(.09,.12,height*.46),af_trim,.015)
        for edge in [-1,1]:
            box('Window lintel',(wx,front-.14,z+edge*height*.22),(w+.12,.13,.10),af_trim,.015)
        box('Window crossbar',(wx,front-.14,z),(w,.13,.075),af_trim)
    for side in [-1,1]:
        wallx=cx+side*(width/2+.06)
        for board in range(8):
            box('Side cedar board',(wallx,cy,base+height*(board+.5)/8),(.075,depth,.055),af_trim,.012)
        for offset in [-.26,.26]:
            wy=cy+depth*offset;w=depth*.22;z=base+height*.55
            box('Side lodge window',(wallx+side*.025,wy,z),(.065,w,height*.40),af_window,.02)
            for edge in [-1,0,1]:
                box('Side window mullion',(wallx+side*.075,wy+edge*w/2,z),(.12,.09,height*.44),af_trim,.012)
            for edge in [-1,1]:
                box('Side window lintel',(wallx+side*.075,wy,z+edge*height*.22),(.12,w+.10,.09),af_trim,.012)
    box('Entry door',(cx,front-.065,base+1.25),(1.30,.13,2.5),af_trim,.05)
    box('Entry glass',(cx,front-.145,base+1.63),(.88,.035,1.18),af_window,.03)
    for side in [-1,1]:
        box('Attic window',(cx+side*.47,front-.05,eave+.44),(.65,.09,.86),af_window,.05)
    porch_y=front-1.23
    box('Porch floor',(cx,porch_y,base+.13),(width+1.1,2.2,.26),af_trim,.045)
    af_roof_mesh('Supported porch canopy',cx,porch_y,width+1.5,2.75,base+2.85,base+3.26,af_roof,.18)
    if snow:af_roof_mesh('Porch snow',cx,porch_y,width+1.55,2.8,base+3.03,base+3.44,af_snow,.15)
    for side in [-1,1]:
        px=cx+side*(width/2-.25)
        box('Porch support post',(px,porch_y-.8,base+1.42),(.24,.24,2.84),af_trim,.035)
        af_beam('Porch knee brace',(px,porch_y-.8,base+2.05),(px-side*.65,porch_y-.8,base+2.85),.16,af_trim)
    box('Chimney',(cx-width*.27,cy+.55,ridge-.1),(.75,.85,2.3),af_stone,.07)
    box('Chimney crown',(cx-width*.27,cy+.55,ridge+1.08),(.95,1.05,.20),af_lightstone,.035)

def af_mountain(cx,cy,width,height,index,snow=False):
    vertices=[];faces=[];steps=24
    for ring in range(7):
        t=ring/6
        for j in range(steps):
            a=j*math.tau/steps
            ridge=1+.14*math.cos(a*5+index)+.06*math.cos(a*9-index)
            r=width*(1-t)**.78*ridge+.07
            shoulder=height*.17*math.sin(a*3+index)*math.sin(t*math.pi)
            vertices.append((cx+math.cos(a)*r+width*.13*math.sin(t*math.pi),cy+math.sin(a)*r*.61,1.5+height*t+shoulder))
    for ring in range(6):
        for j in range(steps):
            a=ring*steps+j;b=ring*steps+(j+1)%steps
            faces.append((a,b,b+steps,a+steps))
    obj=mesh('Sculpted alpine peak',vertices,faces,af_stone)
    obj.data.materials.append(af_lightstone);obj.data.materials.append(af_snow if snow else af_pine)
    for p in obj.data.polygons:
        ring=p.index//steps;j=p.index%steps
        p.material_index=2 if snow and ring>=3+(j%3==0) else (1 if j%7<3 else 0)

def af_railing(y,snow=False):
    start=-3 if snow else -12
    for x in range(start,13,3):
        box('Deck fence post',(x,y,3.08),(.19,.19,1.30),af_trim,.035)
        if snow:box('Fence post snow',(x,y,3.76),(.31,.31,.12),af_snow,.055)
    for z in [2.86,3.45]:box('Continuous fence rail',((start+12)/2,y,z),(12-start+.2,.14,.16),af_wood,.035)

def af_waterfall(x,y,width,height):
    verts=[];faces=[]
    for step in range(14):
        t=step/13
        for side in [-1,1]:verts.append((x+side*width*.57,y-.8*t*t+.08,2.6+height*(1-t)))
    for step in range(13):
        a=step*2;faces.append((a,a+1,a+3,a+2))
    cascade=mesh('Continuous cascade water',verts,faces,af_water)
    for p in cascade.data.polygons:p.use_smooth=True
    for ribbon in range(5):
        verts=[];faces=[]
        for step in range(14):
            t=step/13
            center=x-width*.42+width*.84*ribbon/4+.04*math.sin(t*6+ribbon)
            foam_width=width*.012*(.3+.7*math.sin(t*math.pi)**2)
            for side in [-1,1]:verts.append((center+side*foam_width,y-.8*t*t-.018,2.6+height*(1-t)))
        for step in range(13):
            a=step*2;faces.append((a,a+1,a+3,a+2))
        obj=mesh('Waterfall flowing ribbon',verts,faces,af_foam)
        obj.data.materials[0].use_backface_culling=False
    af_oval('Waterfall plunge pool',(x,y-.6,2.47),(width*.95,2.6,.12),af_water,24,6)
    for i in range(7):af_oval('Soft white waterfall foam',(x+(i-3)*width/7,y-.95,2.62),(.65,.44,.20),af_foam,10,6)

for side in [-1,1]:
    box('Continuous wooded ground',(side*44,25,1.85),(62,125,1.18),af_snow if arena=='alpine' else af_moss)
box('Continuous rear mountain ground',(0,69,1.85),(26,103,1.18),af_snow if arena=='alpine' else af_moss)
for side in [-1,1]:
    box('Distant wooded ground',(side*44,104,1.85),(62,33,1.18),af_snow if arena=='alpine' else af_moss)
for side in [-1,1]:
    for row in range(12):
        for col in range(12):
            box('Timber deck plank',(side*(7.86+col*.42),-16.02+row*2.80,2.458),(.404,2.776,.026),af_deck)
    box('Stone path bedding',(0,side*14.74,2.461),(15.4,4.32,.034),af_stone)
    for row in range(3):
        for col in range(10):
            cx=-6.95+col*1.50+.18*math.sin(row*2+col);cy=side*(13.40+row*1.34)
            verts=[]
            for corner in range(6):
                a=corner*math.tau/6+.12*math.sin(col+row)
                r=.68+.035*math.sin(corner*3+col)
                verts.append((cx+math.cos(a)*r,cy+math.sin(a)*r*.83,2.48))
            mesh('Irregular stone path',verts,[(0,1,2,3,4,5)],af_lightstone)

if arena=='alpine':
    for side in [-1,1]:
        box('Snowy mountain terrace',(side*16.5,0,2.07),(7.1,43,.62),af_snow,.28)
    box('Snow terrace beyond deck',(0,25,2.07),(42,15,.62),af_snow,.28)
    af_lodge(-11.5,23,10.5,8,4.8,True)
    af_railing(17.1,True)
    for i,(x,y,w,h) in enumerate([(-36,86,21,19),(-9,94,25,24),(17,92,26,26),(40,100,24,21)]):af_mountain(x,y,w,h,i,True)
    for i,(x,y,h) in enumerate([(-17,-12,9),(-18,-2,10),(-17,10,11),(17,-10,10),(17,1,12),(17,12,13),(18,25,14),(8,29,9),(-24,32,12),(-30,40,14),(-10,42,10),(0,38,9),(28,38,15),(35,49,13),(6,47,12)]):af_pinetree(x,y,h,i,True)
    for i,(x,y,h) in enumerate([(-22,-6,7),(-24,8,8),(-22,18,6),(-21,39,8),(-12,35,7),(-4,30,6),(4,36,7),(14,38,8),(23,7,8),(23,20,7),(29,29,9),(31,3,10)]):af_pinetree(x,y,h,50+i,True)
    for i in range(11):
        side=-1 if i%2 else 1
        af_rock('Snowbank granite',side*(13.7+.8*math.sin(i)),i*3.1-15,2.3,1.15,.95,1.4+.4*math.sin(i),True)
elif arena=='forest':
    af_lodge(13.5,23.5,8,8,4.2)
    af_railing(17.1)
    for i,(x,y,w,h) in enumerate([(-34,85,25,13),(0,99,30,16),(34,91,27,14)]):af_mountain(x,y,w,h,i)
    for i in range(24):
        x=-31+(i%8)*8.8+2.4*math.sin(i*2.37);y=33+(i//8)*12+3.8*math.sin(i*1.83)
        if abs(x)<5 and y<40:continue
        if 7<x<20 and y<34:continue
        af_pinetree(x,y,7.5+6*math.sin(i*1.7)**2,i)
    for i,(x,y,h) in enumerate([(-26,37,4.0),(-23,39,5.1),(-27,42,4.6),(25,44,4.3),(28,46,5.4),(24,48,4.5)]):af_pinetree(x,y,h,70+i)
    for i,(x,y,h) in enumerate([(-17,-11,12),(-17,2,13),(-18,15,12),(17,-10,11),(17,0,12),(28,13,14)]):af_pinetree(x,y,h,30+i)
    for side in [-1,1]:
        for i in range(5):af_rock('Waterfall crag',side*(5+i*2.1),26+i*.8,2.3,2.8,3.2,6.8-i*.66)
    af_rock('Cascade back wall',0,29,2.3,4.9,2.6,6.0)
    af_waterfall(0,25.7,5,5.8)
    af_waterfall(-11,26.0,2.5,5.1)
    for side in [-1,1]:
        for i in range(7):af_rock('Mossy terrace boulder',side*(13.8+.8*math.sin(i)),i*4.8-15,2.25,1.1,.95,1.1+.35*math.sin(i))

for side in [-1,1]:
    for i in range(12):
        x=side*(14.1+1.1*math.sin(i*2.4)**2);y=-15+i*3.1
        if arena=='forest' and side>0 and y>17:continue
        af_understory(x,y,i,arena=='alpine')
    for i in range(6):
        x=side*(19+2.3*math.sin(i*1.8));y=-10+i*6.4
        if arena=='alpine' and side<0 and y>15 and y<29:continue
        if arena=='forest' and side>0 and y>17 and y<30:continue
        af_understory(x,y,30+i,arena=='alpine')
        af_rock('Grove ground rock',x+1.0,y+.8,2.30,.7,.8,.8,arena=='alpine')
`;
