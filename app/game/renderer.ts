import { TRACK, TRACK_LENGTH, ROAD_HALF_WIDTH, CHECKPOINTS, atDistance, angleDelta, wrap } from "./circuit.ts";
import { type GameState, type Racer } from "./simulation.ts";
import { BOOST_PADS, PICKUPS, OBSTACLES } from "./circuit.ts";
import {stadiumProjection} from "./spectator.ts";
import {drawKartSprite,drawPalm} from "./sprites";
import {RACERS} from "../data/racers";
import {loadKartFrames,kartMotion,drawAnimatedKart} from "./kart-animation";

type V3 = { x:number; y:number; z:number };
type Paint = { depth:number; layer?:number; draw:()=>void };
const W=800,F=540;
const palette={sky:"#191b3d",ground:"#514464",road:"#30384e",roadAlt:"#333c52",sand:"#775a74",pink:"#ef8293",cream:"#ffdcad",cyan:"#85f7e1"};
export class RaceRenderer {
  canvas:HTMLCanvasElement;
  ctx:CanvasRenderingContext2D;
  yaw=0;cameraX=0;cameraZ=0;cameraHeight=4.8;pitch=.075;
  paints:Paint[]=[];
  ground:Paint[]=[];
  kartImages:HTMLImageElement[]=[];
  kartFrames:HTMLCanvasElement[][]=[];
  previousSpeeds=new Map<number,number>();
  deceleration=new Map<number,number>();
  releaseFrames:()=>void=()=>{};
  constructor(canvas:HTMLCanvasElement,g:GameState){
    this.canvas=canvas;canvas.width=W;canvas.height=450;
    const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)throw new Error("Your browser could not start the Canvas renderer.");this.ctx=ctx;
    this.yaw=g.racers[0].yaw;
    if(typeof Image!=="undefined")this.kartImages=RACERS.map(profile=>{const image=new Image();image.src=profile.kartSprite;return image;});
    if(typeof document!=="undefined")this.releaseFrames=loadKartFrames(frames=>{this.kartFrames=frames;});
  }
  camera(v:V3):V3{
    const dx=v.x-this.cameraX,dz=v.z-this.cameraZ,forward=dx*Math.sin(this.yaw)+dz*Math.cos(this.yaw),up=v.y-this.cameraHeight;
    return{x:dx*Math.cos(this.yaw)-dz*Math.sin(this.yaw),y:up*Math.cos(this.pitch)+forward*Math.sin(this.pitch),z:forward*Math.cos(this.pitch)-up*Math.sin(this.pitch)};
  }
  screen(p:V3){return{x:W/2+p.x*F/p.z,y:this.canvas.height*.4-p.y*F/p.z,scale:F/p.z};}
  quad(world:V3[],color:string){
    const H=this.canvas.height;
    let vertices=world.map(v=>this.camera(v));
    if(vertices.every(p=>p.z<1.5)||vertices.every(p=>p.z>380))return;
    // Clip in camera space so the road fills the foreground without exploding at z=0.
    const clipped:V3[]=[];
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i],b=vertices[(i+1)%vertices.length];
      if(a.z>=1.5)clipped.push(a);
      if((a.z<1.5)!==(b.z<1.5)){const t=(1.5-a.z)/(b.z-a.z);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:1.5});}
    }
    vertices=clipped;if(vertices.length<3)return;
    const screen=vertices.map(v=>this.screen(v));
    if(screen.every(p=>p.x<0)||screen.every(p=>p.x>W)||screen.every(p=>p.y<0)||screen.every(p=>p.y>H))return;
    const depth=vertices.reduce((n,p)=>n+p.z,0)/vertices.length;
    const queue=world.every(p=>p.y<=.15)?this.ground:this.paints;
    queue.push({depth,layer:world[0].y,draw:()=>{const ctx=this.ctx;ctx.fillStyle=color;ctx.beginPath();screen.forEach((p,i)=>{if(i===0)ctx.moveTo(Math.round(p.x),Math.round(p.y));else ctx.lineTo(Math.round(p.x),Math.round(p.y));});ctx.closePath();ctx.fill();}});
  }
  strip(a:{x:number;z:number;yaw:number},b:{x:number;z:number;yaw:number},left:number,right:number,y:number,color:string){
    this.quad([{x:a.x+Math.cos(a.yaw)*left,z:a.z-Math.sin(a.yaw)*left,y},{x:a.x+Math.cos(a.yaw)*right,z:a.z-Math.sin(a.yaw)*right,y},{x:b.x+Math.cos(b.yaw)*right,z:b.z-Math.sin(b.yaw)*right,y},{x:b.x+Math.cos(b.yaw)*left,z:b.z-Math.sin(b.yaw)*left,y}],color);
  }
  billboard(x:number,z:number,y:number,width:number,height:number,draw:(ctx:CanvasRenderingContext2D,w:number,h:number)=>void){
    const H=this.canvas.height;
    const p=this.camera({x,z,y});if(p.z<2||p.z>340)return;
    const screen=this.screen(p),sw=width*screen.scale,sh=height*screen.scale;
    if(screen.x+sw/2<0||screen.x-sw/2>W||screen.y-sh>H||screen.y<0)return;
    this.paints.push({depth:p.z-.1,draw:()=>{this.ctx.save();this.ctx.translate(Math.round(screen.x-sw/2),Math.round(screen.y-sh));draw(this.ctx,sw,sh);this.ctx.restore();}});
  }
  sky(){
    const ctx=this.ctx,H=this.canvas.height;
    const shift=Math.round(H*.4-F*Math.tan(this.pitch))-139;
    ctx.fillStyle=palette.sky;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(0,shift);
    // Quantized colour bands intentionally retain a low-resolution console aesthetic.
    ["#252246","#3b2b56","#643b64","#a75879","#e68386","#ffc196"].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(0,52+i*15,W,16);});
    const sunX=wrap(520-this.yaw*80,W+180)-90;
    ctx.fillStyle="#ffd8a1";for(let y=0;y<46;y+=3){const half=Math.sqrt(Math.max(0,23**2-(y-23)**2));ctx.fillRect(Math.round(sunX-half),47+y,Math.round(half*2),y>23?2:3);}
    ctx.fillStyle="#2e2b4e";
    for(let i=-1;i<24;i++){
      const x=wrap(i*43-this.yaw*45,1032)-80,h=14+((i+33)*37%55);
      ctx.fillRect(x,138-h,26,h);ctx.fillRect(x+6,130-h,12,8);
      ctx.fillStyle="#e8a1a2";if(i%3===0)ctx.fillRect(x+8,144-h,3,3);ctx.fillStyle="#2e2b4e";
    }
    ctx.fillStyle=palette.ground;ctx.fillRect(0,142,W,H-142);
    ctx.fillStyle="#413b59";ctx.fillRect(0,139,W,6);
    ctx.restore();
  }
  track(){
    for(let i=0;i<TRACK.length;i++){
      const a=TRACK[i],b=TRACK[(i+1)%TRACK.length];
      if(Math.hypot(a.x-this.cameraX,a.z-this.cameraZ)>380)continue;
      const alt=Math.floor(a.s/6)%2===0;
      this.strip(a,b,-17,17,-.06,alt?"#75617b":"#706079");
      this.strip(a,b,-13.3,13.3,0,alt?palette.cream:palette.pink);
      this.strip(a,b,-ROAD_HALF_WIDTH,ROAD_HALF_WIDTH,.025,alt?palette.road:palette.roadAlt);
      this.strip(a,b,-11.6,-11.4,.04,"#f2c59e");this.strip(a,b,11.4,11.6,.04,"#f2c59e");
      if(Math.floor(a.s/5)%3===0){this.strip(a,b,-4.08,-3.92,.05,"#7c8394");this.strip(a,b,3.92,4.08,.05,"#7c8394");}
      // Low solid barriers have matching collision boundaries in the simulation.
      for(const side of [-1,1]){
        const ax=a.x+Math.cos(a.yaw)*side*16,bx=b.x+Math.cos(b.yaw)*side*16;
        const az=a.z-Math.sin(a.yaw)*side*16,bz=b.z-Math.sin(b.yaw)*side*16;
        this.quad([{x:ax,y:0,z:az},{x:bx,y:0,z:bz},{x:bx,y:.7,z:bz},{x:ax,y:.7,z:az}],alt?"#7588a0":"#40516a");
      }
    }
    for(let row=0;row<3;row++)for(let col=0;col<12;col++)this.strip(atDistance(row*1.3),atDistance((row+1)*1.3),-12+col*2,-10+col*2,.075,(row+col)%2?"#242840":"#fff0d1");
    for(const pad of BOOST_PADS){
      const a=atDistance(pad.s-3),b=atDistance(pad.s+3);
      this.strip(a,b,pad.offset-2.5,pad.offset+2.5,.08,"#163e51");
      for(let j=-2;j<=2;j+=2){const center=atDistance(pad.s+j,pad.offset),tip=atDistance(pad.s+j+1,pad.offset),l=atDistance(pad.s+j-1,pad.offset-2),r=atDistance(pad.s+j-1,pad.offset+2);this.quad([{...l,y:.1},{...center,y:.1},{...r,y:.1},{...tip,y:.1}],"#85f7e1");}
    }
  }
  scenery(g:GameState){
    const ctx=this.ctx;
    for(let i=0;i<TRACK.length;i+=15){
      const side=i%30===0?1:-1,p=atDistance(TRACK[i].s,side*20);
      this.billboard(p.x,p.z,0,1.3,7,(c,w,h)=>{c.fillStyle="#283348";c.fillRect(w*.4,h*.1,Math.max(1,w*.18),h*.9);c.fillStyle="#a7efe4";c.fillRect(0,0,w,h*.07);c.fillStyle="#546880";c.fillRect(0,h*.07,w,h*.06);});
      if(i%45===0)this.billboard(p.x+side*4,p.z,0,3,4.4,(c,w,h)=>drawPalm(c,w,h));
    }
    for(let i=0;i<CHECKPOINTS;i++){
      const p=atDistance(i*TRACK_LENGTH/CHECKPOINTS,18.4);
      this.billboard(p.x,p.z,0,7,5,(c,w,h)=>{
        c.fillStyle="#212940";c.fillRect(w*.18,h*.65,w*.13,h*.35);c.fillRect(w*.7,h*.65,w*.13,h*.35);
        c.fillStyle=i===0?"#f8b655":"#cf9c8d";c.fillRect(0,0,w,h*.68);
        c.fillStyle="#30344c";c.fillRect(w*.035,h*.04,w*.93,h*.6);
        c.fillStyle=i===0?"#f8b655":"#faebd6";c.font=`bold ${Math.max(4,h*.25)}px monospace`;c.textAlign="center";c.fillText(i===0?"FINISH":"CP 0"+i,w*.5,h*.43);
      });
    }
    for(const box of PICKUPS){if(g.pickupTimers[box.id]>0)continue;
      this.billboard(box.x,box.z,.5+Math.sin(g.time*3+box.id)*.15,2.3,2.7,(c,w,h)=>{
        c.fillStyle="#1f6266";c.fillRect(w*.13,h*.13,w*.85,h*.87);c.fillStyle="#8bf6dc";c.fillRect(0,0,w*.86,h*.87);c.fillStyle="#467985";c.fillRect(w*.1,h*.08,w*.66,h*.68);c.fillStyle="#fff4bd";c.font=`bold ${h*.65}px monospace`;c.textAlign="center";c.fillText("?",w*.43,h*.63);
      });
    }
    for(const o of OBSTACLES)this.billboard(o.x,o.z,0,3,2,(c,w,h)=>{c.fillStyle="#242a40";c.fillRect(0,h*.1,w,h*.9);c.fillStyle="#ed996b";c.fillRect(w*.1,0,w*.8,h);c.fillStyle="#75425b";c.fillRect(w*.1,h*.23,w*.8,h*.18);c.fillRect(w*.1,h*.63,w*.8,h*.18);});
    for(const b of g.bolts)this.billboard(b.x,b.z,.8,.9,.9,(c,w,h)=>{c.fillStyle="#fff1bb";c.fillRect(0,0,w,h);c.fillStyle="#91ffff";c.fillRect(-w*.5,h*.3,w*.5,h*.4);});
    for(const p of g.particles)this.billboard(p.x,p.z,p.y,.22,.22,(c,w,h)=>{c.fillStyle=p.color;c.fillRect(0,0,Math.max(1,w),Math.max(1,h));});
    // Start gantry is anchored in the world and is passed at the end of each lap.
    const a=atDistance(0,-14),b=atDistance(0,14);
    for(const p of [a,b])this.billboard(p.x,p.z,0,.8,9,(c,w,h)=>{c.fillStyle="#314158";c.fillRect(0,0,w,h);c.fillStyle="#d8a88d";c.fillRect(0,0,w,h*.06);});
    this.quad([{...a,y:7.5},{...b,y:7.5},{...b,y:9},{...a,y:9}],"#deb086");
    void ctx;
  }
  kart(r:Racer,g:GameState){
    // Original raster-style kart silhouette, projected at its actual world depth.
    this.billboard(r.x,r.z,.1,3.5,2.8,(c,w,h)=>{
      c.save();c.scale(w/48,h/40);
      const direction=angleDelta(r.yaw,this.yaw),lean=Math.sin(direction)*5;
      c.fillStyle="#141b2e";c.fillRect(2,35,44,4);
      if(r.boost>0){c.fillStyle="#65dcdb";c.fillRect(15,34,7,6);c.fillRect(28,34,7,6);c.fillStyle="#fff0a4";c.fillRect(17,34,3,4);c.fillRect(30,34,3,4);}
      if(r.shield>0){c.strokeStyle="#80f5e2";c.lineWidth=1;c.strokeRect(0,-2,48,42);}
      if(r.hit>0&&Math.floor(g.time*14)%2)c.globalAlpha=.6;
      c.translate(lean,0);
      c.fillStyle="#111c2f";c.fillRect(1,21,10,15);c.fillRect(37,21,10,15);c.fillRect(7,16,6,9);c.fillRect(35,16,6,9);
      c.fillStyle="#586078";c.fillRect(2,25,3,8);c.fillRect(43,25,3,8);
      c.fillStyle=r.color;c.fillRect(10,22,28,13);c.fillRect(7,25,34,6);c.fillRect(12,18,24,7);
      c.fillStyle="#ffe9bb";c.fillRect(20,21,8,10);c.fillRect(9,31,30,3);
      c.fillStyle="#343c59";c.fillRect(17,15,14,10);
      c.fillStyle=r.color;c.fillRect(16,5,16,12);c.fillRect(19,2,10,3);
      c.fillStyle="#f8deb2";c.fillRect(20,3,3,12);
      c.fillStyle="#705441";c.fillRect(17,13,14,3);
      c.fillStyle="#ffe9bb";c.fillRect(20,3,3,11);
      c.fillStyle="#222b42";c.fillRect(10,28,28,4);c.fillRect(8,26,3,7);c.fillRect(37,26,3,7);
      c.fillStyle=r.color;c.fillRect(7,26,34,2);
      c.fillStyle="#ef6570";c.fillRect(12,32,5,2);c.fillRect(31,32,5,2);
      c.restore();
    });
  }
  kartArt(r:Racer,g:GameState){
    this.billboard(r.x,r.z,.1,4.5,4.5,(c,w,h)=>{
      const motion=kartMotion(r,g.time,angleDelta(r.yaw,this.yaw),this.deceleration.get(r.id)??0);
      const frame=this.kartFrames[r.id]?.[motion.frame];
      if(frame){drawAnimatedKart(c,frame,r,g.time,w,h,motion);return;}
      c.save();
      if(r.hit>0&&Math.floor(g.time*14)%2)c.globalAlpha=.6;
      const sprite=this.kartImages[r.id];
      if(sprite?.complete&&sprite.naturalWidth>0){
        const size=Math.min(w/sprite.naturalWidth,h/sprite.naturalHeight);
        const width=sprite.naturalWidth*size,height=sprite.naturalHeight*size;
        c.drawImage(sprite,(w-width)/2,h-height,width,height);
      }else{c.save();c.scale(w/64,h/64);drawKartSprite(c,r.id,r.color,angleDelta(r.yaw,this.yaw),Math.floor(g.time*8));c.restore();}
      if(r.boost>0){c.fillStyle="#8fffe3";c.fillRect(w*.28,h*.92,w*.1,h*.08);c.fillRect(w*.59,h*.92,w*.1,h*.08);}
      if(r.shield>0){c.strokeStyle="#fff1a8";c.lineWidth=2;c.strokeRect(0,0,w,h);}
      c.restore();
    });
  }
  minimap(g:GameState){
    const c=this.ctx,x=W-134,y=this.canvas.height-115,scale=.235;
    c.save();c.translate(x,y);c.fillStyle="#192238cc";c.fillRect(-8,-12,127,119);
    c.strokeStyle="#64738b";c.lineWidth=5;c.lineJoin="round";c.beginPath();
    TRACK.forEach((p,i)=>{const px=(p.x+265)*scale,py=(240-p.z)*scale;if(i===0)c.moveTo(px,py);else c.lineTo(px,py)});c.closePath();c.stroke();
    for(const r of [...g.racers].reverse()){c.fillStyle=r.color;const size=r.id===0?6:4;c.fillRect((r.x+265)*scale-size/2,(240-r.z)*scale-size/2,size,size);}
    c.restore();
  }
  stadium(g:GameState){
    const c=this.ctx,H=this.canvas.height,{scale,tilt,project}=stadiumProjection(W,H);
    c.fillStyle="#111923";c.fillRect(0,0,W,H);
    c.save();
    // Fixed elevated view: the complete circuit never leaves the frame.
    const path=()=>{c.beginPath();TRACK.forEach((p,i)=>{const q=project(p.x,p.z);if(i===0)c.moveTo(q.x,q.y);else c.lineTo(q.x,q.y);});c.closePath();};
    c.lineJoin="round";c.lineCap="round";
    path();c.strokeStyle="#263d42";c.lineWidth=(ROAD_HALF_WIDTH*2+28)*scale;c.stroke();
    path();c.strokeStyle="#b57787";c.lineWidth=(ROAD_HALF_WIDTH*2+4)*scale;c.stroke();
    path();c.strokeStyle="#303b4b";c.lineWidth=ROAD_HALF_WIDTH*2*scale;c.stroke();
    path();c.strokeStyle="#c0c8c655";c.lineWidth=1;c.setLineDash([6,9]);c.stroke();c.setLineDash([]);
    for(const pad of BOOST_PADS){const q=project(pad.x,pad.z);c.fillStyle="#85f7e1";c.fillRect(q.x-3,q.y-2,6,4);}
    const finish=atDistance(0),a=project(finish.x-ROAD_HALF_WIDTH,finish.z),b=project(finish.x+ROAD_HALF_WIDTH,finish.z);
    c.strokeStyle="#f1eadb";c.lineWidth=4;c.setLineDash([3,3]);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([]);
    for(const r of [...g.racers].sort((a,b)=>b.z-a.z)){
      const p=project(r.x,r.z);
      const motion=kartMotion(r,g.time,r.yaw,this.deceleration.get(r.id)??0);
      const frame=this.kartFrames[r.id]?.[motion.frame];
      const sprite=this.kartImages[r.id];
      if(frame){c.save();c.translate(p.x-20,p.y-35);drawAnimatedKart(c,frame,r,g.time,40,40,motion);c.restore();}
      else if(sprite?.complete&&sprite.naturalWidth>0){
        const width=36,height=width*sprite.naturalHeight/sprite.naturalWidth;
        c.drawImage(sprite,p.x-width/2,p.y-height+5,width,height);
      }else{
      c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(Math.sin(r.yaw),Math.cos(r.yaw)*tilt));
      c.fillStyle="#080d15";c.fillRect(-6,-8,12,16);c.fillStyle=r.color;c.fillRect(-4,-7,8,14);
      c.fillStyle="#f1eadb";c.fillRect(-3,-5,6,3);c.restore();
      }
      // Four labelled markers remain readable even when karts bunch together.
      const labelX=p.x+(r.id%2?30:-30),labelY=p.y+(r.id<2?-24:24);
      c.strokeStyle=r.color;c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(labelX,labelY);c.stroke();
      c.fillStyle="#10151de6";c.fillRect(labelX-38,labelY-9,76,18);c.fillStyle=r.color;c.font="bold 11px monospace";c.textAlign="center";c.fillText(r.name,labelX,labelY+4);
    }
    c.restore();
  }
  render(g:GameState,dt:number,followId:number=0){
    for(const r of g.racers){const old=this.previousSpeeds.get(r.id)??r.speed;this.deceleration.set(r.id,Math.max(0,(old-r.speed)/Math.max(dt,.001)));this.previousSpeeds.set(r.id,r.speed);}
    const desiredHeight=Math.round(W*this.canvas.clientHeight/Math.max(1,this.canvas.clientWidth));
    if(desiredHeight>0&&this.canvas.height!==desiredHeight)this.canvas.height=desiredHeight;
    const H=this.canvas.height;
    this.ctx.imageSmoothingEnabled=false;
    if(followId===-1){this.stadium(g);return;}
    const r=g.racers.find(kart=>kart.id===followId)??g.racers[0];
    this.yaw+=angleDelta(r.yaw,this.yaw)*Math.min(1,dt*7);
    this.cameraX=r.x-Math.sin(this.yaw)*11.5;this.cameraZ=r.z-Math.cos(this.yaw)*11.5;
    this.cameraHeight=4.8+(H-450)*.0085+(r.boost>0?.25:0);this.pitch=.075;
    this.ctx.imageSmoothingEnabled=false;this.paints=[];this.ground=[];
    this.sky();this.track();this.scenery(g);
    for(const kart of g.racers)this.kartArt(kart,g);
    // All road surfaces are on one ground plane. Drawing them first prevents
    // near road tiles from incorrectly covering the bottom of a kart sprite.
    this.ground.sort((a,b)=>(a.layer??0)-(b.layer??0)||b.depth-a.depth);for(const p of this.ground)p.draw();
    this.paints.sort((a,b)=>b.depth-a.depth);for(const p of this.paints)p.draw();
    if(r.boost>0){const c=this.ctx;c.strokeStyle="#e5faed88";c.lineWidth=1;for(let i=0;i<9;i++){const a=i*2.4+g.time*2,x=W/2+Math.cos(a)*360,y=H*.5+Math.sin(a)*260;c.beginPath();c.moveTo(x,y);c.lineTo(x+(x-W/2)*.3,y+(y-H/2)*.3);c.stroke();}}
    this.minimap(g);
  }
}
