import test from "node:test";
import assert from "node:assert/strict";
import {createPool,claimSlot,claimNextSlot,placeBet,settlePool,cancelPool,collectClaim,totalPot,nextRound,fillBotSlots} from "../app/game/pool.ts";
import {createGame,startRace,stepGame,noControls} from "../app/game/simulation.ts";
import {stadiumProjection,shouldPauseOnBlur} from "../app/game/spectator.ts";
import {TRACK,ROAD_HALF_WIDTH} from "../app/game/circuit.ts";
import {RaceRenderer} from "../app/game/renderer.ts";
function lock(p){for(let i=0;i<4;i++)p=claimSlot(p,i,`driver-${i}`);return p;}
test("bot fill preserves 0–4 human seats and stakes, then locks the grid",()=>{
  for(let count=0;count<=4;count++){
    let p=placeBet(createPool(),"you",2,100);
    for(let i=0;i<count;i++)p=claimNextSlot(p,`human-${i}`);
    const next=fillBotSlots(p);
    assert.equal(next.phase,"locked");assert.equal(totalPot(next),100);
    assert.deepEqual(next.claims,{});assert.equal(next.balances.you,900);
    for(let i=0;i<4;i++)assert.equal(next.slots[i],i<count?`human-${i}`:`demo-ai-${i}`);
    assert.deepEqual(fillBotSlots(next),next);
    assert.throws(()=>placeBet(next,"you",0,1));
    assert.throws(()=>claimNextSlot(next,"late"));
    assert.equal(settlePool(next,2).claims.you,100);
  }
});
test("manual cancellation releases seats, refunds stakes and requires a new Play",()=>{
  let p=claimNextSlot(placeBet(createPool(),"you",0,100),"you");
  p=nextRound(p);
  assert.deepEqual(p.slots,[null,null,null,null]);assert.equal(p.phase,"open");
  assert.equal(p.claims.you,100);assert.equal(p.balances.you,900);assert.equal(totalPot(p),0);
  p=nextRound(p);assert.equal(p.claims.you,100);
  assert.equal(claimNextSlot(p,"you").slots[0],"you");
  assert.equal(collectClaim(p,"you").balances.you,1000);
});
test("unclaimed winnings survive subsequent settlement and cancellation",()=>{
  let p=nextRound(settlePool(lock(placeBet(createPool(),"you",0,100)),0));
  assert.equal(p.claims.you,100);
  p=nextRound(settlePool(lock(placeBet(p,"you",1,50)),1));
  assert.equal(p.claims.you,150);
  p=nextRound(placeBet(p,"you",2,25));assert.equal(p.claims.you,175);
  assert.equal(collectClaim(p,"you").balances.you,1000);
});
test("one-click join fills the next available kart with no selection",()=>{
  let p=createPool();p=claimSlot(p,1,"existing");
  p=claimNextSlot(p,"you");assert.equal(p.slots[0],"you");
  assert.throws(()=>claimNextSlot(p,"you"));
  p=claimNextSlot(p,"third");assert.equal(p.slots[2],"third");
  p=claimNextSlot(p,"fourth");assert.equal(p.slots[3],"fourth");assert.equal(p.phase,"locked");
  assert.throws(()=>claimNextSlot(p,"fifth"));assert.throws(()=>placeBet(p,"you",0,10));
});
test("four distinct claims lock betting and reject late stakes",()=>{
  let p=createPool();p=claimSlot(p,0,"a");
  assert.throws(()=>claimSlot(p,0,"b"));assert.throws(()=>claimSlot(p,1,"a"));
  p=claimSlot(p,1,"b");p=claimSlot(p,2,"c");assert.equal(p.phase,"open");
  p=claimSlot(p,3,"d");assert.equal(p.phase,"locked");assert.throws(()=>placeBet(p,"you",0,10));
});
test("stake validation and balance accounting",()=>{
  const p=createPool();for(const n of [0,-1,1.5,NaN,Infinity,1001])assert.throws(()=>placeBet(p,"you",0,n));
  for(const kart of [-1,4,NaN])assert.throws(()=>placeBet(p,"you",kart,10));
  const b=placeBet(p,"you",2,125);assert.equal(b.balances.you,875);assert.equal(totalPot(b),125);assert.equal(p.bets.length,0);
});
test("winning bettors split entire pot proportionally and can claim once",()=>{
  let p=createPool();p.balances={you:1000,alice:1000,bob:1000};
  p=placeBet(p,"you",0,50);p=placeBet(p,"alice",0,200);p=placeBet(p,"bob",1,750);
  p=settlePool(lock(p),0);assert.equal(p.claims.you,200);assert.equal(p.claims.alice,800);assert.equal(p.burned,0);
  assert.throws(()=>settlePool(p,1));assert.throws(()=>cancelPool(p));
  p=collectClaim(p,"you");assert.equal(p.balances.you,1150);assert.throws(()=>collectClaim(p,"you"));assert.equal(p.claims.alice,800);
});
test("rounding never leaves an unallocated or burnable balance",()=>{
  let p=createPool();p.balances={you:1000,a:1000,b:1000};
  p=placeBet(p,"you",0,1);p=placeBet(p,"a",0,2);p=placeBet(p,"b",1,7);
  p=settlePool(lock(p),0);assert.equal(p.claims.you+p.claims.a,10);assert.equal(p.claims.a,7);
});
test("only completed races without winning bets burn the pot",()=>{
  let p=placeBet(createPool(),"you",1,100);assert.throws(()=>settlePool(p,0));
  p=settlePool(lock(p),0);assert.equal(p.phase,"burned");assert.equal(p.burned,100);assert.deepEqual(p.claims,{});assert.throws(()=>cancelPool(p));
});
test("cancellation preserves original stakes for a single refund",()=>{
  for(const locked of [false,true]){
    let p=placeBet(createPool(),"you",1,100);p=placeBet(p,"you",2,75);if(locked)p=lock(p);
    p=cancelPool(p);assert.equal(p.claims.you,175);assert.equal(p.burned,0);assert.throws(()=>settlePool(p,1));
    p=collectClaim(p,"you");assert.equal(p.balances.you,1000);assert.throws(()=>collectClaim(p,"you"));
  }
});
test("spectator simulation drives all four karts to a finish",()=>{
  const g=createGame();startRace(g);let frames=0;
  while(g.phase!=="finished"&&frames++<60*240)stepGame(g,noControls(),1/60,-1);
  assert.equal(g.racers.length,4);assert.equal(g.phase,"finished");assert.ok(g.racers.every(r=>r.laps===3));
});
test("claiming another kart routes driving input to that kart",()=>{
  const g=createGame();g.phase="racing";
  for(let i=0;i<60;i++)stepGame(g,noControls(),1/60,2);
  assert.equal(g.racers[2].speed,0);assert.ok(g.racers[0].speed>0);
});
test("spectators never pause on focus loss; local drivers retain safety pause",()=>{
  assert.equal(shouldPauseOnBlur(-1),false);
  for(let id=0;id<4;id++)assert.equal(shouldPauseOnBlur(id),true);
});
test("stadium camera contains the complete track and road edges on wide and tall canvases",()=>{
  for(const height of [450,600,1000]){
    const {project}=stadiumProjection(800,height);
    for(const p of TRACK)for(const offset of [-ROAD_HALF_WIDTH,ROAD_HALF_WIDTH]){
      const q=project(p.x+Math.cos(p.yaw)*offset,p.z-Math.sin(p.yaw)*offset);
      assert.ok(q.x>=24&&q.x<=776);assert.ok(q.y>=24&&q.y<=height-24);
    }
  }
});
test("stadium renders each racer label, and each chase camera follows the chosen kart",()=>{
  const labels=[];
  const ctx=new Proxy({fillText:text=>labels.push(text)},{get:(target,key)=>key in target?target[key]:()=>{}});
  const canvas={width:800,height:450,clientWidth:800,clientHeight:450,getContext:()=>ctx};
  const game=createGame(),renderer=new RaceRenderer(canvas,game);
  renderer.render(game,1/60,-1);
  for(const r of game.racers)assert.ok(labels.includes(r.name));
  // Isolate camera transform from drawing, already covered by the stadium pass.
  for(const method of ["sky","track","scenery","kart","minimap"])renderer[method]=()=>{};
  for(const r of game.racers){
    renderer.render(game,1,r.id);
    assert.ok(Math.abs(renderer.cameraX-(r.x-Math.sin(renderer.yaw)*11.5))<.001);
    assert.ok(Math.abs(renderer.cameraZ-(r.z-Math.cos(renderer.yaw)*11.5))<.001);
  }
});
