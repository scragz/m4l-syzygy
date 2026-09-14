autowatch=1;
inlets=1;
outlets=3; // DSP, panel, capture recorder
var base={active:0,root:110,wood:0.8,glass:0.65,metal:0.45,decay:0.5,brightness:0.5,
    alignment:0.8,coupling:0.22,instability:0.12,bow:0,evolve:0,motion:0.35,cycle:18,
    bloom:0.45,hold:0,space:0.35,width:0.8,azimuth:0.5,elevation:0.5,output:-12,inputgain:0.6,variation:0.15};
var percent=['wood','glass','metal','decay','brightness','alignment','coupling','instability','motion','bloom','space','width','inputgain','variation'];
var mutable=['wood','glass','metal','decay','brightness','alignment','coupling','instability','motion','cycle','bloom','space','width','azimuth','elevation'];
var ranges={root:[27.5,880],cycle:[3,90],output:[-60,0]};
var undoStack=[], strikeCount=0, restoring=false;
var memoryName=jsarguments.length>1?jsarguments[1]:'syzygy-memory';
var exportName=jsarguments.length>2?jsarguments[2]:'syzygy-export';
var writePosition=0,validFrames=0,captureBusy=false,capturePath='',copyOffset=0,captureStart=0,captureFrames=0;
var inputBuffer,outputBuffer;
var settleTask=new Task(copyStart,this);
var copyTask=new Task(copyChunk,this);
var verifyTask=new Task(verifyWrite,this);
var panicTask=new Task(function(){outlet(0,'reset');sync();},this);
var probeCount=0;
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function ui(key,v){var o=this.patcher.getnamed(key);if(o)o.message('float',percent.indexOf(key)>=0?v*100:v);}
function status(s){outlet(1,'status',s);}
function sync(){for(var k in base){if(k!=='variation')outlet(0,k,base[k]);outlet(1,'value',k,base[k]);}}
function init(){sync();outlet(1,'undoavailable',undoStack.length);}
function anything(){
    var k=messagename,v=Number(arguments[0]);
    if(!base.hasOwnProperty(k)||!isFinite(v))return;
    if(percent.indexOf(k)>=0)v/=100;
    var r=ranges[k]||[0,1];v=clamp(v,r[0],r[1]);
    base[k]=v;
    if(k!=='variation')outlet(0,k,v);
    outlet(1,'value',k,v);
}
function wake(){if(!base.active)ui('active',1);}
function strike(which,vel){
    wake();
    strikeCount=(strikeCount+1)%1000000;
    outlet(0,'target',clamp(Number(which)||0,0,3));
    outlet(0,'velocity',vel===undefined?0.8:clamp(Number(vel),0,1));
    outlet(0,'strikeid',strikeCount);
    status(['ALL BODIES STRUCK','WOOD STRUCK','GLASS STRUCK','METAL STRUCK'][Number(which)||0]);
}
function note(pitch,velocity){if(velocity<=0)return;ui('root',clamp(440*Math.pow(2,(pitch-69)/12),27.5,880));strike(0,velocity/127);}
function xy(x,y){ui('azimuth',clamp(x,0,1));ui('elevation',clamp(y,0,1));}
function snapshot(){var s={};for(var i=0;i<mutable.length;i++)s[mutable[i]]=base[mutable[i]];return s;}
function remember(){undoStack.push(snapshot());if(undoStack.length>16)undoStack.shift();outlet(1,'undoavailable',undoStack.length);}
function vary(){
    if(base.variation<=0){status('RAISE VARIATION TO EXPLORE');return;}
    remember();restoring=true;
    for(var i=0;i<mutable.length;i++){
        var k=mutable[i],r=ranges[k]||[0,1];
        // Cycle moves proportionally, so slow phrases remain slow.
        var delta=(Math.random()*2-1)*base.variation*(k==='cycle'?base.cycle*0.4:0.3);
        ui(k,clamp(base[k]+delta,r[0],r[1]));
    }
    restoring=false;status('VARIATION APPLIED / UNDO AVAILABLE');
}
function undo(){
    if(!undoStack.length){status('NO VARIATION TO UNDO');return;}
    var s=undoStack.pop();restoring=true;for(var k in s)ui(k,s[k]);restoring=false;
    outlet(1,'undoavailable',undoStack.length);status('PREVIOUS SETTINGS RESTORED');
}
function scene(which){
    var scenes=[
        {wood:1,glass:0,metal:0,decay:0.32,brightness:0.55,coupling:0,instability:0.03,space:0.15},
        {wood:0,glass:1,metal:0,decay:0.6,brightness:0.55,coupling:0,instability:0.03,space:0.3},
        {wood:0,glass:0,metal:1,decay:0.7,brightness:0.5,coupling:0,instability:0.08,space:0.3},
        {wood:0.8,glass:0.65,metal:0.45,decay:0.5,brightness:0.5,alignment:0.8,coupling:0.22,instability:0.12,motion:0.35,cycle:18,bloom:0.45,space:0.35,width:0.8}
    ];
    var s=scenes[clamp(Math.floor(which),0,3)];remember();for(var k in s)ui(k,s[k]);
    status('STARTING SOUND LOADED / UNDO AVAILABLE');
}
function panic(){ui('active',0);panicTask.cancel();panicTask.schedule(180);status('NETWORK CLEARED / AUDIO HISTORY KEPT');}
function action(name){
    if(name==='strike')strike(0);
    else if(name==='woodstrike')strike(1);
    else if(name==='glassstrike')strike(2);
    else if(name==='metalstrike')strike(3);
    else if(name==='vary')vary();
    else if(name==='undo')undo();
    else if(name==='capture')capture();
    else if(name==='panic')panic();
    else if(name==='woodscene')scene(0);
    else if(name==='glassscene')scene(1);
    else if(name==='metalscene')scene(2);
    else if(name==='trioscene')scene(3);
}
function recordpos(v){writePosition=Number(v);}
function recorded(v){validFrames=Number(v);outlet(1,'recorded',validFrames);}
function capture(){
    var p=this.patcher.filepath;
    var slash=Math.max(p.lastIndexOf('/'),p.lastIndexOf('\\'));
    var d=new Date();
    function pad(n){return ('0'+n).slice(-2);}
    var name='Syzygy-'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds())+'-'+d.getMilliseconds()+'.wav';
    captureto(p.slice(0,slash)+'/captures/'+name);
}
function captureto(path){
    if(captureBusy){status('CAPTURE IS STILL SAVING');return;}
    if(validFrames<64){status('NO AUDIO HISTORY YET');return;}
    capturePath=String(path);
    var f=new File(capturePath,'write');
    if(!f.isopen){status('CANNOT WRITE / KEEP CAPTURES FOLDER WITH DEVICE');return;}
    f.close();
    captureBusy=true;outlet(1,'busy',1);outlet(2,'paused',1);
    status('CAPTURING PREVIOUS AUDIO');settleTask.schedule(120);
}
function copyStart(){
    try{
        inputBuffer=new Buffer(memoryName);outputBuffer=new Buffer(exportName);
        captureFrames=Math.min(Math.floor(validFrames),inputBuffer.framecount());
        captureStart=(Math.floor(writePosition)-captureFrames+inputBuffer.framecount())%inputBuffer.framecount();
        outputBuffer.send('sizeinsamps',captureFrames);copyOffset=0;copyTask.schedule(1);
    }catch(e){captureError(e);}
}
function copyChunk(){
    try{
        var total=inputBuffer.framecount();
        var n=Math.min(16384,captureFrames-copyOffset);
        var source=(captureStart+copyOffset)%total;
        n=Math.min(n,total-source);
        for(var c=1;c<=2;c++)outputBuffer.poke(c,copyOffset,inputBuffer.peek(c,source,n));
        copyOffset+=n;
        if(copyOffset<captureFrames){copyTask.schedule(1);return;}
        outlet(2,'paused',0);
        outputBuffer.send('writewave',capturePath);
        probeCount=0;verifyTask.schedule(300);
    }catch(e){captureError(e);}
}
function verifyWrite(){
    var f=new File(capturePath,'read');var complete=f.isopen&&f.eof>=captureFrames*4+44;f.close();
    if(!complete&&probeCount++<30){verifyTask.schedule(200);return;}
    captureBusy=false;outlet(1,'busy',0);
    status(complete?'SAVED '+capturePath.slice(capturePath.lastIndexOf('/')+1):'CAPTURE WRITE FAILED');
}
function captureError(e){outlet(2,'paused',0);captureBusy=false;outlet(1,'busy',0);status('CAPTURE FAILED: '+e);}
function notifydeleted(){settleTask.cancel();copyTask.cancel();verifyTask.cancel();panicTask.cancel();}
