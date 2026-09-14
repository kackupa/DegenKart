import test from "node:test";
import assert from "node:assert/strict";
import { createGame, stepGame, startRace, noControls, activateItem, hitRacer, updateProgress, aiControls, resetKart, standings } from "../app/game/simulation.ts";
import { atDistance, TRACK_LENGTH, CHECKPOINTS, BOOST_PADS, PICKUPS, OBSTACLES, angleDelta } from "../app/game/circuit.ts";

function tick(g,c,seconds) { for(let i=0;i<Math.ceil(seconds*60);i++)stepGame(g,c,1/60); }
function racing() {const g=createGame();g.phase="racing";return g;}
function place(r,s,offset=0) {const p=atDistance(s,offset);Object.assign(r,p,{offset,lastS:p.s,velocityYaw:p.yaw});}

test("start grid and countdown do not drive the player automatically",()=>{
  const g=createGame(),p=g.racers[0],start={x:p.x,z:p.z};
  tick(g,{...noControls(),throttle:true},1);assert.equal(p.speed,0);
  startRace(g);tick(g,noControls(),3.1);assert.equal(g.phase,"racing");
  tick(g,noControls(),1);assert.equal(p.speed,0);assert.equal(p.x,start.x);assert.equal(p.z,start.z);
});
test("throttle moves world coordinates; braking stops; steering turns the heading",()=>{
  const g=racing(),p=g.racers[0];g.racers=[p];
  place(p,35);const x=p.x,z=p.z,yaw=p.yaw;
  tick(g,{...noControls(),throttle:true},1.4);assert.ok(p.speed>25);assert.ok(Math.hypot(p.x-x,p.z-z)>18);
  tick(g,{...noControls(),right:true,throttle:true},.2);assert.ok(angleDelta(p.yaw,yaw)>.06);
  tick(g,{...noControls(),brake:true},1);assert.equal(p.speed,0);
});
test("drifting builds charge and releasing grants a timed boost",()=>{
  const g=racing(),p=g.racers[0];g.racers=[p];place(p,120);p.speed=21;
  tick(g,{...noControls(),throttle:true,drift:true,left:true},1.05);
  assert.ok(p.driftCharge>.85);
  stepGame(g,{...noControls(),throttle:true},1/60);assert.ok(p.boost>0);assert.equal(g.stats.drifts,1);assert.equal(p.driftCharge,0);
});
test("boost pads trigger by world proximity, not by elapsed time",()=>{
  const g=racing(),p=g.racers[0];g.racers=[p];place(p,BOOST_PADS[0].s,BOOST_PADS[0].offset);
  stepGame(g,noControls(),1/60);assert.ok(p.boost>1);assert.equal(g.stats.boosts,1);
  stepGame(g,noControls(),1/60);assert.equal(g.stats.boosts,1);
});
test("crates give one consumable item, disappear and respawn",()=>{
  const g=racing(),p=g.racers[0];g.racers=[p];place(p,PICKUPS[0].s,PICKUPS[0].offset);
  stepGame(g,noControls(),1/60);assert.ok(p.item);assert.ok(g.pickupTimers[0]>5);
  activateItem(g,p);assert.equal(p.item,null);place(p,100);
  tick(g,noControls(),6.1);assert.equal(g.pickupTimers[0],0);
});
test("pulse projectiles hit opponents and a shield absorbs a hit",()=>{
  const g=racing(),p=g.racers[0],target=g.racers[1];g.racers=[p,target];place(p,50);place(target,59);target.speed=20;
  p.item="pulse";activateItem(g,p);assert.equal(g.bolts.length,1);
  tick(g,noControls(),.12);assert.ok(target.hit>0);assert.equal(g.bolts.length,0);
  p.shield=5;p.speed=40;hitRacer(g,p);assert.equal(p.shield,0);assert.equal(p.speed,40);
});
test("afterburner increases top speed and shield expires",()=>{
  const g=racing(),p=g.racers[0];g.racers=[p];place(p,55);p.speed=40;
  p.item="turbo";activateItem(g,p);assert.equal(p.item,null);tick(g,{...noControls(),throttle:true},.5);assert.ok(p.speed>46);
  p.item="shield";activateItem(g,p);assert.equal(p.shield,6);p.speed=0;p.boost=0;tick(g,noControls(),6.1);assert.equal(p.shield,0);
});
test("kart, barrier and obstacle collisions reduce speed",()=>{
  const g=racing(),p=g.racers[0],r=g.racers[1];g.racers=[p,r];place(p,110);place(r,111);p.speed=40;
  stepGame(g,noControls(),1/60);assert.ok(p.speed<35);assert.ok(g.stats.hits>0);
  g.racers=[p];p.hit=0;place(p,40,17);p.speed=40;stepGame(g,noControls(),1/60);assert.ok(p.speed<30);
  p.hit=0;place(p,OBSTACLES[0].s,-6);p.speed=35;stepGame(g,noControls(),1/60);assert.ok(p.speed<20);
});
test("checkpoint order prevents a finish-line shortcut and reversed crossings",()=>{
  const g=racing(),p=g.racers[0];place(p,TRACK_LENGTH-1);
  updateProgress(g,p,.1,1/60);assert.equal(p.laps,0);assert.equal(p.nextCheckpoint,1);
  p.lastS=TRACK_LENGTH/CHECKPOINTS+1;updateProgress(g,p,TRACK_LENGTH/CHECKPOINTS-.1,1/60);assert.equal(p.nextCheckpoint,1);
  for(let lap=0;lap<3;lap++)for(let gate=1;gate<=CHECKPOINTS;gate++){
    const target=(gate%CHECKPOINTS)*TRACK_LENGTH/CHECKPOINTS;p.lastS=(target-1+TRACK_LENGTH)%TRACK_LENGTH;p.offset=0;
    updateProgress(g,p,(target+.1)%TRACK_LENGTH,1/60);
  }
  assert.equal(p.laps,3);assert.equal(g.phase,"finished");assert.equal(g.stats.checkpoints,24);
});
test("a complete race can be driven through the real physics with AI steering",()=>{
  const g=racing();let frames=0;
  while(g.phase!=="finished"&&frames<60*240){stepGame(g,aiControls(g.racers[0]),1/60);frames++;}
  assert.equal(g.phase,"finished",JSON.stringify(g.racers.map(r=>({name:r.name,lap:r.laps,s:r.s,speed:r.speed,gate:r.nextCheckpoint}))));
  assert.equal(g.racers[0].laps,3);assert.equal(g.lapTimes.length,3);assert.ok(g.stats.checkpoints===24);
  assert.ok(g.racers.slice(1).every(r=>r.laps>=2));assert.equal(standings(g).length,4);
});
test("pause freezes the simulation and reset retains checkpoint history",()=>{
  const g=racing(),p=g.racers[0];p.speed=30;g.paused=true;const before=JSON.stringify(g);tick(g,noControls(),1);assert.equal(JSON.stringify(g),before);
  g.paused=false;p.nextCheckpoint=5;p.yaw+=2;resetKart(g);assert.equal(p.speed,0);assert.equal(p.nextCheckpoint,5);assert.equal(p.offset,0);
});
