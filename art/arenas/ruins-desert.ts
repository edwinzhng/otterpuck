export const ruinsDesertPython = `
if arena in ['ruins','desert']:
    masonry=material('Moss sandstone' if arena=='ruins' else 'Oasis plaster',(.43,.49,.32) if arena=='ruins' else (.92,.77,.53))
    edge_stone=material('Weathered stone edges' if arena=='ruins' else 'Sunlit plaster',(.61,.65,.43) if arena=='ruins' else (1,.88,.66))
    shadow_stone=material('Stone recesses' if arena=='ruins' else 'Terracotta',(.24,.31,.23) if arena=='ruins' else (.60,.29,.16))
    leaves_dark=material('Canopy deep green',(.035,.20,.10))
    leaves_light=material('Canopy yellow green',(.31,.51,.09))
    waterfall=material('Waterfall turquoise',(.24,.74,.77),.28)
    foam=material('Waterfall foam',(.83,.97,.91),.4)

    def scenic_arch(name,x,y,z,width,height,depth,mat):
        radius=width/2;thickness=.30
        for side in [-1,1]:
            box(name+'Pier',(x+side*(radius+thickness/2),y,z+(height-radius)/2),(thickness,depth,height-radius),mat,.06)
        verts=[];faces=[]
        for back in [-1,1]:
            for outer in [0,1]:
                r=radius+outer*thickness
                for i in range(17):
                    a=i*math.pi/16
                    verts.append((x+math.cos(a)*r,y+back*depth/2,z+height-radius+math.sin(a)*r))
        for i in range(16):
            faces.extend([(i,i+1,18+i,17+i),(34+i,51+i,52+i,35+i),(i,34+i,35+i,i+1),(17+i,18+i,52+i,51+i)])
        faces.extend([(0,17,51,34),(16,50,67,33)])
        return mesh(name+'Arch',verts,faces,mat)

    def broadleaf(x,y,z,scale,index):
        for leaf in range(7):
            angle=leaf*math.tau/7+index*.53
            forward=Vector((math.cos(angle),math.sin(angle),0));across=Vector((-math.sin(angle),math.cos(angle),0))
            verts=[];faces=[]
            for i in range(5):
                t=i/4;center=Vector((x,y,z))+forward*(scale*t)+Vector((0,0,scale*(.75*math.sin(t*2.5)+.04)))
                width=.27*scale*math.sin(t*math.pi)**.7
                for sign in [-1,0,1]:
                    verts.append(center+across*(width*sign)+Vector((0,0,-abs(sign)*.10*scale*math.sin(t*math.pi))))
            for i in range(4):
                j=i*3;faces.extend([(j,j+1,j+4,j+3),(j+1,j+2,j+5,j+4)])
            obj=mesh('Broadleaf',verts,faces,leaves_light if leaf%3==0 else leaves_dark)
            obj.data.materials[0].use_backface_culling=False
            for polygon in obj.data.polygons:polygon.use_smooth=True

    def understory(x,y,z,size,index):
        verts=[];faces=[]
        for frond in range(5):
            a=frond*math.tau/5+index*.67
            direction=Vector((math.cos(a),math.sin(a),0));across=Vector((-math.sin(a),math.cos(a),0))
            stem_start=len(verts)
            for t in [0,.18,.46,.74,.92]:
                center=Vector((x,y,z))+direction*(size*t)+Vector((0,0,size*((.18 if t else 0)+.62*math.sin(t*2.7))))
                verts.extend([center-across*size*.018,center+across*size*.018])
            for segment in range(4):
                n=stem_start+segment*2;faces.append((n,n+1,n+3,n+2))
            for pair in range(3):
                t=.18+pair*.28
                center=Vector((x,y,z))+direction*(size*t)+Vector((0,0,size*(.18+.62*math.sin(t*2.7))))
                for side in [-1,1]:
                    spread=size*.25*(1-t*.7)
                    start=len(verts)
                    verts.extend([center-direction*size*.10,center+across*side*spread-direction*size*.07,center+direction*size*.14,center+Vector((0,0,size*.045))])
                    faces.extend([(start,start+1,start+3),(start+1,start+2,start+3)])
        obj=mesh('Fern understory',verts,faces,leaves_light if index%3==0 else leaves_dark)
        obj.data.materials[0].use_backface_culling=False
        for polygon in obj.data.polygons:polygon.use_smooth=True

    def cascade(x,y,z,width,height):
        verts=[];faces=[]
        for i in range(17):
            t=i/16
            for j in range(9):
                u=j/8
                verts.append((x+(u-.5)*width,y-.38*t*t+.06*math.sin(u*math.pi*8+t*6),z-height*t))
        for i in range(16):
            for j in range(8):
                n=i*9+j;faces.append((n,n+1,n+10,n+9))
        mesh('Falling water',verts,faces,waterfall)
        for ribbon in range(11):
            verts=[];faces=[];u=.05+ribbon*.09
            start=.04+.13*(ribbon%3);end=.78+.10*(ribbon%2)
            for i in range(13):
                t=start+(end-start)*i/12
                xx=x+(u-.5)*width+.055*math.sin(t*11+ribbon)
                yy=y-.38*t*t+.06*math.sin(u*math.pi*8+t*6)-.075
                spread=(.025+.02*(ribbon%3))*math.sin(i/12*math.pi)**.5
                verts.extend([(xx-spread,yy,z-height*t),(xx+spread,yy,z-height*t)])
            for i in range(12):
                n=i*2;faces.append((n,n+1,n+3,n+2))
            mesh('Broken water highlight',verts,faces,foam)
        for i in range(7):ellipsoid('Cascade spray',(x+(i-3)*width/7,y-.35,z-height+.12),(.38,.34,.15),foam,10,6)

    if arena=='ruins':
        for side in [-1,1]:
            box('Jungle ground side',(side*34.25,10,1.0),(51.5,120,2.32),shadow_stone,.3)
        box('Jungle ground near',(0,-31.75,1.0),(17,36.5,2.32),shadow_stone,.3)
        box('Jungle ground far',(0,41.75,1.0),(17,56.5,2.32),shadow_stone,.3)
        for side in [-1,1]:
            box('Jungle terrace',(side*15.5,1,1.22),(5,45,2.44),shadow_stone,.15)
            for row in range(2):
                for i in range(12):
                    y=-16+i*3.05+row*.4
                    box('Terrace masonry',(side*(13.35+row*.25),y,2.55+row*.52),(.65,2.94,.50),masonry,.08)
            for y in [-10,-2,7,15]:
                box('Column footing',(side*13.4,y,2.6),(1.55,1.55,.32),edge_stone,.10)
                for level in range(5+(1 if y==15 else 0)):
                    column_block=box('Ruined column',(side*13.4,y,2.95+level*.67),(1.12,1.12,.64),masonry if level%2 else edge_stone,.08)
                    column_block.rotation_euler.z=.025*math.sin(y+level)
                box('Column capital',(side*13.4,y,6.08 if y!=15 else 6.75),(1.6,1.6,.30),edge_stone,.08)
            scenic_arch('Ruined gateway',side*10.2,19,2.44,3.3,5.3,1.2,masonry)
            for j in range(12):
                y=-17+j*3.4
                broadleaf(side*(14.8+.8*math.sin(j)),y,2.5,1.5+.3*math.sin(j*2),j)
            for j in range(7):
                x=side*(18+(j%2)*3+.8*math.sin(j*2));y=-12+j*6
                tree_height=7.5+1.7*math.sin(j*1.7+side)
                box('Jungle trunk',(x,y,2.1+tree_height*.5),(.65,.7,tree_height),wood,.22)
                for branch in range(6):
                    a=branch*math.tau/5+j
                    endpoint=Vector((x+math.cos(a)*2.3,y+math.sin(a)*2.0,tree_height+1.3+1.2*math.sin(branch*2+j)))
                    origin=Vector((x,y,tree_height-.6));branch_delta=endpoint-origin
                    limb=box('Jungle branching limb',(origin+endpoint)*.5,(.28,.28,branch_delta.length),wood,.08)
                    limb.rotation_euler=branch_delta.to_track_quat('Z','Y').to_euler()
                    for spray in range(9):
                        angle=spray*math.tau/9+j+branch*.4
                        direction=Vector((math.cos(angle),math.sin(angle),0));across=Vector((-math.sin(angle),math.cos(angle),0))
                        length=2.5+.5*math.sin(spray*2+branch);width=.9+.18*math.cos(spray*3)
                        origin=endpoint+Vector((0,0,.22*math.sin(spray)))
                        middle=origin+direction*length*.5+Vector((0,0,.55))
                        verts=[origin,middle+across*width-Vector((0,0,.18)),middle+Vector((0,0,.18)),middle-across*width-Vector((0,0,.18)),origin+direction*length-Vector((0,0,.40))]
                        obj=mesh('Canopy leaf spray',verts,[(0,1,2),(0,2,3),(1,4,2),(2,4,3)],leaves_dark if (spray+branch)%3 else leaves_light)
                        obj.data.materials[0].use_backface_culling=False
                        for polygon in obj.data.polygons:polygon.use_smooth=True
            for j in range(30):
                x=side*(16.2+(j%3)*3.1+.65*math.sin(j*2.3));y=-19+(j//3)*4.9+.7*math.cos(j*1.3)
                understory(x,y,2.44 if abs(x)<17.9 and y<23 else 2.16,1.1+.65*math.sin(j*1.9)**2,j)
                if j%5==0:broadleaf(x+side*.5,y+.5,2.4 if abs(x)<17.9 and y<23 else 2.12,1.6,j)
        for x in [-13,-9,-5,5,9,13]:
            for level in range(5):
                box('Waterfall cliff',(x,29+level*.34,2.6+level*1.8),(4.4,4.5,1.9),shadow_stone if level%2 else masonry,.45)
            broadleaf(x,29,10.40,2.1,int(x+15))
        box('Fall lintel',(0,29,11.15),(7,4,.7),edge_stone,.25)
        cascade(0,26.8,11.1,5.8,8.6)
        box('Forest lagoon',(0,23,2.42),(19,10,.10),waterfall,.1)
        for side in [-1,1]:
            for i in range(3):
                box('Guardian stepped plinth',(side*10.3,22.0,2.6+i*.38),(4.4-i*.5,3.9-i*.4,.38),edge_stone,.12)
            x=side*10.3;y=22.0
            ellipsoid('Guardian body',(x,y,5.2),(1.25,.95,1.8),masonry,20,12)
            ellipsoid('Guardian head',(x,y-.10,7.25),(1.45,1.02,1.24),edge_stone,24,14)
            for sign in [-1,1]:
                ellipsoid('Guardian ear',(x+sign*1.03,y,8.07),(.45,.35,.45),masonry,12,8)
                ellipsoid('Guardian muzzle',(x+sign*.37,y-1.01,6.90),(.50,.34,.33),masonry,16,8)
                ellipsoid('Guardian eye',(x+sign*.49,y-1.02,7.55),(.14,.06,.18),shadow_stone,12,8)
                ellipsoid('Guardian paw',(x+sign*1.05,y-.38,5.3),(.40,.47,1.00),edge_stone,16,8)
                ellipsoid('Guardian foot',(x+sign*.65,y-.52,3.85),(.58,.62,.30),masonry,12,8)
            ellipsoid('Guardian nose',(x,y-1.33,7.08),(.25,.14,.17),shadow_stone,16,8)
            ellipsoid('Guardian chest',(x,y-.90,5.20),(.78,.10,1.17),edge_stone,16,10)
            broadleaf(x+side*2.2,y,2.8,2.0,8)
        for side in [-1,1]:
            for y in [-16,-10,0,10,16]:broadleaf(side*11.6,y,2.5,1.05,int(y+20))

    else:
        mesa_light=material('Mesa apricot',(.79,.39,.22))
        mesa_shadow=material('Mesa violet shadow',(.44,.23,.29))
        mesa_band=material('Mesa sandstone strata',(.92,.58,.32))
        sand=material('Oasis sand',(.85,.64,.38))
        for side in [-1,1]:
            box('Desert shelf side',(side*39.25,5,.4),(61.5,150,.8),sand,.5)
        box('Desert shelf near',(0,-41.75,.4),(17,56.5,.8),sand,.5)
        box('Desert shelf far',(0,46.75,.4),(17,66.5,.8),sand,.5)
        def mesa(x,y,width,depth,height,index):
            verts=[];faces=[];count=14
            for level,(scale,z) in enumerate([(1.35,0),(1.1,height*.17),(.91,height*.30),(.84,height*.70),(.68,height*.90),(.65,height)]):
                for i in range(count):
                    a=i*math.tau/count
                    r=1+.10*math.sin(i*2.4+index)+.04*math.cos(i*4.3)
                    verts.append((x+math.cos(a)*width*scale*r,y+math.sin(a)*depth*scale*r,z))
            for level in range(5):
                for i in range(count):
                    n=level*count+i;j=level*count+(i+1)%count;faces.append((n,j,j+count,n+count))
            faces.append(tuple(range(count*5,count*6)))
            obj=mesh('Layered mesa',verts,faces,mesa_light)
            obj.data.materials.append(mesa_shadow);obj.data.materials.append(mesa_band)
            for polygon in obj.data.polygons:
                level=polygon.index//count
                polygon.material_index=2 if level in [1,4] else (1 if polygon.normal.x>.2 else 0)
        for i,(x,y,w,d,h) in enumerate([(-37,48,9,8,22),(-24,54,7,9,30),(-9,68,10,10,25),(12,62,9,8,18),(31,49,12,10,24),(49,60,10,8,17)]):mesa(x,y+32,w,d,h*.65,i)
        for side in [-1,1]:
            for y in [-7,0,7]:
                scenic_arch('Adobe arcade',side*15.2,y,2.44,3.6,3.6,2.6,masonry)
                box('Arcade roof',(side*15.2,y,6.25),(4.6,3,.48),edge_stone,.14)
            box('Arcade rear wall',(side*17.25,0,4.15),(.4,17,3.42),masonry,.15)
            for y in [-6.7,.3,7.3]:
                box('Terracotta bench',(side*16.1,y,2.9),(1.3,2.5,.7),shadow_stone,.13)
                box('Bench cushion',(side*16.1,y,3.32),(1.4,2.5,.19),white,.09)
            for j,y in enumerate([-13,14]):
                box('Palm grove bed',(side*14.1,y,1.56),(5.4,6.0,1.68),sand,.25)
                palm(side*13.2,y,7.5+.7*j,-side*.3,j+(0 if side<0 else 2)+70)
                if j==1:palm(side*15.3,y+1.8,5.7,side*.5,80+(0 if side<0 else 1))
                for shrub in range(6):
                    a=shrub*math.tau/6
                    understory(side*14.1+math.cos(a)*1.8,y+math.sin(a)*2.1,2.43,.6+.3*math.sin(shrub+1)**2,shrub+j)
                    if shrub%2==0:broadleaf(side*14.1+math.cos(a)*1.45,y+math.sin(a)*1.75,2.4,1.15+.15*(shrub%3),shrub)
                broadleaf(side*15.2,y-.8,2.40,1.1,j+2)
            for y in [-8,0,8]:
                box('Oasis planter',(side*11.8,y,2.75),(1.55,2,.60),edge_stone,.14)
                broadleaf(side*11.8,y,3.05,.9,int(y+12))
        box('Spring basin',(0,20,2.65),(11,4,.44),waterfall,.1)
        for side in [-1,1]:
            box('Spring wall',(side*4,22,4.15),(3,1,3.4),masonry,.30)
            scenic_arch('Spring niche',side*4,21.4,2.65,1.05,2,.15,edge_stone)
            box('Spring wall cap',(side*4,22,5.9),(3.3,1.2,.28),edge_stone,.1)
        box('Spring weir',(0,22,3.85),(5.2,1,2.6),masonry,.14)
        cascade(0,21.4,5.15,4.6,2.3)
        for side in [-1,1]:
            for y in [-15,15]:
                box('Garden planter',(side*10,y,2.72),(2,1.6,.55),shadow_stone,.13)
                broadleaf(side*10,y,2.98,1.15,int(y+17))
`;
