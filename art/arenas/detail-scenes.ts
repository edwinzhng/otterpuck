export const detailScenes = `
if arena in ['tropical','city']:
    wood=dm('Palm bark');light=dm('Canvas');dark=dm('Terrace metal');accent=dm('Aqua cushions');green=dm('Palm green')
    if arena=='tropical':
        coral=dm('Coral flowers')
        for side in [-1,1]:
            x=side*4.4;y=-15.2
            dlathe('Umbrella pedestal',(x,y,2.45),[(.35,0),(.35,.12),(.10,.20),(.055,2.50)],wood)
            verts=[(x,y,5.30)];faces=[]
            for ring in range(2):
                for i in range(16):
                    a=i*math.tau/16;r=1.25 if ring==0 else 1.42
                    verts.append((x+r*math.cos(a),y+r*math.sin(a),4.88 if ring==0 else 4.67+.05*(i%2)))
            for i in range(16):faces.extend([(0,1+i,1+(i+1)%16),(1+i,17+i,17+(i+1)%16,1+(i+1)%16)])
            canopy=dmesh('Scalloped striped parasol',verts,faces,light,True);canopy.data.materials.append(accent if side<0 else coral)
            for p in canopy.data.polygons:p.material_index=(p.index//4)%2
            for dx in [-.7,.7]:
                dlathe('Beach stool',(x+dx,y-.15,2.45),[(.28,0),(.24,.48),(.38,.50),(.38,.64)],wood)
                doval('Beach stool cushion',(x+dx,y-.15,3.12),(.40,.40,.12),accent)
            for j in range(3):
                dbox('Folded beach towel',(side*10.5,-5.8,2.94+j*.075),(.55,.62,.075),coral if j==1 else light,.03)
            dbox('Poolside cooler',(side*9.2,11.4,2.74),(.65,.95,.58),accent,.08)
            dbox('Cooler lid',(side*9.2,11.4,3.06),(.71,1.01,.13),light,.05)
            dpot(side*9.3,-10.4,2.45,.85,dm('Planter ceramic'),green)
            dbeam('Rescue ring post',(side*12.4,13.7,2.45),(side*12.4,13.7,4.55),.10,wood)
            ring=dring('Rescue ring',(side*12.4,13.65,3.96),.41,.10,light,True)
            ring.data.materials.append(coral)
            for p in ring.data.polygons:p.material_index=int((p.index//24)%2==0)
    else:
        cyan=dm('Cyan ribbon');rose=dm('Rose ribbon');warm=dm('Warm lamp')
        for side in [-1,1]:
            x=side*4.2;y=15.4
            dbox('Rooftop juice bar',(x,y,3.02),(3.15,.85,1.15),dark,.07)
            dbox('Bar counter lip',(x,y,3.66),(3.35,1.04,.16),light,.05)
            dbox('Neon bar underline',(x,y-.441,3.39),(2.8,.025,.04),cyan if side<0 else rose,0)
            for dx in [-1,0,1]:
                dbeam('Bar stool stem',(x+dx,y-1.15,2.45),(x+dx,y-1.15,3.03),.12,dark)
                dlathe('Round bar stool',(x+dx,y-1.15,2.99),[(.31,0),(.34,.06),(.31,.16)],accent,10)
            dpot(x+side*1.23,y,3.75,.36,dm('Planter ceramic'),green)
            for dx in [-.45,.1]:dlathe('Lemonade tumbler',(x+dx,y-.08,3.76),[(.065,0),(.075,.22)],warm,8)
            dbox('Lounge rug',(side*10.5,3 if side<0 else -1,2.453),(2.85,3.8,.012),accent,0)
            for stripe in [-1,1]:dbox('Rug border',(side*10.5+stripe*1.25,3 if side<0 else -1,2.462),(.035,3.5,.01),light,0)

elif arena in ['alpine','forest']:
    wood=dm('Cedar lodge timber');trim=dm('Honey cedar trim');stone=dm('Blue granite');light=dm('Fresh blue-white snow' if arena=='alpine' else 'Granite lit planes');green=dm('Deep pine needles');warm=dm('Warm lodge windows')
    for side in [-1,1]:
        for y in [-7,7]:dbench(side*10.5,y,2.48,wood,trim,light if arena=='alpine' else None)
        for y in [-14,14]:dlantern(side*9.5,y,2.48,stone,warm)
    if arena=='alpine':
        for row in range(3):
            for col in range(4-row):
                x=-6.5+col*.36+row*.18;z=2.67+row*.32
                log=dlathe('Stacked firewood',(x,18.8,z),[(.14,0),(.16,.05),(.16,.70),(.14,.75)],wood,10);log.rotation_euler.x=math.pi/2
                end=dlathe('Firewood cut end',(x,18.03,z),[(0,0),(.125,0)],trim,10);end.rotation_euler.x=math.pi/2
        dbox('Ski rack crossbar',(-15.5,17.6,3.5),(2.1,.15,.16),wood)
        for x in [-16.4,-14.6]:dbeam('Ski rack leg',(x,17.6,2.44),(x,17.6,3.7),.13,wood)
        for j in range(4):
            ski=dbox('Rounded lodge ski',(-16.05+j*.37,17.3,3.50),(.16,.09,2.08),trim if j%2 else warm,.065);ski.rotation_euler.y=.10*(j-1.5)
            dbox('Ski binding',(-16.05+j*.37,17.24,3.35),(.19,.13,.25),stone,.025)
        for i in range(8):
            x=-15+i*.86;z=6.35-.36*math.sin(i*math.pi/7)
            dmesh('Lodge pennant',[(x,18.42,z),(x+.53,18.42,z-.025),(x+.28,18.41,z-.56)],[(0,1,2)],trim if i%2 else warm)
    else:
        berry=dm('Forest berry',(.74,.25,.15))
        for side in [-1,1]:
            for i,y in enumerate([-12,-4,4,12]):
                x=side*(14.6+.2*math.sin(i))
                for j in range(3):
                    px=x+(j-1)*.36;py=y+.25*math.sin(j*2);h=.28+.12*(j%2)
                    dlathe('Woodland mushroom stem',(px,py,2.45),[(.045,0),(.065,h)],trim,8)
                    doval('Velvet mushroom cap',(px,py,2.45+h),(.24,.21,.115),berry)
                dplant(x+side*.75,y+.7,2.44,1.0,green)
            for y in [-7,7]:
                dlathe('Spa towel basket',(side*9.2,y,2.48),[(.24,0),(.33,.48),(.31,.53)],wood)
                for j in range(3):doval('Rolled spa towel',(side*9.2+(j-1)*.15,y,3.02),(.07,.22,.08),light)
        for x,y in [(-9,15.3),(-5,15.7),(0,15.3),(4,15.8)]:doval('Garden stepping stone',(x,y,2.51),(.52,.38,.09),light)

elif arena=='ruins':
    stone=dm('Moss sandstone');light=dm('Weathered stone edges');dark=dm('Stone recesses');green=dm('Canopy deep green');tip=dm('Canopy yellow green')
    for side in [-1,1]:
        for index,y in enumerate([-10,-2,7,15]):
            x=side*13.4
            for j in range(9):
                z=6.2-j*.37;px=x+math.sin(j*.65+index)*.56;py=y-.66
                if j:dbeam('Trailing temple vine',previous,(px,py,z),.045,green)['wind_weight']=.035
                previous=(px,py,z)
                for direction in [-1,1]:dleaf('Heart-shaped vine leaf',(px,py,z),(direction,-.15,-.45),.41,.19,tip if j%3==0 else green)
            for j in range(3):
                block=dbox('Fallen carved stone',(side*11.5,y+1.4+j*.44,2.64),(.68,.55,.38),stone,.09);block.rotation_euler.z=j*.38
            doval('Velvet moss at column foot',(x,y,2.77),(.85,.84,.10),tip)
        for y in [-14,12]:
            x=side*10.5
            dlathe('Ancient garden urn',(x,y,2.45),[(.23,0),(.43,.18),(.55,.59),(.32,.98),(.28,1.14),(.34,1.20),(.25,1.20),(.23,1.0)],stone)
            dplant(x,y,3.48,.86,tip)
        for y in [-7,3,12]:
            for j in range(3):
                tile=dbox('Temple path inlay',(side*9.6,y+j*.48,2.455),(.52,.34,.012),light,0);tile.rotation_euler.z=.2
        for i in range(5):
            x=side*10.3+(i-2)*.32
            jewel=dbox('Guardian plinth carving',(x,19.99,3.14),(.22,.025,.22),dark,0);jewel.rotation_euler.y=math.pi/4

elif arena=='desert':
    clay=dm('Terracotta');light=dm('Sunlit plaster');wood=dm('Palm bark');green=dm('Canopy deep green')
    glaze=dm('Oasis teal glaze',(.065,.42,.44));glow=dm('Warm lamp',(.95,.48,.12),True)
    for side in [-1,1]:
        for index,y in enumerate([-7,0,7]):
            x=side*14.65
            dbox('Woven oasis rug',(x,y,2.455),(2.85,2.3,.012),glaze,0)
            for dx in [-1.22,1.22]:dbox('Woven border',(x+dx,y,2.467),(.06,2.10,.012),light,0)
            for j in [-1,0,1]:
                tile=dbox('Rug diamond',(x+j*.63,y,2.477),(.33,.33,.012),clay,0);tile.rotation_euler.z=math.pi/4
            dlantern(side*13.2,y,4.70,clay,glow)
            dbeam('Lantern suspension',(side*13.2,y,5.57),(side*13.2,y,6.20),.035,wood)
        for y in [-11,11]:
            for j in range(2):
                x=side*(10.7+j*.66);py=y+j*.36;s=1 if j==0 else .65
                pot=dlathe('Glazed amphora',(x,py,2.45),[(.23*s,0),(.39*s,.18*s),(.46*s,.57*s),(.31*s,.87*s),(.18*s,1.07*s),(.22*s,1.17*s),(.15*s,1.17*s),(.14*s,.97*s)],glaze if j==0 else clay)
                for edge in [-1,1]:
                    handle=dring('Amphora handle',(x+edge*.30*s,py,3.18 if j==0 else 2.94),.14*s,.035*s,light,True)
                dplant(x,py,2.45+1.1*s,.55*s,green)
        for y in [-7,0,7]:
            for x in [-.24,.24]:dbox('Bench woven pillow',(side*16.1+x,y,3.50),(.42,.75,.22),glaze,.09)

elif arena=='glacier':
    navy=dm('Structural navy');steel=dm('Rail steel');snow=dm('Polar snow');blue=dm('Station blue');amber=dm('Warm lamp')
    for x,y,w,length in [(20,-9,8,12),(21,8,9,15)]:
        front=x-w/2-.2
        for step in range(3):dbox('Station access step',(front-.8+step*.25,y,2.48+step*.13),(.55,1.8,.18),steel,.025)
        for side in [-1,1]:dbeam('Station entry rail',(front-1,y+side*.9,2.65),(front,y+side*.9,3.9),.06,steel)
        for index in range(3):
            px=front-.15;py=y+2+index*.7
            dlathe('Insulated supply barrel',(px,py,2.46),[(.23,0),(.27,.1),(.27,.7),(.23,.78)],blue)
            dring('Barrel pale band',(px,py,2.82),.275,.025,snow)
    for side in [-1,1]:
        for y in [-11,10]:
            x=side*14.8
            for a in [0,2.1,4.2]:dbeam('Survey tripod',(x+.48*math.cos(a),y+.48*math.sin(a),2.44),(x,y,3.65),.06,steel)
            dbox('Survey instrument',(x,y,3.72),(.43,.30,.24),amber,.045)
            dbeam('Survey flag pole',(x+.7,y,2.44),(x+.7,y,4.7),.045,navy)
            dmesh('Polar signal pennant',[(x+.7,y,4.7),(x+1.5,y,4.55),(x+.7,y,4.17)],[(0,1,2)],amber)
            dbox('Polar supply case',(side*10.5,y,2.68),(.92,.65,.46),blue,.06)
            for band in [-.3,.3]:dbox('Supply case strap',(side*10.5+band,y,2.68),(.055,.67,.48),snow,0)
        for i in range(7):doval('Wind-carved snow pillow',(side*(14.0+(i%2)*.5),-14+i*4.5,2.36),(1.2,.72,.27),snow)

elif arena=='terminal':
    navy=dm('Structural navy');steel=dm('Rail steel');yellow=dm('Safety yellow');red=dm('Container red');teal=dm('Container teal');rope=dm('Canvas')
    for side in [-1,1]:
        x=side*10.5;y=7.5 if side<0 else -6
        dbox('Harbor cargo trolley',(x,y,2.74),(1.4,2.0,.20),yellow,.07)
        for dx in [-.60,.60]:
            for dy in [-.7,.7]:
                wheel=dlathe('Trolley wheel',(x+dx,y+dy,2.66),[(.19,0),(.19,.12)],navy,10);wheel.rotation_euler.y=math.pi/2
        for j in range(3):dbox('Pallet slat',(x+(j-1)*.40,y,2.90),(.30,1.75,.12),rope,.015)
        for j in range(2):
            crate=dbox('Dock supply crate',(x,y+(j-.5)*.85,3.29),(.94,.74,.67),teal if j==0 else red,.045)
            for dx in [-.37,.37]:dbox('Crate binding',(x+dx,y+(j-.5)*.85,3.29),(.055,.76,.70),rope,0)
        for py in [-15,15]:
            for radius in [.28,.40,.52]:dring('Coiled mooring rope',(side*9.4,py,2.5),radius,.045,rope)
            ring=dring('Harbor rescue buoy',(side*12.68,py,3.12),.32,.09,red,True)
            ring.rotation_euler.z=math.pi/2
        for py in [-16.3,16.3]:
            for j in range(5):dbox('Loading bay paint',(side*(8.5+j*.7),py,2.467),(.40,.14,.016),yellow,0)
    for y in [-25,23]:
        dbox('Hoist spreader',(0,y,11.34),(3.2,1.2,.23),yellow,.05)
        for dx in [-1.3,1.3]:dbeam('Spreader sling',(dx,y,11.35),(0,y,13),.035,navy)
`;
