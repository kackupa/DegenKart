import test from "node:test";
import assert from "node:assert/strict";
import {kartMotion,drawAnimatedKart} from "../app/game/kart-animation.ts";
const kart={id:0,steer:0,speed:20,finish:null,hit:0,drifting:false,driftCharge:0,boost:0,shield:0};
test("camera heading selects rear, both turns and oncoming artwork",()=>{
  assert.equal(kartMotion(kart,1,0).frame,0);
  assert.equal(kartMotion(kart,1,.7).frame,1);
  assert.equal(kartMotion(kart,1,-.7).frame,2);
  assert.equal(kartMotion(kart,1,Math.PI).frame,3);
});
test("stationary and finished karts stop wheel motion; drift increases lean",()=>{
  assert.equal(kartMotion({...kart,speed:0},1,0).moving,false);
  assert.equal(kartMotion({...kart,finish:1},1,0).moving,false);
  const turn={...kart,steer:1};
  assert.ok(Math.abs(kartMotion({...turn,drifting:true},1,0).lean)>Math.abs(kartMotion(turn,1,0).lean));
  assert.equal(kartMotion(kart,1,0,12).braking,true);
  assert.equal(kartMotion({...kart,hit:.2},1,0,12).braking,false);
});
test("every visual state draws its sprite without altering simulation",()=>{
  for(const state of [{},{drifting:true,driftCharge:1},{boost:1},{shield:1},{hit:.2},{finish:1}]){
    const racer={...kart,...state},original=JSON.stringify(racer);let draws=0;
    const c=new Proxy({drawImage:()=>draws++},{get:(obj,key)=>key in obj?obj[key]:()=>{}});
    drawAnimatedKart(c,{},racer,1,160,160,kartMotion(racer,1,0));
    assert.equal(draws,1);assert.equal(JSON.stringify(racer),original);
  }
});
