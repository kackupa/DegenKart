import { atDistance, nearestTrack, angleDelta, clamp, wrap, TRACK_LENGTH, ROAD_HALF_WIDTH, CHECKPOINTS, LAPS, BOOST_PADS, PICKUPS, OBSTACLES } from "./circuit.ts";
import {RACERS} from "../data/racers.ts";

export type Controls = { throttle: boolean; brake: boolean; left: boolean; right: boolean; drift: boolean; item: boolean };
export const noControls = (): Controls => ({ throttle:false, brake:false, left:false, right:false, drift:false, item:false });
export type Special = "chord" | "balls" | "claw" | "seas";
export type Item = "turbo" | "pulse" | "shield" | Special;
export const SPECIALS:Special[]=["chord","balls","claw","seas"];
export const ITEM_NAMES: Record<Item,string> = { turbo:"GREEN CANDLE", pulse:"PULSE", shield:"DIAMOND HANDS",chord:"POWER CHORD",balls:"BALLS ON CHIN",claw:"THE CLAW",seas:"PART THE SEAS" };
export type Racer = {
  id: number; name: string; color: string; x: number; z: number; yaw: number; velocityYaw: number;
  speed: number; s: number; offset: number; progress: number; lastS: number;
  nextCheckpoint: number; laps: number; finish: number | null; item: Item | null;
  lapTimes: number[]; lapStart: number;
  boost: number; shield: number; hit: number; drifting: boolean; driftCharge: number;
  steer: number; padCooldown: number; itemHeld: boolean; aiSkill: number; lane: number;
  stunUntil:number; specialFx?:{kind:Special;start:number;caster:boolean};
};
export type Bolt = { x:number; z:number; yaw:number; life:number; owner:number };
export type Particle = { x:number; z:number; y:number; vx:number; vz:number; life:number; color:string };
export type Stats = { boosts:number; pickups:number; hits:number; drifts:number; shots:number; checkpoints:number };
export type GameState = {
  phase: "ready"|"countdown"|"racing"|"finished"; paused:boolean; countdown:number; time:number;
  racers:Racer[]; bolts:Bolt[]; particles:Particle[]; pickupTimers:number[];
  message:string; messageTime:number; stats:Stats; seed:number; lapTimes:number[]; lapStart:number;
};
const ROSTER = RACERS.map(r=>[r.displayName,r.color] as [string,string]);
export function createGame(): GameState {
  const racers = ROSTER.map(([name,color],id):Racer => {
    const s = 12 + (2-Math.floor(id/2))*6;
    const p = atDistance(s,id%2 ? 3 : -3);
    return { id,name,color,...p,velocityYaw:p.yaw,speed:0,offset:id%2?3:-3,progress:0,lastS:s,
      nextCheckpoint:1,laps:0,lapTimes:[],lapStart:0,finish:null,item:null,boost:0,shield:0,hit:0,drifting:false,driftCharge:0,
      steer:0,padCooldown:0,itemHeld:false,aiSkill:36+id*.8,lane:id%2?3:-3,stunUntil:0 };
  });
  // Put the player at the back, with the entire grid visible from the chase camera.
  const player = racers[0]; Object.assign(player,atDistance(9,-3)); player.lastS=player.s;
  return { phase:"ready",paused:false,countdown:3,time:0,racers,bolts:[],particles:[],pickupTimers:PICKUPS.map(()=>0),message:"",messageTime:0,stats:{boosts:0,pickups:0,hits:0,drifts:0,shots:0,checkpoints:0},seed:8241,lapTimes:[],lapStart:0 };
}
function random(g:GameState) { g.seed=(Math.imul(g.seed,1664525)+1013904223)>>>0;return g.seed/4294967296; }
export function startRace(g:GameState) { if(g.phase==="ready") { g.phase="countdown";g.countdown=3; } }
export function say(g:GameState,message:string) {g.message=message;g.messageTime=1.7;}
function burst(g:GameState,r:Racer,color:string,count=8) {
  for(let i=0;i<count;i++)g.particles.push({x:r.x,z:r.z,y:.7,vx:(random(g)-.5)*12,vz:(random(g)-.5)*12,life:.3+random(g)*.5,color});
}
export function hitRacer(g:GameState,r:Racer,strength=.55) {
  if(r.hit>0||r.finish!==null)return;
  if(r.shield>0){r.shield=0;r.hit=.5;burst(g,r,"#88ffff");if(r.id===0)say(g,"SHIELD BLOCKED THE HIT");return;}
  r.speed*=strength;r.hit=.9;r.boost=0;r.driftCharge=0;burst(g,r,"#ffcb65");
  if(r.id===0){g.stats.hits++;say(g,"CONTACT!");}
}
export function activateItem(g:GameState,r:Racer) {
  const item=r.item;if(!item||r.finish!==null||g.phase!=="racing"||g.paused||r.stunUntil>g.time)return;r.item=null;
  if(SPECIALS.includes(item as Special)){
    const kind=SPECIALS[r.id];
    r.specialFx={kind,start:g.time,caster:true};
    for(const rival of g.racers){
      if(rival.id===r.id||rival.finish!==null)continue;
      if(kind==="chord"&&Math.hypot(rival.x-r.x,rival.z-r.z)>28)continue;
      rival.specialFx={kind,start:g.time,caster:false};
      if(kind==="chord"||kind==="seas"){
        const side=rival.offset<0?-1:1;
        const offset=kind==="seas"?side*(ROAD_HALF_WIDTH-2):clamp(rival.offset+side*4,-ROAD_HALF_WIDTH+2,ROAD_HALF_WIDTH-2);
        const p=atDistance(rival.s,offset);rival.x=p.x;rival.z=p.z;rival.offset=offset;
      }
      if(kind!=="chord")rival.stunUntil=Math.max(rival.stunUntil,g.time+.2);
      burst(g,rival,kind==="seas"?"#71edff":kind==="balls"?"#efab91":"#ceff70",12);
    }
    say(g,`${r.name} · ${ITEM_NAMES[kind]}`);return;
  }
  if(item==="turbo"){r.boost=2.3;if(r.id===0)g.stats.boosts++;}
  if(item==="shield")r.shield=6;
  if(item==="pulse"){g.bolts.push({x:r.x+Math.sin(r.yaw)*4,z:r.z+Math.cos(r.yaw)*4,yaw:r.yaw,life:3,owner:r.id});if(r.id===0)g.stats.shots++;}
  if(r.id===0)say(g,ITEM_NAMES[item]);
}
export function aiControls(r:Racer):Controls {
  const look=atDistance(r.s+12+r.speed*.48,r.lane);
  const error=angleDelta(Math.atan2(look.x-r.x,look.z-r.z),r.yaw);
  return {throttle:r.speed<r.aiSkill+(r.boost>0?18:0),brake:Math.abs(error)>.75&&r.speed>26,left:error<-.04,right:error>.04,drift:false,item:r.item!==null};
}
export function updateProgress(g:GameState,r:Racer,newS:number,dt:number) {
  const delta=wrap(newS-r.lastS+TRACK_LENGTH/2,TRACK_LENGTH)-TRACK_LENGTH/2;
  r.lastS=newS;
  // Ignore teleports; checkpoints must be crossed in order while on the course.
  if(Math.abs(delta)>Math.max(6,90*dt)||Math.abs(r.offset)>ROAD_HALF_WIDTH+2)return;
  r.progress+=delta;
  const target=(r.nextCheckpoint%CHECKPOINTS)*TRACK_LENGTH/CHECKPOINTS;
  const before=wrap(newS-delta-target+TRACK_LENGTH/2,TRACK_LENGTH)-TRACK_LENGTH/2;
  const after=wrap(newS-target+TRACK_LENGTH/2,TRACK_LENGTH)-TRACK_LENGTH/2;
  if(delta>0&&before<=0&&after>=0&&Math.abs(delta)<10){
    r.nextCheckpoint++;
    if(r.id===0)g.stats.checkpoints++;
    if(r.nextCheckpoint%CHECKPOINTS===1){
      r.laps++;
      r.lapTimes.push(g.time-r.lapStart);r.lapStart=g.time;
      if(r.id===0){g.lapTimes.push(g.time-g.lapStart);g.lapStart=g.time;say(g,r.laps===2?"FINAL LAP!":"LAP COMPLETE");}
      if(r.laps>=LAPS){r.finish=g.time;r.speed=0;if(r.id===0){g.phase="finished";say(g,"FINISH!");}}
    }
  }
}
export function stepGame(g:GameState,controls:Controls,dt:number,controlledId:number=0) {
  if(g.paused||g.phase==="ready"||g.phase==="finished")return;
  dt=clamp(dt,0,1/30);
  if(g.phase==="countdown"){g.countdown-=dt;if(g.countdown<=0){g.phase="racing";say(g,"GO!");}return;}
  g.time+=dt;g.messageTime=Math.max(0,g.messageTime-dt);
  g.pickupTimers=g.pickupTimers.map(t=>Math.max(0,t-dt));
  for(const r of g.racers){
    if(r.finish!==null)continue;
    if(r.stunUntil>g.time-1e-9)continue;
    const c=r.id===controlledId?controls:aiControls(r);
    r.hit=Math.max(0,r.hit-dt);r.boost=Math.max(0,r.boost-dt);r.shield=Math.max(0,r.shield-dt);r.padCooldown=Math.max(0,r.padCooldown-dt);
    const desired=(c.right?1:0)-(c.left?1:0);
    r.steer+=(desired-r.steer)*Math.min(1,dt*9);
    const drifting=c.drift&&Math.abs(r.steer)>.2&&r.speed>15&&!c.brake;
    if(r.drifting&&!drifting){
      if(r.driftCharge>=.85){r.boost=Math.max(r.boost,clamp(r.driftCharge*.7,.65,1.6));if(r.id===0){g.stats.drifts++;say(g,"DRIFT BOOST!");}}
      r.driftCharge=0;
    }
    r.drifting=drifting;
    if(drifting)r.driftCharge=Math.min(2.4,r.driftCharge+dt);
    const offroad=Math.abs(r.offset)>ROAD_HALF_WIDTH;
    const maxSpeed=r.boost>0?65:offroad?22:46;
    const acceleration=c.throttle?22: -8;
    r.speed=clamp(r.speed+(c.brake?-46:r.boost>0?36:acceleration)*dt,0,70);
    if(r.speed>maxSpeed)r.speed=Math.max(maxSpeed,r.speed-(offroad?38:18)*dt);
    r.yaw+=r.steer*(drifting?1.6:1.25)*Math.min(r.speed/17,1)*dt;
    r.velocityYaw+=angleDelta(r.yaw,r.velocityYaw)*Math.min(1,dt*(drifting?2.5:10));
    r.x+=Math.sin(r.velocityYaw)*r.speed*dt;r.z+=Math.cos(r.velocityYaw)*r.speed*dt;
    const near=nearestTrack(r.x,r.z);r.offset=near.offset;r.s=near.s;
    if(Math.abs(r.offset)>ROAD_HALF_WIDTH+4){
      const edge=atDistance(near.s,Math.sign(r.offset)*(ROAD_HALF_WIDTH+3.8));r.x=edge.x;r.z=edge.z;
      hitRacer(g,r,.58);r.yaw+=angleDelta(near.yaw,r.yaw)*.2;r.velocityYaw=r.yaw;
    }
    updateProgress(g,r,r.s,dt);
    // A spectator watches the whole field; a driver finishes on their own flag.
    if(controlledId!==0&&r.id===0&&r.finish!==null)g.phase="racing";
    if(c.item&&!r.itemHeld)activateItem(g,r);r.itemHeld=c.item;
    for(const pad of BOOST_PADS)if(Math.hypot(r.x-pad.x,r.z-pad.z)<4&&r.padCooldown===0){r.boost=1.35;r.padCooldown=2;burst(g,r,"#7bffff");if(r.id===0){g.stats.boosts++;say(g,"BOOST PAD!");}}
    for(const box of PICKUPS)if(!r.item&&g.pickupTimers[box.id]===0&&Math.hypot(r.x-box.x,r.z-box.z)<2.8){
      r.item=(["turbo","pulse","shield",SPECIALS[r.id]] as Item[])[Math.floor(random(g)*4)];g.pickupTimers[box.id]=6;
      if(r.id===0){g.stats.pickups++;say(g,"ITEM READY · PRESS X");}
    }
    for(const obstacle of OBSTACLES)if(Math.hypot(r.x-obstacle.x,r.z-obstacle.z)<2.8)hitRacer(g,r,.42);
    if((r.drifting||r.boost>0)&&random(g)<.45)g.particles.push({x:r.x-Math.sin(r.yaw)*1.8,z:r.z-Math.cos(r.yaw)*1.8,y:.25,vx:0,vz:0,life:.35,color:r.boost>0?"#80ffff":r.driftCharge>.85?"#ffc861":"#aab8e8"});
  }
  for(let a=0;a<g.racers.length;a++)for(let b=a+1;b<g.racers.length;b++){
    const r=g.racers[a],o=g.racers[b],dx=o.x-r.x,dz=o.z-r.z,d=Math.hypot(dx,dz);
    if(r.stunUntil>=g.time||o.stunUntil>=g.time)continue;
    if(d<2.6&&d>.001){const push=(2.6-d)*.5;r.x-=dx/d*push;r.z-=dz/d*push;o.x+=dx/d*push;o.z+=dz/d*push;hitRacer(g,r,.78);hitRacer(g,o,.78);}
  }
  for(const bolt of g.bolts){
    bolt.x+=Math.sin(bolt.yaw)*92*dt;bolt.z+=Math.cos(bolt.yaw)*92*dt;bolt.life-=dt;
    for(const r of g.racers)if(r.id!==bolt.owner&&Math.hypot(r.x-bolt.x,r.z-bolt.z)<3){hitRacer(g,r,.35);bolt.life=0;break;}
  }
  g.bolts=g.bolts.filter(b=>b.life>0);
  for(const p of g.particles){p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=dt*.5;}
  g.particles=g.particles.filter(p=>p.life>0).slice(-180);
  if(controlledId<0?g.racers.every(r=>r.finish!==null):g.racers.some(r=>r.id===controlledId&&r.finish!==null))g.phase="finished";
}
export function standings(g:GameState) {
  return [...g.racers].sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:(b.nextCheckpoint-a.nextCheckpoint)||((wrap(b.s-(b.nextCheckpoint-1)*TRACK_LENGTH/CHECKPOINTS,TRACK_LENGTH))-(wrap(a.s-(a.nextCheckpoint-1)*TRACK_LENGTH/CHECKPOINTS,TRACK_LENGTH))));
}
export function resetKart(g:GameState,id=0) {
  const r=g.racers.find(kart=>kart.id===id);if(!r||g.phase!=="racing")return;
  const p=atDistance(r.s);Object.assign(r,{x:p.x,z:p.z,yaw:p.yaw,velocityYaw:p.yaw,speed:0,offset:0,drifting:false,driftCharge:0,boost:0});say(g,"BACK ON TRACK");
}
