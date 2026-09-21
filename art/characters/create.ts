import { join } from "node:path";
import { CHARACTER_SPECIES, type CharacterSpecies } from "../../src/characters";
import { continuousPython } from "./continuous";
import { geometryPython } from "./geometry";
import { rigPython } from "./rig";
import { stylePython } from "./style";
import {
  organizationPython,
  wearableEquipmentPython,
} from "./wearable-equipment";

export const characterPython = (species: CharacterSpecies): string => `
${geometryPython}
species=${JSON.stringify(species)}
beaver=species=='beaver'
raccoon=species=='raccoon'
crocodile=species=='crocodile'
puffin=species=='puffin'
dolphin=species=='dolphin'
penguin=species in ['penguin','puffin']
walrus=species=='walrus'
compact=raccoon or crocodile or penguin or walrus or dolphin
scene=bpy.data.scenes.new('OTTERPUCK '+species.title())
bpy.context.window.scene=scene
collection=bpy.data.collections.new(species.title()+' Character');scene.collection.children.link(collection)
scene.unit_settings.system='METRIC'
scene['reference']='Eight-animal reference sheet, '+species+' standing and swimming' if compact else 'Latest slim beaver and otter sheet, 2026-09-07'
${rigPython}
${wearableEquipmentPython}
fur_rgb=(.31,.131,.056) if beaver else (.36,.17,.065)
cream_rgb=(.65,.37,.17) if beaver else (.91,.78,.54)
if raccoon:fur_rgb=(.25,.235,.205);cream_rgb=(.83,.79,.68)
if crocodile:fur_rgb=(.28,.43,.065);cream_rgb=(.86,.72,.31)
if penguin:fur_rgb=(.045,.060,.086);cream_rgb=(.94,.88,.73)
if walrus:fur_rgb=(.050,.085,.170);cream_rgb=(.075,.115,.215)
if dolphin:fur_rgb=(.22,.60,.79);cream_rgb=(.88,.95,.94)
coat=color('Fur',(1,1,1),.8)
vc=coat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Coat'
coat.node_tree.links.new(vc.outputs['Color'],coat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
fur=color('Paw fur',fur_rgb,.76)
red_team=beaver or crocodile or penguin
team=color('Team',(.60,.025,.036) if red_team else (.025,.18,.53),.85)
cap_mat=color('Cap',(.60,.025,.036) if red_team else (.025,.18,.53),.85)
seam=color('Team seam',(.82,.084,.090) if red_team else (.047,.33,.72),.85)
rubber=color('Rubber',(.006,.013,.017),.56)
nose_mat=color('Nose',(.030,.017,.012),.44)
eye_mat=color('Eyes',(.002,.008,.009),.28)
highlight=color('Eye highlight',(.93,.99,1),.2)
mouth_mat=color('Mouth',(.10,.039,.014),.8)
mitt=color('Mitten',(.82,.83,.80) if beaver or penguin or walrus else (.53,.82,.93),.60)
white=color('Cap number',(.97,.96,.89),.5)
lens=color('Lens',(.18,.16,.14) if beaver else (.10,.20,.24),.30,.05,.20)
lens_shader=lens.node_tree.nodes['Principled BSDF']
lens_shader.inputs['Coat Weight'].default_value=.08
lens_shader.inputs['Coat Roughness'].default_value=.20
lens['otterpuck_visor']='tinted-mirror'
lens.use_backface_culling=True
inner_ear=color('Ear inner',(.22,.075,.032) if beaver else (.29,.117,.045),.83)
if raccoon:inner_ear.diffuse_color=(.035,.032,.028,1);inner_ear.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.035,.032,.028,1)

def blend(a,b,t):return tuple(a[i]*(1-t)+b[i]*t for i in range(3))
sections=[(-.235,.008,.012,.005),(-.215,.062,.060,0),(-.185,.099,.088,-.006),(-.135,.123,.105,-.007),(-.075,.130,.112,-.002),(-.015,.126,.111,.004),(.045,.119,.104,.010),(.100,.110,.099,.016),(.145,.092,.087,.022),(.18,.074,.070,.026),(.215,.045,.041,.030),(.230,.01,.010,.030)]
def body_section(y,rx,rz,cz):
    if dolphin:
        taper=.55+.45*smooth(-.235,-.015,y)
        return (y,rx*taper,rz*taper,cz)
    if penguin:return (y,rx*(1.10-.20*smooth(-.05,.16,y)),rz*1.08,cz)
    if walrus:return (y,rx*(1.95-.20*smooth(-.06,.16,y)),rz*1.48,cz)
    fullness=math.exp(-((y+.055)/.16)**4) if beaver else 0
    haunch=math.exp(-((y+.145)/.075)**2) if beaver else 0
    width=1.035+.145*fullness+.14*haunch if beaver else 1
    return (y,rx*width*.95,rz*(1+.12*fullness+.15*haunch),cz+.006*haunch)
body_sections=[body_section(*section) for section in sections]
if dolphin:
    body_sections=[(-.410,.002,.003,.057),(-.395,.007,.007,.057),(-.35,.018,.016,.051),(-.31,.026,.024,.040),(-.27,.037,.033,.029),(-.23,.049,.043,.018),(-.195,.062,.056,.009),(-.155,.078,.073,.002)]+[s for s in body_sections if s[0]>-.155]
body=loft('Body',body_sections,coat)
soften(body,2)
def belly_color(p):
    boundary=-.047+.015*math.cos((p.y+.02)*9)
    shape=(p.x/(.113 if penguin else .096 if not beaver else .105))**2+((p.y+.005)/(.255 if penguin else .215))**2
    marking=(1-smooth(.95,1.03,shape))*(1-smooth(boundary-.009,boundary+.002,p.z))
    shade=.94+.06*smooth(-.16,.09,p.z)
    return tuple(c*shade for c in blend(fur_rgb,cream_rgb,marking))
paint(body,belly_color)
spine_nodes=[(-.20,'pelvis'),(-.09,'spine'),(.015,'spineMid'),(.115,'chest'),(.20,'neck')]
skin(body,lambda p:chain(p.y,spine_nodes))
if dolphin:
    body.vertex_groups.clear()
    skin(body,lambda p:chain(p.y,[(-.403,'tail05'),(-.361,'tail04'),(-.319,'tail03'),(-.277,'tail02'),(-.235,'tail01'),(-.155,'pelvis')]+spine_nodes[1:]))

def head_width(z):
    return .151*(1+(.38 if raccoon else .02 if penguin else .20)*math.exp(-((z+.035)/.046)**2))*(1.025 if beaver else 1.08 if walrus else 1)
def face_surface(u,v,muzzle=True):
    s=math.sin(v);front=math.cos(u)
    z=.018+math.cos(v)*(.116 if math.cos(v)>0 else (.067 if raccoon else .074 if penguin else .088))
    x=math.sin(u)*s*head_width(z)
    y=.302+front*s*.122
    forward=max(0,front)**5
    cheek=sum(math.exp(-((x-side*.043)/.043)**2-((z+.023)/.024)**2) for side in [-1,1])
    chin=math.exp(-(x/.070)**2-((z+.051)/.028)**2)
    if walrus:
        cheek=sum(math.exp(-((x-side*.043)/.041)**2-((z+.025)/.028)**2) for side in [-1,1])
        y+=forward*(.029*cheek+.006*chin)
    elif dolphin:y+=forward*(.008*cheek+.006*chin)
    elif not penguin:y+=forward*((.015 if beaver else .012)*cheek+.009*chin)
    return (x,y,z)
head=uv_surface('Head',face_surface,coat,48,32)
soften(head,1)
if crocodile or dolphin:
    sections=[(.345,.097,.033,-.032),(.395,.121,.038,-.033),(.465,.111,.040,-.024),(.510,.095,.043,-.011),(.535,.067,.027,-.010),(.542,.016,.010,-.009)] if crocodile else [(.365,.093,.033,-.026),(.410,.081,.030,-.026),(.450,.063,.026,-.025),(.481,.043,.020,-.021),(.501,.03105,.014,-.016),(.510,.0161,.009,-.012),(.514,.00345,.003,-.010)]
    snout=loft('Snout',sections,coat,40)
    soften(snout,2)
    bpy.ops.object.select_all(action='DESELECT');head.select_set(True);snout.select_set(True)
    bpy.context.view_layer.objects.active=head
    bpy.ops.object.join();head.data.remesh_voxel_size=.0035
    bpy.ops.object.voxel_remesh()
    relax=head.modifiers.new('Joined snout transitions','SMOOTH');relax.factor=.65;relax.iterations=3;bpy.ops.object.modifier_apply(modifier=relax.name)
    reduce=head.modifiers.new('Head surface density','DECIMATE');reduce.ratio=.18;bpy.ops.object.modifier_apply(modifier=reduce.name)
    for poly in head.data.polygons:poly.use_smooth=True
    from mathutils.bvhtree import BVHTree
    snout_tree=BVHTree.FromPolygons([v.co for v in head.data.vertices],[list(p.vertices) for p in head.data.polygons])
def face_front(x,z,muzzle=True):
    if (crocodile or dolphin) and muzzle:
        hit=snout_tree.ray_cast(Vector((x,.8,z)),Vector((0,-1,0)))
        if hit[0] is not None:return hit[0].y
    v=math.acos(max(-.99,min(.99,(z-.018)/(.116 if z>.018 else (.067 if raccoon else .074 if penguin else .088)))))
    width=math.sin(v)*head_width(z)
    u=math.asin(max(-.99,min(.99,x/width)))
    return face_surface(u,v,muzzle)[1]
def face_color(p):
    if dolphin:return blend(fur_rgb,cream_rgb,(1-smooth(-.030,-.007,p.z))*smooth(.31,.38,p.y))
    cheek=((abs(p.x)-.039)/.045)**2+((p.z+.022)/.030)**2
    chin=(p.x/.055)**2+((p.z+.043)/.022)**2
    marking=(1-smooth(.84,1.08,min(cheek,chin)))*smooth(.32,.375,p.y)
    shade=.95+.05*smooth(-.11,.10,p.z)
    face_cream=(.77,.55,.29) if beaver else (.95,.85,.65)
    if crocodile:return blend(fur_rgb,cream_rgb,(1-smooth(-.030,-.023,p.z))*smooth(.29,.34,p.y))
    if walrus:
        lobes=((abs(p.x)-.043)/.040)**2+((p.z+.023)/.027)**2
        return blend(fur_rgb,(.87,.72,.48),(1-smooth(.80,1.12,lobes))*smooth(.35,.395,p.y))
    if penguin:
        boundary=-.009+.063*math.exp(-((abs(p.x)-.067)/.045)**2)
        cheek_limit=(p.x/.135)**2+((p.z+.009)/.077)**2
        marking=(1-smooth(boundary-.008,boundary+.006,p.z))*(1-smooth(.84,1.10,cheek_limit))*smooth(.28,.345,p.y)
        return blend(fur_rgb,cream_rgb,marking)
    if raccoon:
        face_cream=(.87,.83,.74)
        lobes=((abs(p.x)-.057)/.074)**2+((p.z+.019)/.034)**2
        chin=(p.x/.053)**2+((p.z+.035)/.024)**2
        marking=(1-smooth(.8,1.15,min(lobes,chin)))*smooth(.27,.32,p.y)
        mask=((abs(p.x)-.087)/.087)**2+((p.z-.028)/.039)**2
        dark=(1-smooth(.75,1.15,mask))*smooth(.27,.34,p.y)
        return blend(blend(fur_rgb,face_cream,marking),(.027,.025,.022),dark)
    return tuple(c*shade for c in blend(fur_rgb,face_cream,marking))
paint(head,face_color);rigid(head,'head')
for side,suffix in [(-1,'L'),(1,'R')]:
    if raccoon:
        ear=uv_surface('Ear'+suffix,lambda u,v:(side*(.136+.008*math.cos(v))+math.sin(u)*math.sin(v)*(.043-.008*math.cos(v)),.282+math.cos(u)*math.sin(v)*.023,.108+math.cos(v)*.054),coat,24,16)
        paint(ear,lambda p:blend(fur_rgb,cream_rgb,smooth(.115,.138,p.z)));rigid(ear,'head')
        inset=uv_surface('EarInset'+suffix,lambda u,v:(side*.140+math.sin(u)*math.sin(v)*(.027-.005*math.cos(v)),.302+math.cos(u)*math.sin(v)*.004,.118+math.cos(v)*.025),inner_ear,20,14);rigid(inset,'head')
    elif not crocodile and not penguin and not walrus and not dolphin:
        ear=oval('Ear'+suffix,(side*.146,.302,.043),(.021,.022,.023),fur,'head',20,12)
        oval('EarInset'+suffix,(side*.161,.312,.046),(.011,.006,.013),inner_ear,'head',16,12)
    x=side*.058;eye_y=face_front(x,.037,not crocodile)+.002
    if penguin or crocodile or dolphin:
        oval('EyeWhite'+suffix,(x,eye_y,.037),(.028,.008,.022),white,'head',24,16)
        iris=oval('Iris'+suffix,(x,eye_y+.006,.037),(.023,.004,.019),coat,'head',24,16)
        paint(iris,lambda p:(.065,.35,.46) if penguin or dolphin else (.24,.39,.095))
        oval('Eye'+suffix,(x,eye_y+.009,.037),(.024 if dolphin else .014,.003,.022 if dolphin else .014),eye_mat,'head',20,14)
        oval('EyeLight'+suffix,(x-side*.005,eye_y+.012,.044),(.005,.0015,.005),highlight,'head',12,8)
    else:
        oval('Eye'+suffix,(x,eye_y,.037),(.021,.008,.017),eye_mat,'head',24,16)
        oval('EyeLight'+suffix,(x-side*.005,eye_y+.0085,.043),(.0045,.0015,.0038),highlight,'head',12,8)
    eyelid_points=[(x+side*dx,face_front(x+side*dx,.037+dz,not crocodile)+.006,.037+dz) for dx,dz in [(-.023,.005),(-.012,.014),(.004,.016),(.022,.008)]]
    eyelid=sweep('UpperLid'+suffix,catmull(eyelid_points,4),.0035,fur,8);rigid(eyelid,'head')
nose_y=face_front(0,0)+.009
if penguin:
    beak_mat=color('Beak',(.98,.48,.035),.65)
    beak=uv_surface('Beak',lambda u,v:(math.sin(u)*math.sin(v)*.032*(1-.45*math.cos(v)),.424+math.cos(u)*math.sin(v)*.034,-.009+math.cos(v)*.017),beak_mat,24,16)
    soften(beak,1);rigid(beak,'head')
    bill_line=sweep('BillSeam',catmull([(-.026,.438,-.013),(-.014,.451,-.019),(0,.452,-.021),(.014,.451,-.019),(.026,.438,-.013)],5),.0009,mouth_mat,6);rigid(bill_line,'head')
elif crocodile:
    for side in [-1,1]:
        nostril=snout_tree.ray_cast(Vector((side*.057,.507,.2)),Vector((0,0,-1)))[0]
        oval('Nostril'+str(side),(nostril.x,nostril.y,nostril.z+.001),(.007,.008,.002),nose_mat,'head',16,10)
elif not dolphin:
    nose=uv_surface('Nose',lambda u,v:(math.sin(u)*math.sin(v)*(.028 if beaver else .025)*(.94+.10*math.cos(v)),nose_y+math.cos(u)*math.sin(v)*.010,math.cos(v)*.010),nose_mat,24,16)
    rigid(nose,'head')
mouth_width=.108 if crocodile else .050
mouth_points=[(-1,-.022),(-.5,-.025),(0,-.026),(.5,-.025),(1,-.022)] if beaver else [(-1,-.020),(-.75,-.028),(-.38,-.030),(0,-.022),(.38,-.030),(.75,-.028),(1,-.020)]
if crocodile:mouth_points=[(-1,-.019),(-.8,-.031),(0,-.034),(.8,-.031),(1,-.019)]
if walrus:mouth_points=[(-1,-.037),(-.5,-.040),(0,-.034),(.5,-.040),(1,-.037)]
if dolphin:
    mouth_width=.055
    mouth_points=[(-1,-.014),(-.65,-.022),(0,-.027),(.65,-.022),(1,-.014)]
mouth_path=catmull([(x*mouth_width,face_front(x*mouth_width,z)+.004,z) for x,z in mouth_points],5)
if not penguin:
    smile=sweep('Smile',mouth_path,.0013,mouth_mat,8);rigid(smile,'head')
mouth_center=-.026 if beaver else -.022
if not crocodile and not penguin and not dolphin:
    philtrum=sweep('Muzzle line',catmull([(0,face_front(0,z)+.004,z) for z in [-.008,-.016,mouth_center]],5),.0012,mouth_mat,8);rigid(philtrum,'head')
if beaver:
    for side in [-1,1]:
        vertices=[(side*.010+x,face_front(side*.010+x,-.0295+z)+.009+y,-.0295+z) for x in [-.009,.009] for y in [-.002,.002] for z in [-.0055,.0055]]
        tooth=mesh('Incisor'+str(side),vertices,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],white)
        bevel=tooth.modifiers.new('Rounded tooth edges','BEVEL');bevel.width=.002;bevel.segments=3
        rigid(tooth,'head')
if crocodile:
    for x in [-.080,.080]:
        z=-.031
        tooth=mesh('SmallTooth'+str(x),[(x-.004,face_front(x-.004,z)+.002,z+.002),(x+.004,face_front(x+.004,z)+.002,z+.002),(x,face_front(x,z-.003)+.002,z-.003)],[(0,1,2)],white)
        rigid(tooth,'head')
if walrus:
    ivory=color('Ivory',(.96,.89,.69),.55)
    for side in [-1,1]:
        x=side*.048;y=face_front(x,-.038)+.003
        path=catmull([(x,y,-.035),(x+side*.003,y+.019,-.065),(x-side*.003,y+.024,-.097),(x-side*.010,y+.010,-.129)],8)
        tusk=sweep('Tusk'+str(side),path,lambda t:.0125*(1-t)**.6+.0006,ivory,12);rigid(tusk,'head')
        for index in range(3):
            x=side*(.048+index*.008);z=-.020-index*.007
            points=catmull([(x,face_front(x,z)+.002,z),(side*(.093+index*.012),.425,z-.005),(side*(.115+index*.010),.412,z-.018)],5)
            whisker=sweep('Whisker'+str(side)+'-'+str(index),points,.00065,ivory,5);rigid(whisker,'head')

create_cap(face_surface, '7' if beaver else '3', cap_mat, seam, white, 1.14 if walrus else 1)
create_mask((lambda x,z:face_front(x,z,False)) if crocodile or dolphin else face_front, face_surface, rubber, lens, 1.08 if walrus else 1)
create_snorkel(face_front, rubber, seam, -.130 if crocodile else -.105 if walrus else -.095 if beaver else -.085, .017 if compact else .014, .148 if compact else .162)

for side,suffix in [(-1,'L'),(1,'R')]:
    arm_path=catmull([(side*.075,.098,.002),(side*.115,.110,-.017),(side*.153,.157,-.051),(side*.166,.199,-.077),(side*.164,.238,-.095)],6)
    flipper=penguin or dolphin
    if flipper:
        arm_path=catmull([(side*.075,.098,.002),(side*.111,.124,-.023),(side*.143,.162,-.052),(side*.160,.202,-.077),(side*.164,.238,-.095)],6)
    arm=sweep('GripPaw'+suffix+'Arm',arm_path,lambda t:(.048*(1-t)+.024*t+.008*math.sin(math.pi*t)) if flipper else .043-(.018 if walrus else .010)*t+.014*math.sin(math.pi*t)**2,fur,20,flatten=.32 if flipper else 1)
    if walrus:
        for vertex in arm.data.vertices:
            center=min(arm_path,key=lambda p:(p-vertex.co).length_squared)
            vertex.co.x=center.x+(vertex.co.x-center.x)*1.25
            vertex.co.z=center.z+(vertex.co.z-center.z)*.60
    soften(arm,1)
    def arm_weights(p):
        root=smooth(.065,.135,abs(p.x));elbow=smooth(.115,.220,p.y);wrist=smooth(.205,.250,p.y)
        return [('chest',1-root),('arm.'+suffix,root*(1-elbow)),('forearm.'+suffix,root*elbow*(1-wrist)),('paw.'+suffix,root*elbow*wrist)]
    skin(arm,arm_weights)
    def paw_surface(u,v):
        return (side*.164+math.sin(u)*math.sin(v)*.041*(1+.08*math.cos(v)),.246+math.cos(v)*.049,-.095+math.cos(u)*math.sin(v)*.034)
    if flipper:
        paw=loft('GripPaw'+suffix,[(.222,.025,.010,-.090),(.246,.023,.009,-.095),(.269,.014,.007,-.097),(.292,.002,.003,-.098)],fur,24)
        for vertex in paw.data.vertices:vertex.co.x+=side*.164
    else:paw=uv_surface('GripPaw'+suffix,paw_surface,fur,24,18)
    rigid(paw,'paw.'+suffix)
    if walrus:
        for vertex in paw.data.vertices:
            vertex.co.x=side*.164+(vertex.co.x-side*.164)*(.70 if walrus else .62)
            vertex.co.z=-.095+(vertex.co.z+.095)*.5
    if raccoon:paint(paw,lambda p:(.055,.050,.043))
    create_mitten(side, suffix, mitt)
    wrist=oval('GripPaw'+suffix+'Wrist',(side*.164,.230,-.091),(.036,.025,.032),fur,'paw.'+suffix,20,14)
    if penguin or walrus or dolphin:
        for vertex in wrist.data.vertices:
            vertex.co.z=-.091+(vertex.co.z+.091)*.55
            vertex.co.x=side*.164+(vertex.co.x-side*.164)*(.78 if walrus else .72)
    create_cuff(side, suffix, team)
    leg_path=catmull([(side*.071,-.161,-.003),(side*.087,-.215,-.008),(side*.102,-.280,-.007),(side*.105,-.333,0)],6)
    leg=sweep('HindLeg'+suffix,leg_path,lambda t:(.024-.008*t) if puffin else .053+.009*math.sin(t*math.pi)-.016*t,fur,24);soften(leg,1)
    if penguin:paint(leg,lambda p:blend(fur_rgb,(.92,.39,.035),smooth(-.25,-.30,p.y)))
    skin(leg,lambda p:chain(-p.y,[(.171,'pelvis'),(.22,'thigh.'+suffix),(.305,'shin.'+suffix),(.329,'foot.'+suffix)]))
    if dolphin:bpy.data.objects.remove(leg,do_unlink=True)
    else:create_fin(side, suffix, team, seam)

if dolphin:
    tail_sections=[(-.155,.078,.073,.002),(-.195,.062,.056,.009),(-.23,.049,.043,.018),(-.27,.037,.033,.029),(-.31,.026,.024,.040),(-.35,.018,.016,.051),(-.395,.007,.007,.057),(-.410,.002,.003,.057)]
elif penguin or walrus:
    tail_sections=[(-.195,.042,.024,.025),(-.23,.037,.020,.030),(-.265,.018,.012,.034),(-.28,.002,.002,.034)]
elif crocodile:
    tail_sections=[(-.195,.065,.048,.020),(-.25,.074,.059,.045),(-.32,.066,.054,.072),(-.40,.048,.043,.098),(-.48,.028,.028,.116),(-.55,.006,.008,.132)]
elif raccoon:
    tail_sections=[(-.195,.040,.032,.018),(-.23,.056,.045,.040),(-.28,.075,.064,.080),(-.34,.085,.074,.120),(-.40,.077,.071,.145),(-.46,.062,.059,.153),(-.50,.039,.040,.156),(-.525,.006,.007,.156)]
elif not beaver:
    tail_sections=[(-.195,.043,.033,.018),(-.22,.039,.031,.025),(-.25,.035,.027,.035),(-.29,.028,.022,.046),(-.33,.021,.016,.054),(-.365,.014,.010,.059),(-.392,.007,.006,.061),(-.406,.002,.003,.061)]
else:
    tail_sections=[(-.205,.030,.021,.024),(-.230,.027,.017,.039),(-.255,.031,.014,.052),(-.28,.055,.013,.062),(-.31,.072,.012,.068),(-.35,.074,.011,.071),(-.388,.064,.009,.073),(-.413,.043,.007,.074),(-.425,.019,.004,.074),(-.428,.001,.0015,.074)]
if compact:
    tail_sections=[tuple(a[k]+(b[k]-a[k])*step/8 for k in range(4)) for a,b in zip(tail_sections,tail_sections[1:]) for step in range(8)]+[tail_sections[-1]]
tail=loft('Tail',tail_sections,coat,28);soften(tail,1)
def tail_color(p):
    shade=1
    if raccoon:
        ring=.5+.5*math.cos((p.y+.215)/.078*math.tau)
        return blend((.055,.050,.043),(.64,.60,.51),smooth(.36,.64,ring))
    if beaver:
        grid1=abs(((p.x*17+p.y*13)%1)-.5)
        grid2=abs(((p.x*17-p.y*13)%1)-.5)
        shade=1-.30*(1-smooth(.08,.16,min(grid1,grid2)))*smooth(-.001,.022,p.z)*smooth(-.238,-.270,p.y)
    return tuple(c*shade for c in (fur_rgb if not beaver else (.125,.045,.019)))
paint(tail,tail_color);skin(tail,lambda p:chain(-p.y,[(.215+i*(.067 if crocodile else .062 if raccoon else .042),'tail%02d'%(i+1)) for i in range(5)]))
if dolphin:
    bpy.data.objects.remove(tail,do_unlink=True)
if crocodile:
    for index,(y,z,radius) in enumerate([(.08,.110,.025),(.01,.123,.027),(-.06,.121,.027),(-.13,.105,.026),(-.185,.084,.024),(-.235,.103,.025),(-.29,.125,.024),(-.35,.149,.023),(-.42,.165,.018),(-.49,.157,.012)]):
        scute=uv_surface('DorsalScute'+str(index),lambda u,v:(math.sin(u)*math.sin(v)*radius*(1-.50*math.cos(v)),y+math.cos(u)*math.sin(v)*radius*1.5*(1-.50*math.cos(v)),z-radius*.8+math.cos(v)*radius*1.4),coat,16,12)
        if y<-.20:scute['asset_part']='Tail'
        paint(scute,lambda p:(.18,.29,.045))
        skin(scute,lambda p:chain(p.y,spine_nodes) if p.y>-.20 else chain(-p.y,[(.215+i*.067,'tail%02d'%(i+1)) for i in range(5)]))
if walrus:
    for obj in collection.objects:
        if obj.type=='MESH' and obj.name.startswith('GripPaw'):
            side=-1 if obj.name.startswith('GripPawL') else 1
            for vertex in obj.data.vertices:vertex.co.x+=side*.040
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for side,suffix in [(-1,'L'),(1,'R')]:
        for name in ['arm','forearm','paw']:
            b=armature.edit_bones[name+'.'+suffix];b.head.x+=side*.040;b.tail.x+=side*.040
        armature.edit_bones['shoulder.'+suffix].tail.x+=side*.040
    bpy.ops.object.mode_set(mode='OBJECT')
if puffin:
    # A tall compressed bill, rather than the penguin's short rounded beak.
    for obj in list(collection.objects):
        if obj.name in ['Beak','BillSeam']:bpy.data.objects.remove(obj,do_unlink=True)
    orange=color('Puffin bill',(.98,.27,.035),.55)
    yellow=color('Puffin bill band',(1,.65,.08),.55)
    bill=loft('PuffinBill',[(.393,.016,.033,.004),(.423,.025,.040,.010),(.459,.027,.030,.001),(.497,.019,.018,-.010),(.530,.002,.003,-.025)],orange,32)
    rigid(bill,'head')
    bill_tip=color('Puffin bill tip',(.93,.075,.025),.55)
    bill.data.materials.append(bill_tip)
    for poly in bill.data.polygons:
        if poly.center.y>.465:poly.material_index=1
    for side in [-1,1]:
        band=sweep('BillBand'+str(side),catmull([(side*.007,.448,.039),(side*.021,.458,.025),(side*.028,.465,.004),(side*.023,.460,-.018),(side*.007,.448,-.029)],5),.0025,yellow,8);rigid(band,'head')
if dolphin:
    outline=catmull([(0,.110,.045),(0,.078,.110),(0,.003,.190),(0,-.090,.222),(0,-.123,.214),(0,-.102,.183),(0,-.100,.132),(0,-.110,.045)],5,True)
    verts=[(side*.007,p.y,p.z) for side in [-1,1] for p in outline];n=len(outline)
    dorsal=mesh('DorsalFin',verts,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],fur)
    dorsal['asset_part']='Body';rigid(dorsal,'spine')
    fluke_outline=catmull([(0,-.342,.057),(.045,-.356,.057),(.095,-.393,.057),(.137,-.438,.057),(.129,-.449,.057),(.072,-.427,.057),(.020,-.410,.057),(0,-.403,.057),(-.020,-.410,.057),(-.072,-.427,.057),(-.129,-.449,.057),(-.137,-.438,.057),(-.095,-.393,.057),(-.045,-.356,.057)],4,True)
    n=len(fluke_outline)
    vertices=[(p.x,p.y,p.z+side*.009) for side in [-1,1] for p in fluke_outline]
    fluke=mesh('TailFluke',vertices,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],fur)
    fluke['asset_part']='Tail';rigid(fluke,'tail04')
${stylePython}
${continuousPython}
if crocodile:
    belly_tree=BVHTree.FromPolygons([v.co for v in body.data.vertices],[list(p.vertices) for p in body.data.polygons])
    for index,y in enumerate([-.105,-.065,-.025,.015,.055]):
        path=[]
        width=.067*math.sqrt(max(.1,1-(y/.17)**2))
        for step in range(25):
            x=width*(step/12-1);row=y+.010*(x/width)**2
            hit=belly_tree.ray_cast(Vector((x,row,-.3)),Vector((0,0,1)))
            if hit[0] is not None:path.append(hit[0]+Vector((0,0,-.001)))
        line=sweep('BellyPlate'+str(index),path,.0012,coat,6)
        paint(line,lambda p:(.62,.49,.18));skin(line,lambda p:chain(p.y/.76,spine_nodes))
face_tree=BVHTree.FromPolygons([v.co for v in head.data.vertices],[list(p.vertices) for p in head.data.polygons])
for obj in collection.objects:
    if obj.name not in ['Smile','Muzzle line'] and not obj.name.startswith('Incisor'):continue
    for vertex in obj.data.vertices:
        p=vertex.co;hit=face_tree.ray_cast(Vector((p.x,.8,p.z)),Vector((0,-1,0)))
        offset=.0015 if obj.name in ['Smile','Muzzle line'] else (.003 if vertex.index%4>=2 else -.001)
        if hit[0] is not None:vertex.co.y=hit[0].y+offset
if compact:
    # Compact the torso while retaining the head, hand sockets and full tail/fin lengths.
    rig['maxArmStretch']=1.35
    if walrus:rig['floorLift']=.085
    def compact_y(y):return y if y>=.10 else .10+(y-.10)*.75 if y>=-.20 else y+.075
    for obj in collection.objects:
        if obj.type=='MESH':
            for vertex in obj.data.vertices:vertex.co.y=compact_y(vertex.co.y)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    for b in armature.edit_bones:
        b.head.y=compact_y(b.head.y);b.tail.y=compact_y(b.tail.y)
    bpy.ops.object.mode_set(mode='OBJECT')
if penguin or walrus:
    def short_legs(y):return y if y>=-.10 else -.10+(y+.10)*.35 if y>=-.18 else y+.052
    for obj in collection.objects:
        if obj.type=='MESH':
            for vertex in obj.data.vertices:vertex.co.y=short_legs(vertex.co.y)
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for b in armature.edit_bones:b.head.y=short_legs(b.head.y);b.tail.y=short_legs(b.tail.y)
    bpy.ops.object.mode_set(mode='OBJECT')
animate()
for obj in collection.objects:
    if obj.type=='MESH':obj.data.name=obj.name+'Mesh'
for obj in collection.objects:
    part=obj.get('asset_part','')
    if part.endswith('LCuff') or part.endswith('LMitten') or part=='GripPawR':obj.hide_render=True;obj.hide_set(True)
scene.world=bpy.data.worlds.new('Soft studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.56,.70,.77,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.28
for name,pos,energy,size in [('Key',(-1.2,1.8,2.7),90,2.7),('Fill',(1.8,1.2,.8),30,2.2),('Rim',(.1,-1.5,1.7),65,1.8)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Character review');camera=bpy.data.objects.new('Character review',data);scene.collection.objects.link(camera)
camera.location=(.85,1.45,.62);camera.rotation_euler=(Vector((0,.04,.015))-camera.location).to_track_quat('-Z','Y').to_euler()
data.type='ORTHO';data.ortho_scale=1.14;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=1000;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
scene.render.image_settings.file_format='PNG'
scene['Notes']='Fresh character surfaces, integrated muzzle and painted markings. Same gameplay scale and sockets.'
bpy.context.view_layer.update()
${organizationPython}
bpy.data.libraries.write(${JSON.stringify(join(import.meta.dir, `${species}.blend`))},{scene},compress=True)
result={'species':species,'meshes':sum(o.type=='MESH' for o in collection.all_objects),'vertices':sum(len(o.data.vertices) for o in collection.all_objects if o.type=='MESH'),'bones':len(armature.bones),'blend':${JSON.stringify(join(import.meta.dir, `${species}.blend`))}}
`;

if (import.meta.main) {
  const species =
    CHARACTER_SPECIES.find((id): boolean => Bun.argv.includes(`--${id}`)) ??
    "otter";
  await Bun.write(
    join(import.meta.dir, `${species}-authoring.txt`),
    characterPython(species),
  );
  console.info(`Prepared Blender authoring for ${species}`);
}
