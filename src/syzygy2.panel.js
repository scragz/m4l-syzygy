autowatch=1;
inlets=1;outlets=1;
mgraphics.init();mgraphics.relative_coords=0;mgraphics.autofill=0;
var bg=[0.055,0.071,0.079,1],ink=[0.91,0.92,0.87,1],muted=[0.49,0.57,0.57,1];
var wood=[0.89,0.65,0.36,1],glass=[0.42,0.83,0.77,1],metal=[0.67,0.64,0.90,1];
var values={active:0,hold:0,evolve:0,bow:0,alignment:0.8,coupling:0.22,instability:0.12};
var levels=[0,0,0],phase=0,x=0.5,y=0.5,history=[],message='STRIKE A BODY. LISTEN TO WHAT FOLLOWS.',undos=0,frames=0;
var pad=[718,29,160,105];
var buttons=[
 ['strike',14,127,95,20,'STRIKE ALL',glass],
 ['woodstrike',139,127,94,20,'STRIKE WOOD',wood],
 ['glassstrike',251,127,94,20,'STRIKE GLASS',glass],
 ['metalstrike',363,127,94,20,'STRIKE METAL',metal],
 ['vary',900,59,65,21,'VARY',glass],['undo',973,59,65,21,'UNDO',glass],
 ['capture',900,87,138,24,'CAPTURE 30s',wood],
 ['panic',900,120,138,20,'PANIC / CLEAR',[0.87,0.48,0.40,1]],
 ['woodscene',139,20,26,13,'01',wood],['glassscene',251,20,26,13,'02',glass],
 ['metalscene',363,20,26,13,'03',metal],['trioscene',79,51,28,15,'TRIO',glass]
];
function col(c){mgraphics.set_source_rgba(c);}
function rect(x,y,w,h,c){col(c);mgraphics.rectangle(x,y,w,h);mgraphics.fill();}
function text(s,x,y,size,c,bold){col(c);mgraphics.select_font_face('Arial','normal',bold?'bold':'normal');mgraphics.set_font_size(size);mgraphics.move_to(x,y);mgraphics.show_text(s);}
function line(x,y,a,b,c,w){col(c);mgraphics.set_line_width(w||1);mgraphics.move_to(x,y);mgraphics.line_to(a,b);mgraphics.stroke();}
function circle(x,y,r,c,fill){col(c);mgraphics.ellipse(x-r,y-r,r*2,r*2);if(fill)mgraphics.fill();else{mgraphics.set_line_width(1);mgraphics.stroke();}}
function value(k,v){values[k]=v;mgraphics.redraw();}
function status(s){message=String(s);mgraphics.redraw();}
function undoavailable(n){undos=n;mgraphics.redraw();}
// Use a differently named flag: public handlers are functions in Max's global scope.
var captureBusy=0;
function busy(v){captureBusy=v;mgraphics.redraw();}
function recorded(v){frames=v;}
function meterA(v){levels[0]=Math.max(v,levels[0]*0.84);}
function meterB(v){levels[1]=Math.max(v,levels[1]*0.84);}
function meterC(v){levels[2]=Math.max(v,levels[2]*0.84);}
function phrase(v){phase=v;}
function positionx(v){x=v;}
function positiony(v){y=v;if(values.active&&!values.hold){history.push([x,y]);if(history.length>55)history.shift();}mgraphics.redraw();}
function paint(){
 rect(0,0,1052,169,bg);rect(0,0,1052,2,glass);
 text('S Y Z Y G Y',14,25,16,ink,true);text('THREE RESONANT BODIES',14,41,7,muted);
 
 var p=[[28,93],[62,75],[97,97]];
 for(var a=0;a<3;a++)for(var b=a+1;b<3;b++)line(p[a][0],p[a][1],p[b][0],p[b][1],[0.28,0.44,0.42,0.3+values.coupling*0.7],1+values.coupling);
 for(var n=0;n<3;n++){var c=[wood,glass,metal][n];circle(p[n][0],p[n][1],6+Math.min(8,levels[n]*25),c,false);circle(p[n][0],p[n][1],2,c,true);}
 text(values.hold?'MOTION HELD':values.active?'RESONATING':'AT REST',15,117,8,values.active?glass:muted,true);
 [124,239,351,463,587,705,887].forEach(function(v){line(v,14,v,149,[0.17,0.22,0.23,1]);});
 text('WOOD',173,29,10,wood,true);text('GLASS',285,29,10,glass,true);text('METAL',397,29,10,metal,true);
 text('RELATIONSHIPS',477,19,9,glass,true);text('EVOLUTION',600,19,9,glass,true);text('SPATIAL FIELD',723,19,9,glass,true);
 text('DISCOVER',900,19,9,wood,true);
 for(var i=0;i<3;i++)for(var k=0;k<14;k++)rect(141+i*112+k*6,116,4,3,k<levels[i]*45?[wood,glass,metal][i]:[0.15,0.2,0.21,1]);
 rect(pad[0],pad[1],pad[2],pad[3],[0.035,0.047,0.051,1]);
 for(var i=0;i<5;i++){line(pad[0]+i*40,pad[1],pad[0]+i*40,pad[1]+pad[3],[0.12,0.19,0.19,1]);line(pad[0],pad[1]+i*pad[3]/4,pad[0]+pad[2],pad[1]+i*pad[3]/4,[0.12,0.19,0.19,1]);}
 circle(798,81.5,24,[0.21,0.33,0.32,1],false);circle(798,81.5,43,[0.14,0.24,0.24,1],false);
 for(var i=1;i<history.length;i++)line(pad[0]+history[i-1][0]*pad[2],pad[1]+(1-history[i-1][1])*pad[3],pad[0]+history[i][0]*pad[2],pad[1]+(1-history[i][1])*pad[3],[0.42,0.83,0.77,i/history.length*0.6],1.5);
 circle(pad[0]+x*pad[2],pad[1]+(1-y)*pad[3],4,glass,true);
 var phases=['GATHER','BLOOM','FRACTURE','SETTLE'];
 text(values.evolve?phases[Math.min(3,Math.floor(phase*4))]:'MANUAL',722,146,8,muted,true);
 rect(782,141,94,3,[0.16,0.23,0.24,1]);rect(782,141,94*phase,3,glass);
 for(var i=0;i<buttons.length;i++){
  var b=buttons[i],enabled=!(b[0]==='undo'&&!undos)&&!(b[0]==='capture'&&captureBusy);
  rect(b[1],b[2],b[3],b[4],enabled?[0.13,0.19,0.20,1]:[0.09,0.12,0.13,1]);
  text(b[0]==='capture'&&captureBusy?'SAVING...':b[5],b[1]+7,b[2]+b[4]/2+3,b[4]>15?8:7,enabled?b[6]:muted,true);
 }
 line(14,153,1038,153,[0.17,0.23,0.24,1]);text(message,15,164,8,muted,false);
 text('WOOD / GLASS / METAL',916,164,7,muted,false);
}
function onclick(mx,my){
 for(var i=0;i<buttons.length;i++){var b=buttons[i];if(mx>=b[1]&&mx<=b[1]+b[3]&&my>=b[2]&&my<=b[2]+b[4]){outlet(0,'action',b[0]);return;}}
 ondrag(mx,my,1);
}
function ondrag(mx,my,button){if(button&&mx>=pad[0]&&mx<=pad[0]+pad[2]&&my>=pad[1]&&my<=pad[1]+pad[3])outlet(0,'xy',(mx-pad[0])/pad[2],1-(my-pad[1])/pad[3]);}
