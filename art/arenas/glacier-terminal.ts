export const glacierTerminalPython = `
if arena in ['glacier','terminal']:
    navy=material('Structural navy',(.035,.09,.15),.65,.2)
    silver=material('Rail steel',(.27,.39,.48),.5,.4)
    amber=material('Warm lamp',(1,.54,.10),.35)
    shader=amber.node_tree.nodes['Principled BSDF'];shader.inputs['Emission Color'].default_value=(1,.38,.035,1);shader.inputs['Emission Strength'].default_value=2
    def beam(name,a,b,width,mat,bevel=.025):
        a=Vector(a);b=Vector(b)
        obj=box(name,(a+b)/2,(width,width,(b-a).length),mat,bevel)
        obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
        return obj
    def rails(x,y,length,along_x=False):
        for i in range(round(length/2)+1):
            offset=-length/2+i*length/round(length/2)
            px=x+offset if along_x else x;py=y if along_x else y+offset
            box('GuardrailPost',(px,py,2.98),(.10,.10,1.08),navy,.02)
        for z in [2.76,3.35]:
            box('Guardrail',(x,y,z),(length,.07,.07) if along_x else (.07,length,.07),silver,.02)
    for side in [-1,1]:
        rails(side*12.7,0,33)
        rails(0,side*17,24,True)
        for y in [-14,-7,7,14]:
            box('LampPost',(side*11.9,y,3.7),(.12,.12,2.5),navy,.025)
            box('LampHousing',(side*11.9,y,5),(.42,.42,.18),navy,.04)
            box('LampLight',(side*11.9,y,4.86),(.28,.28,.20),amber,.03)

if arena=='glacier':
    snow=material('Polar snow',(.83,.93,1))
    ice=material('Glacier blue',(.22,.57,.82),.4)
    ice_light=material('Ice edge',(.49,.79,.96),.4)
    station=material('Station blue',(.105,.23,.36),.6,.2)
    for side in [-1,1]:
        box('SnowShelfSide',(side*23,0,1.9),(20,73,.65),snow,.3)
        box('SnowShelfEnd',(0,side*27,1.9),(26,19,.65),snow,.3)
    for obj in list(scene.objects):
        if obj.name.startswith('Deck'):obj.data.materials[0]=snow
    for i in range(18):
        y=-35+i*4.1;x=-23-2*math.sin(i*.67);height=7+5*(.5+.5*math.sin(i*.79))
        verts=[(x-5,y-2,2),(x+3,y-2,2),(x+3,y+2,2),(x-5,y+2,2),(x-4,y-1.6,height),(x+1,y-1.2,height+1.5),(x+2,y+1.6,height-.3),(x-4,y+2,height+.7)]
        obj=mesh('GlacierRidge',verts,[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],ice)
        obj.data.materials.append(ice_light);obj.data.materials.append(snow)
        for p in obj.data.polygons:p.material_index=2 if p.index==4 else p.index%2
    for i,(x,y,w,length) in enumerate([(20,-9,8,12),(21,8,9,15),(8,25,12,7)]):
        box('StationModule',(x,y,4.2),(w,length,3.5),station,.18)
        box('SnowRoof',(x,y,6.06),(w+.4,length+.4,.25),snow,.12)
        for side in [-1,1]:
            for offset in [-.28,.28]:
                box('EndWindow',(x+w*offset,y+side*(length/2+.025),4.5),(1.3,.055,1),amber,.04)
            for offset in [-.32,0,.32]:
                box('OuterWindow',(x+w/2+.025,y+length*offset,4.5),(.055,1.25,1),amber,.04)
            box('WallPanelSeam',(x,y+side*(length/2+.03),3.35),(w-.2,.045,.045),silver)
        for offset in [-.32,0,.32]:
            box('StationWindow',(x-w/2-.025,y+length*offset,4.5),(.055,1.25,1.0),amber,.04)
        box('StationDoor',(x-w/2-.04,y,3.65),(.08,1.3,2.2),navy,.03)
        box('RadarBase',(x,y,6.55),(2.8,2.8,.8),silver,.1)
        dome=ellipsoid('RadarDome',(x,y,8.45),(2.1,2.1,2.1),snow,20,12)
        for z,r in [(7.35,1.79),(8.45,2.10),(9.5,1.82)]:
            for j in range(32):
                a=j*math.tau/32;b=(j+1)*math.tau/32
                beam('DomePanel',(x+r*math.cos(a),y+r*math.sin(a),z),(x+r*math.cos(b),y+r*math.sin(b),z),.028,silver,0)
        beam('Antenna',(x+3,y,6.2),(x+3,y,10.3),.08,silver)
        ellipsoid('Beacon',(x+3,y,10.3),(.12,.12,.15),amber)
        if i==2:
            for obj in list(scene.objects):
                if obj.name.startswith(('RadarDome','RadarBase','DomePanel')) and abs(obj.location.x-x)<3 and abs(obj.location.y-y)<3:
                    obj.location.z=6.2+(obj.location.z-6.2)*.65;obj.scale*=.65
    for side in [-1,1]:
        for i in range(10):
            obj=ellipsoid('IceBoulder',(side*(14.2+(i%3)*.6),-16+i*3.5,2.5),(.8+.3*(i%2),1.1,.65),ice_light,8,5)

if arena=='terminal':
    concrete=material('Dock concrete',(.32,.39,.43))
    yellow=material('Safety yellow',(.98,.65,.07))
    red=material('Container red',(.65,.12,.075),.65,.1)
    blue=material('Container blue',(.035,.24,.49),.65,.1)
    teal=material('Container teal',(.035,.38,.37),.65,.1)
    crane=material('Crane blue',(.055,.22,.37),.65,.3)
    for side in [-1,1]:
        box('WharfSide',(side*15.6,0,1.85),(5.2,54,1),concrete,.1)
        box('WharfEnd',(0,side*22,1.85),(26,9,1),concrete,.1)
    for obj in list(scene.objects):
        if obj.name.startswith('Deck'):obj.data.materials[0]=concrete
    def container(x,y,z,mat):
        box('FreightContainer',(x,y,z+1.3),(2.6,6.1,2.6),mat,.08)
        for side in [-1,1]:
            for j in range(15):
                box('Corrugation',(x+side*1.32,y-2.8+j*.40,z+1.3),(.055,.075,2.38),mat)
            for dx in [-.6,.6]:
                box('DoorLock',(x+dx,y+side*3.07,z+1.3),(.055,.055,2.1),silver)
        for dx in [-1.24,1.24]:
            for dy in [-2.98,2.98]:box('CornerCasting',(x+dx,y+dy,z+2.49),(.18,.18,.18),silver)
    colors=[blue,red,yellow,teal]
    for i in range(5):
        for level in range(2+(i%2)):
            container(-16,-16+i*6.3,2.45+level*2.64,colors[(i+level)%4])
    # Ship hull is outside the wharf; pool access remains clear.
    hull=mesh('CargoHull',[(19,-25,0),(29,-25,0),(30,17,0),(24,26,0),(18,17,0),(18,-25,8),(31,-25,8),(31,17,8),(24,28,8),(17,17,8)],[(0,1,6,5),(1,2,7,6),(2,3,8,7),(3,4,9,8),(4,0,5,9),(5,6,7,8,9)],navy)
    box('HullWaterline',(18,-5,1.1),(.3,38,2.0),red)
    for row in range(4):
        for level in range(2):
            container(22,-19+row*6.3,8.05+level*2.64,colors[(row+level)%4])
    box('Bridge',(25,-23,11),(7,4,6),white,.2)
    box('BridgeGlass',(21.45,-23,12),(.1,3.2,1.4),blue,.03)
    for y in [23,-25]:
        for x in [-11,11]:
            beam('CraneLeg',(x,y,2.5),(x*.8,y,18),.65,crane)
        box('CraneGantry',(0,y,18),(28,1.3,1.4),crane,.12)
        for x in [-10,-5,0,5,10]:
            beam('GantryBrace',(x,y,18.7),(x+3,y,20.6),.18,crane)
        box('CraneTop',(0,y,20.6),(28,.35,.35),crane)
        for x in [-1.1,1.1]:beam('HoistCable',(x,y,17.4),(x,y,11),.035,navy)
        container(0,y,8.4,red)
    for side in [-1,1]:
        for i in range(18):
            box('HazardStripe',(side*12.4,-15+i*1.8,2.465),(.5,.85,.035),yellow)
        for y in [-15,15]:
            box('BollardBase',(side*10.5,y,2.55),(.8,.8,.2),navy,.08)
            box('Bollard',(side*10.5,y,2.95),(.38,.38,.65),yellow,.12)
`;
