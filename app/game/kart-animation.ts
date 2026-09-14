import type {Racer} from "./simulation";
import {drawSpecial} from "./special-effects.ts";

export const KART_ATLAS="/assets/racers/kart-directions-v1.png";
export type KartMotion={frame:number;lean:number;bounce:number;braking:boolean;wheelPhase:number;moving:boolean};
export function kartMotion(r:Racer,time:number,relativeYaw:number,deceleration=0):KartMotion{
  const heading=relativeYaw+r.steer*(r.drifting?.65:.35);
  const frame=Math.cos(heading)<-.55?3:Math.abs(heading)>.2?(Math.sin(heading)>0?1:2):0;
  const moving=r.speed>.5&&r.finish===null&&!(r.stunUntil>time);
  return {frame,moving,lean:-r.steer*(r.drifting?.075:.025),
    bounce:moving?Math.sin(time*(12+r.speed*.3)+r.id)*.008:Math.sin(time*3+r.id)*.002,
    braking:deceleration>6&&r.speed>1&&r.hit<=0,wheelPhase:Math.floor(time*Math.max(3,r.speed*.65))%4};
}

// Decode and colour-key once, then reuse sixteen small GPU-friendly canvases.
// The source is a generated atlas with a deliberately flat magenta key colour.
export function loadKartFrames(onReady:(frames:HTMLCanvasElement[][])=>void){
  const image=new Image();
  image.onload=()=>{
    const source=document.createElement("canvas");source.width=image.naturalWidth;source.height=image.naturalHeight;
    const c=source.getContext("2d",{willReadFrequently:true});if(!c)return;
    c.drawImage(image,0,0);const pixels=c.getImageData(0,0,source.width,source.height);
    for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];if(r>210&&b>210&&g<80)pixels.data[i+3]=0;}
    c.putImageData(pixels,0,0);
    const rowEdges=[0,.25,.495,.735,1];
    const frames=Array.from({length:4},(_,row)=>Array.from({length:4},(_,col)=>{
      const left=Math.round(col*source.width/4),top=Math.round(rowEdges[row]*source.height),right=Math.round((col+1)*source.width/4),bottom=Math.round(rowEdges[row+1]*source.height);
      let x0=right,y0=bottom,x1=left,y1=top;
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(pixels.data[(y*source.width+x)*4+3]>0){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
      const frame=document.createElement("canvas");frame.width=160;frame.height=160;
      const out=frame.getContext("2d");if(!out||x1<x0)return frame;
      const width=x1-x0+1,height=y1-y0+1,scale=Math.min(148/width,146/height);
      out.imageSmoothingEnabled=false;out.drawImage(source,x0,y0,width,height,Math.round((160-width*scale)/2),Math.round(154-height*scale),Math.round(width*scale),Math.round(height*scale));return frame;
    }));
    onReady(frames);
  };
  image.src=KART_ATLAS;
  return()=>{image.onload=null;};
}

export function drawAnimatedKart(c:CanvasRenderingContext2D,sprite:CanvasImageSource,r:Racer,time:number,w:number,h:number,m:KartMotion){
  c.save();
  // Ground contact stays fixed while the chassis moves on its suspension.
  c.fillStyle="#080e1880";c.beginPath();c.ellipse(w*.5,h*.955,w*.36,h*.035,0,0,Math.PI*2);c.fill();
  if(r.drifting&&m.moving){
    for(let i=0;i<7;i++){const t=(time*5+i*.17)%1;c.globalAlpha=(1-t)*.6;c.fillStyle="#d8e3e5";c.fillRect(w*(.15+(i%2)*.68)+w*t*r.steer*.2,h*(.86+t*.15),w*(.025+t*.06),h*(.025+t*.04));}
    c.globalAlpha=1;
    if(r.driftCharge>.25){c.fillStyle=r.driftCharge>.85?"#ffcf50":"#77efff";for(let i=0;i<6;i++){const t=(time*9+i*.19)%1;c.fillRect(w*(i%2?.87:.1)+w*t*r.steer*.12,h*(.9+t*.08),w*.025,h*.02);}}
  }
  const fx=r.specialFx,age=fx?time-fx.start:2;
  const lift=fx?.kind==="claw"&&!fx.caster&&age>=0&&age<.2?Math.sin(age/.2*Math.PI)*h*.15:0;
  c.translate(w/2,h*.95+m.bounce*h-lift);c.rotate(m.lean+(r.hit>0?Math.sin(time*55)*.1:0));
  c.scale(1,r.boost>0?1.025:m.braking?.965:1);c.translate(-w/2,-h*.95);
  if(r.hit>0)c.globalAlpha=Math.floor(time*18)%2?.45:1;
  c.drawImage(sprite,0,0,w,h);
  // Moving tread highlights travel over the tyres; they stop when the kart stops.
  if(m.moving){c.fillStyle="#768394";c.globalAlpha=.65;
    const wheels=m.frame===0||m.frame===3?[.1,.84]:m.frame===1?[.13,.58,.87]:[.08,.34,.84];
    for(const x of wheels)for(let i=0;i<2;i++)c.fillRect(w*x,h*(.78+((i*2+m.wheelPhase)%4)*.035),w*.035,h*.014);
    c.globalAlpha=1;
  }
  if(m.braking&&m.frame!==3){c.fillStyle="#ff3935";c.fillRect(w*.27,h*.83,w*.075,h*.04);c.fillRect(w*.65,h*.83,w*.075,h*.04);}
  if(r.boost>0){
    for(const x of [.32,.66]){const flame=.09+(Math.sin(time*45+x*12)+1)*.035;
      c.fillStyle="#29cfff";c.fillRect(w*(x-.04),h*.88,w*.08,h*flame);
      c.fillStyle="#fff5b0";c.fillRect(w*(x-.019),h*.88,w*.038,h*flame*.7);}
  }
  if(r.hit>0){c.fillStyle="#ffe784";for(let i=0;i<3;i++){const a=time*8+i*Math.PI*2/3;const x=w*(.5+Math.cos(a)*.28),y=h*(.08+Math.sin(a)*.03);c.fillRect(x-w*.025,y,w*.05,h*.018);c.fillRect(x-w*.009,y-h*.015,w*.018,h*.05);}}
  if(r.finish!==null){c.fillStyle="#ffe69a";for(let i=0;i<4;i++){const y=(time*.5+i*.25)%1;c.fillRect(w*(.12+i*.24),h*(.8-y*.7),w*.02,h*.035);}}
  c.restore();
  if(r.shield>0){c.save();c.strokeStyle=`rgba(125,255,218,${.5+Math.sin(time*6)*.2})`;c.lineWidth=Math.max(1,w*.012);c.beginPath();c.ellipse(w*.5,h*.51,w*.49,h*.49,0,0,Math.PI*2);c.stroke();c.restore();}
  drawSpecial(c,r,time,w,h);
}
