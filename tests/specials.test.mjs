import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,activateItem,stepGame,noControls,SPECIALS,ITEM_NAMES} from '../app/game/simulation.ts';
import {atDistance,ROAD_HALF_WIDTH} from '../app/game/circuit.ts';
import {drawSpecial} from '../app/game/special-effects.ts';
function game(){const g=createGame();g.phase='racing';g.racers.forEach((r,i)=>{Object.assign(r,atDistance(60+i*7,i%2?3:-3));r.lastS=r.s;r.offset=i%2?3:-3;r.speed=20;});return g;}
test('each driver consumes their own special; caster is unaffected',()=>{
  for(let i=0;i<4;i++){
    const g=game(),r=g.racers[i];r.item=SPECIALS[i];const before={x:r.x,z:r.z,speed:r.speed};activateItem(g,r);
    assert.equal(r.item,null);assert.equal(r.specialFx.kind,SPECIALS[i]);assert.equal(r.stunUntil,0);
    assert.deepEqual({x:r.x,z:r.z,speed:r.speed},before);
    for(const other of g.racers.filter(k=>k!==r)){assert.equal(other.specialFx.kind,SPECIALS[i]);assert.equal(other.stunUntil,i===0?0:.2);}
  }
  assert.equal(ITEM_NAMES.balls,'BALLS ON CHIN');
});
test('stun prevents motion for 0.2 seconds and resumes without destroying speed',()=>{
  for(const id of [1,2,3]){
    const g=game();g.racers[id].item=SPECIALS[id];activateItem(g,g.racers[id]);
    const r=g.racers[0],x=r.x,z=r.z;
    for(let i=0;i<12;i++)stepGame(g,noControls(),1/60,-1);
    assert.equal(r.x,x);assert.equal(r.z,z);assert.equal(r.speed,20);
    stepGame(g,noControls(),1/60,-1);assert.ok(Math.hypot(r.x-x,r.z-z)>0);
  }
});
test('sea moves rivals to safe track edges without advancing checkpoints',()=>{
  const g=game(),r=g.racers[3];r.item='seas';activateItem(g,r);
  for(const other of g.racers.slice(0,3)){assert.equal(Math.abs(other.offset),ROAD_HALF_WIDTH-2);assert.equal(other.nextCheckpoint,1);assert.equal(other.progress,0);}
});
test('finished racers and non-racing phases cannot be attacked',()=>{
  const g=game();g.racers[0].finish=1;g.racers[2].item='claw';activateItem(g,g.racers[2]);assert.equal(g.racers[0].specialFx,undefined);
  g.phase='ready';g.racers[2].item='claw';activateItem(g,g.racers[2]);assert.equal(g.racers[2].item,'claw');
});
test('all effects draw across their timelines without mutating racers',()=>{
  for(const kind of SPECIALS)for(const caster of [true,false])for(const time of [0,.1,.2,.5,1,1.2]){
    const r={specialFx:{kind,start:0,caster}},before=JSON.stringify(r);let calls=0;
    const c=new Proxy({},{get:()=>()=>calls++});drawSpecial(c,r,time,160,160);
    assert.equal(JSON.stringify(r),before);if(time<=1.1)assert.ok(calls>0);
  }
});
