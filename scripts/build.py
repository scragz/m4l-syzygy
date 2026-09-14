"""Build Syzygy 2 instrument and audio effect from shared source."""
from pathlib import Path
import copy
import json
import shutil
import struct
import patcher as p

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'device'


def gen(codefile, outputs):
    code=(ROOT/'src'/codefile).read_text()
    boxes=[{'box':dict(id='code',maxclass='codebox',code=code,numinlets=2,numoutlets=outputs,patching_rect=[40,90,750,650])}]
    lines=[]
    for i in range(2):
        boxes.append({'box':dict(id=f'in{i}',maxclass='newobj',text=f'in {i+1}',numinlets=0,numoutlets=1,patching_rect=[40+i*100,30,60,22])})
        lines.append({'patchline':dict(source=[f'in{i}',0],destination=['code',i])})
    for i in range(outputs):
        boxes.append({'box':dict(id=f'out{i}',maxclass='newobj',text=f'out {i+1}',numinlets=1,numoutlets=0,patching_rect=[40+i*85,780,60,22])})
        lines.append({'patchline':dict(source=['code',i],destination=[f'out{i}',0])})
    return dict(fileversion=1,appversion=p.VERSION,classnamespace='dsp.gen',rect=[40,40,900,840],boxes=boxes,lines=lines)


def build():
    p.BOXES.clear();p.LINES.clear();p.PARAMETERS.clear()
    p.box('panel','jsui',[0,0,1052,169],varname='panel',presentation=1,presentation_rect=[0,0,1052,169],filename='syzygy2.panel.js',numinlets=1,numoutlets=1,parameter_enable=0,border=0)
    p.obj('control','js syzygy2.control.js #0-memory #0-export',30,1050,no=3,varname='control')
    p.wire('panel','control');p.wire('control','panel',1)
    p.button('active','RUN',[15,50,52,18],toggle=True)
    p.button('bow','BOW',[141,96,94,16],toggle=True)
    p.button('evolve','EVOLVE',[253,96,94,16],toggle=True)
    p.button('hold','HOLD',[365,96,94,16],toggle=True)
    controls=[
      ('wood','Wood',0,1,.8,139,42,5,'Level of the woody, quickly damped resonator.'),
      ('decay','Decay',0,1,.5,190,42,5,'Ringing time of all three bodies; their relative decay character stays distinct.'),
      ('glass','Glass',0,1,.65,251,42,5,'Level of the clear, long-ringing glass resonator.'),
      ('brightness','Bright',0,1,.5,302,42,5,'Upper partial strength and external-input brightness.'),
      ('metal','Metal',0,1,.45,363,42,5,'Level of the metallic body with close, beating modes.'),
      ('space','Space',0,1,.35,414,42,5,'Late stereo reflections. Direct sound remains present.'),
      ('root','Root',27.5,880,110,474,31,3,'Fundamental in Hz; MIDI notes retune and strike all bodies.'),
      ('alignment','Align',0,1,.8,532,31,5,'Move the three fundamentals toward octave and fifth relationships.'),
      ('coupling','Couple',0,1,.22,474,91,5,'Energy exchanged between bodies. At zero each rings independently.'),
      ('instability','Instab.',0,1,.12,532,91,5,'Bounded detuning, beating, and stronger nonlinear exchange.'),
      ('motion','Motion',0,1,.35,596,31,5,'Speed and depth of drift and spatial motion.'),
      ('cycle','Cycle',3,90,18,650,31,1,'Length of each autonomous gather/bloom/fracture/settle phrase, in seconds.'),
      ('bloom','Bloom',0,1,.45,596,91,5,'Phrase swelling and the strength of its brief fracture.'),
      ('variation','Vary %',0,1,.15,650,91,5,'Maximum variation amount. Vary preserves root, level, input gain, and performance switches.')
    ]
    for key,label,lo,hi,v,x,y,unit,hint in controls:p.dial(key,label,lo,hi,v,x,y,unit=unit,hint=hint)
    p.parameter('output','Output',-60,0,-12,[900,31,65,19],kind='live.numbox',unit=4,fontsize=10,textcolor=p.INK,bgcolor=p.BG)
    p.parameter('width','Width',0,100,80,[973,31,65,19],kind='live.numbox',unit=5,fontsize=10,textcolor=p.INK,bgcolor=p.BG)
    for key in ['azimuth','elevation']:p.parameter(key,key.title(),0,1,.5,kind='live.numbox',unit=1)
    p.parameter('inputgain','Audio Input',0,100,60,kind='live.numbox',unit=5)
    main=gen('syzygy2.genexpr',8)
    recorder=gen('syzygy2.capture.genexpr',2)
    p.obj('dsp','gen~',310,1050,ni=2,no=8,varname='dsp',patcher=main,outlettype=['signal']*8)
    p.obj('audio','plugout~',310,1290,ni=2,no=2)
    p.wire('control','dsp')
    p.wire('dsp','audio');p.wire('dsp','audio',1,1)
    p.obj('memory','buffer~ #0-memory 30000 2',30,1380,no=2,varname='memory')
    p.obj('export','buffer~ #0-export 30000 2',30,1420,no=2,varname='export')
    p.obj('recorder','gen~',310,1380,ni=2,no=2,varname='recorder',patcher=recorder)
    p.wire('dsp','recorder');p.wire('dsp','recorder',1,1);p.wire('control','recorder',2)
    p.obj('bind','loadmess memory #0-memory',310,1420);p.wire('bind','recorder')
    def sample(src,out,key,to,x,y):
        p.obj('snap-'+key,'snapshot~ 30',x,y)
        p.obj('view-'+key,'prepend '+key,x,y+30)
        p.wire(src,'snap-'+key,out);p.wire('snap-'+key,'view-'+key);p.wire('view-'+key,to)
    for i,key in enumerate(['meterA','meterB','meterC','phrase','positionx','positiony']):sample('dsp',i+2,key,'panel',480+i*125,1130)
    sample('recorder',0,'recordpos','control',500,1390)
    sample('recorder',1,'recorded','control',680,1390)
    p.obj('load','loadbang',30,1500)
    p.obj('liveinit','live.thisdevice',200,1500,no=3)
    p.box('init','message',[390,1500,50,22],numinlets=2,numoutlets=1,text='init')
    p.wire('load','init');p.wire('liveinit','init');p.wire('init','control')
    p.obj('notes','notein',30,1550,no=3)
    p.obj('note-pack','pack 0 0',200,1550,ni=2)
    p.obj('note-msg','prepend note',390,1550)
    p.wire('notes','note-pack',1,1);p.wire('notes','note-pack');p.wire('note-pack','note-msg');p.wire('note-msg','control')
    banks=[('Bodies',['wood','glass','metal','decay','brightness','space','root','output']),
           ('Relationships',['alignment','coupling','instability','motion','cycle','bloom','variation','width']),
           ('Performance',['active','bow','evolve','hold','azimuth','elevation','inputgain','-'])]
    p.PARAMETERS['parameterbanks']={str(i):dict(index=i,name=n,parameters=k) for i,(n,k) in enumerate(banks)}
    p.PARAMETERS['inherited_shortname']=1
    patch=dict(fileversion=1,appversion=p.VERSION,classnamespace='box',rect=[80,100,1070,740],openrect=[0,0,1052,169],devicewidth=1052,openinpresentation=1,bglocked=1,bgcolor=p.BG,default_fontsize=11,default_fontname='Arial',boxes=p.BOXES[1:]+p.BOXES[:1],lines=p.LINES,parameters=p.PARAMETERS,autosave=0,title='Syzygy',latency=0,dependency_cache=[dict(name=n,type='TEXT',implicit=1) for n in ['syzygy2.panel.js','syzygy2.control.js']])
    DEST.mkdir(exist_ok=True);(DEST/'captures').mkdir(exist_ok=True);(DEST/'captures/.keep').touch()
    for name in ['syzygy2.panel.js','syzygy2.control.js']:shutil.copyfile(ROOT/'src'/name,DEST/name)
    def write(name,patch,kind):
        raw=(json.dumps({'patcher':patch},indent=2)+'\n').encode()
        (DEST/(name+'.maxpat')).write_bytes(raw)
        payload=raw+b'\0'
        (DEST/(name+'.amxd')).write_bytes(b'ampf'+struct.pack('<I',4)+kind+b'meta'+struct.pack('<II',4,0)+b'ptch'+struct.pack('<I',len(payload))+payload)
    write('Syzygy',patch,b'iiii')
    effect=copy.deepcopy(patch);effect['title']='Syzygy Audio'
    effect['boxes'].append({'box':dict(id='input',maxclass='newobj',text='plugin~',numinlets=0,numoutlets=2,patching_rect=[310,990,90,22])})
    for i in range(2):effect['lines'].append({'patchline':dict(source=['input',i],destination=['dsp',i])})
    write('Syzygy Audio',effect,b'aaaa')
    (DEST/'syzygy2.gendsp').write_text(json.dumps({'patcher':main},indent=2)+'\n')
    print('Built Syzygy.amxd and Syzygy Audio.amxd')

if __name__=='__main__':build()
