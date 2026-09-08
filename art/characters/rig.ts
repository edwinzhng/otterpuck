export const rigPython = `
armature=bpy.data.armatures.new(species.title()+'Rig')
rig=bpy.data.objects.new(species.title(),armature);collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=armature.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=armature.edit_bones[parent]
bone('pelvis',(0,-.18,0),(0,-.085,0))
bone('spine',(0,-.085,0),(0,.015,0),'pelvis')
bone('spineMid',(0,.015,0),(0,.10,.006),'spine')
bone('chest',(0,.10,.006),(0,.17,.012),'spineMid')
bone('neck',(0,.17,.012),(0,.22,.014),'chest')
bone('head',(0,.22,.014),(0,.42,.014),'neck')
for side,suffix in [(-1,'L'),(1,'R')]:
    bone('shoulder.'+suffix,(side*.07,.11,0),(side*.115,.10,-.012),'chest')
    bone('arm.'+suffix,(side*.115,.10,-.012),(side*.17,.157,-.060),'shoulder.'+suffix)
    bone('forearm.'+suffix,(side*.17,.157,-.060),(side*.164,.238,-.095),'arm.'+suffix)
    bone('paw.'+suffix,(side*.164,.238,-.095),(side*.164,.293,-.095),'chest')
    bone('thigh.'+suffix,(side*.089,-.168,0),(side*.102,-.275,-.007),'pelvis')
    bone('shin.'+suffix,(side*.102,-.275,-.007),(side*.105,-.325,0),'thigh.'+suffix)
    bone('foot.'+suffix,(side*.105,-.325,0),(side*.105,-.52,.008),'shin.'+suffix)
    bone('finTip.'+suffix,(side*.105,-.423,.006),(side*.105,-.548,.006),'foot.'+suffix)
    bone('tuft.'+suffix,(side*.13,.24,-.04),(side*.16,.21,-.06),'head')
tail_heights=[.030,.053,.066,.071,.073,.074] if beaver else [.038,.042,.042,.042,.042,.042]
for i in range(5):bone('tail%02d'%(i+1),(0,-.215-i*.042,tail_heights[i]),(0,-.257-i*.042,tail_heights[i+1]),'pelvis' if i==0 else 'tail%02d'%i)
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True
rig['species']=species
rig['asset_revision']='sculpt-02'
rig['stick_socket']='paw.R / paw.L; separate runtime stick'

def animate():
    rig.animation_data_create()
    kick_bases={b.name:b.matrix_local.to_quaternion() for b in rig.data.bones if b.name.startswith(('thigh.','shin.','foot.','finTip.'))}
    core=['pelvis','spine','spineMid','chest','neck','head']
    delays=[.26,.20,.14,.07,.025,0]
    def pulse(t,delay,width=.70):
        u=max(0,min(1,(t-delay)/width))
        return math.sin(u*math.pi)**1.6
    def arm_pose(suffix,offset,bank):
        arm=rig.pose.bones['arm.'+suffix];forearm=rig.pose.bones['forearm.'+suffix];paw=rig.pose.bones['paw.'+suffix]
        chest=rig.pose.bones['chest'];transform=chest.matrix @ chest.bone.matrix_local.inverted()
        shoulder=transform @ arm.bone.head_local
        target=transform @ (paw.bone.head_local+Vector(offset))
        length_a=arm.bone.length;length_b=forearm.bone.length
        direction=(target-shoulder).normalized();distance=min((target-shoulder).length,(length_a+length_b)*.985)
        end=shoulder+direction*distance
        side=-1 if suffix=='L' else 1
        pole=transform.to_quaternion() @ Vector((side*.8,-.2,-.6))
        pole=(pole-direction*pole.dot(direction)).normalized()
        along=(length_a**2-length_b**2+distance**2)/(2*distance)
        elbow=shoulder+direction*along+pole*math.sqrt(max(0,length_a**2-along**2))
        for pb,start,finish in [(arm,shoulder,elbow),(forearm,elbow,end)]:
            pb.matrix=Matrix.Translation(start) @ Vector((0,1,0)).rotation_difference((finish-start).normalized()).to_matrix().to_4x4()
            bpy.context.view_layer.update()
        paw.matrix=Matrix.Translation(end) @ (transform.to_quaternion() @ Quaternion((0,1,0),bank)).to_matrix().to_4x4()
        bpy.context.view_layer.update()
    for name,duration in [('Float',90),('Glide',72),('Swim',48),('Sprint',36),('SwimUp',48),('SwimDown',48),('Dive',60),('BankLeft',66),('BankRight',66),('Brake',48),('Reach',42)]:
        action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
        for frame in range(0,duration+1,2):
            t=frame/duration;phase=t*math.tau;envelope=math.sin(t*math.pi)**2
            is_bank=name.startswith('Bank');is_sprint=name=='Sprint'
            power=1.45 if is_sprint else 1 if name in ['Swim','SwimUp','SwimDown','Dive'] else .40 if is_bank else .055 if name=='Float' else .025
            for pb in rig.pose.bones:
                pb.rotation_mode='QUATERNION';pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0);pb.scale=(1,1,1)
            angles={};previous=(0,0,0)
            for index,n in enumerate(core):
                lag=(5-index)*.64
                pitch=math.sin(phase-lag)*([.12,.15,.13,.075,.035,.016][index])*power
                yaw=0;roll=0
                if name in ['SwimUp','SwimDown']:
                    pitch+=(1 if name=='SwimUp' else -1)*[.28,.39,.53,.65,.70,.72][index]
                if name=='Dive':
                    pitch-=[.94,1.02,1.10,1.15,1.17,1.18][index]*smooth(delays[index],delays[index]+.53,t)
                if is_bank:
                    direction=1 if name=='BankLeft' else -1
                    bend=pulse(t,delays[index],.66)
                    yaw=direction*[.35,.48,.61,.73,.80,.85][index]*bend
                    roll=direction*[.29,.38,.45,.47,.33,.23][index]*bend
                    pitch+=.05*bend
                if name=='Brake':pitch+=[-.14,-.06,.10,.21,.26,.22][index]*pulse(t,delays[index],.67)
                if name=='Reach':yaw=-[0,.025,.08,.15,.10,.06][index]*envelope
                angles[n]=(pitch-previous[0],roll-previous[1],yaw-previous[2]);previous=(pitch,roll,yaw)
            for side,suffix in [(0,'L'),(math.pi,'R')]:
                kick_phase=phase+side if is_bank else phase-3.58
                drive=math.sin(kick_phase+.35*math.sin(kick_phase))
                angles['thigh.'+suffix]=(drive*.32*power,0,0)
                angles['shin.'+suffix]=(math.sin(kick_phase-.65)*.19*power,0,0)
                angles['foot.'+suffix]=(math.sin(kick_phase-1.10)*.23*power,0,0)
                angles['finTip.'+suffix]=(math.sin(kick_phase-1.60)*.12*power,0,0)
                if name=='Brake':
                    flare=pulse(t,.06,.75);sign=-1 if suffix=='L' else 1
                    angles['thigh.'+suffix]=(-.34*flare,0,sign*.22*flare)
                    angles['shin.'+suffix]=(.32*flare,0,0);angles['foot.'+suffix]=(.40*flare,0,sign*.13*flare)
            for i in range(5):
                lag=1.8+i*.45 if is_bank else 3.9+i*.28
                pitch=math.sin(phase-lag)*.050*power*(.52 if beaver else 1)
                yaw=0
                if is_bank:
                    sign=1 if name=='BankLeft' else -1
                    yaw=-sign*.12*pulse(t,.29+i*.045,.60)+sign*.065*pulse(t,.49+i*.035,.48)
                if name=='Dive':
                    desired=-.94*smooth(.32+i*.05,.82+i*.045,t)
                    parent=-.94*smooth(.26,.79,t) if i==0 else -.94*smooth(.32+(i-1)*.05,.82+(i-1)*.045,t)
                    pitch+=desired-parent
                if name=='Brake':pitch+=.065*pulse(t,.19+i*.04,.62)
                angles['tail%02d'%(i+1)]=(pitch,0,yaw)
            for index,prefix in enumerate(['tuft.','shoulderFur.','hipFur.']):
                for side,suffix in enumerate(['L','R']):
                    sway=math.sin(phase-1.0-index*.70-side*.20)*(.012+.032*min(1,power))
                    angles[prefix+suffix]=(sway,0,.014*math.sin(phase-index*.8))
            for pb in rig.pose.bones:
                x,y,z=angles.get(pb.name,(0,0,0))
                intended=Quaternion((1,0,0),x) @ Quaternion((0,1,0),y) @ Quaternion((0,0,1),z)
                basis=kick_bases.get(pb.name)
                pb.rotation_quaternion=basis.inverted() @ intended @ basis if basis else intended
            if is_sprint:
                rig.pose.bones['spine'].location.y=.006*math.sin(phase-.6)
                rig.pose.bones['spineMid'].location.y=.004*math.sin(phase-.9)
            bpy.context.view_layer.update()
            reach=envelope if name=='Reach' else 0
            paddle=math.sin(phase-.5)*.006*min(1,power)
            arm_pose('R',(-.016*reach,.024*reach+paddle,-.008*reach),-.12*reach)
            arm_pose('L',(-.003,-.018+.006*math.sin(phase-1.1)*power,.006),.06)
            for pb in rig.pose.bones:
                pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
                pb.keyframe_insert('location',frame=frame,group=pb.name)
                pb.keyframe_insert('scale',frame=frame,group=pb.name)
        track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
    rig.animation_data.action=None
    for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0);pb.scale=(1,1,1)
    scene.frame_set(0);scene.render.fps=30
`;
