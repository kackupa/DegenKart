import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceRoom} from '../server/src/room.js';
test('four unique seats, fifth rejected, everyone sees the same race',()=>{
  const room=new RaceRoom();room.lobby(1000);
  for(let i=0;i<4;i++)assert.equal(room.join('p'+i,1001),i);
  assert.throws(()=>room.join('fifth',1002));assert.equal(room.game.phase,'countdown');
  assert.equal(room.snapshot('p1',1002).you,1);assert.equal(room.snapshot('spectator',1002).you,-1);
  assert.equal(room.snapshot('p0',1002).game,room.snapshot('spectator',1002).game);
});
test('30 second lobby fills bots, releases seats each round and does not idle-kick waiting players',()=>{
  const room=new RaceRoom();room.lobby(1000);room.join('p',1001);room.tick(30999);assert.equal(room.game.phase,'ready');
  room.tick(31000);assert.equal(room.game.phase,'countdown');room.tick(31017);assert.equal(room.seats[0],'p');
  assert.equal(room.snapshot('p',31017).slots[1],'bot');room.lobby(40000);assert.equal(room.seats[0],null);
});
test('only own controls accepted; disconnect hands kart to AI',()=>{
  const room=new RaceRoom();room.lobby(0);room.join('p',1);room.game.phase='racing';
  room.input('spectator',{throttle:true},1);assert.equal(room.inputs.has('spectator'),false);
  room.input('p',{throttle:true,x:99999,item:'yes'},1);assert.equal(room.inputs.get('p').controls.item,false);
  const start=room.game.racers[0].x;for(let i=0;i<20;i++)room.tick(2+i*16);assert.ok(room.game.racers[0].speed>0);assert.notEqual(room.game.racers[0].x,start);
  room.leave('p');assert.equal(room.snapshot('p',400).you,-1);assert.equal(room.snapshot('p',400).slots[0],'bot');
});
test('finished round returns to lobby and stale input expires',()=>{
  const room=new RaceRoom();room.lobby(0);room.join('p',1);room.game.phase='racing';room.input('p',{throttle:true},1);
  room.tick(1000);assert.equal(room.game.racers[0].speed,0);
  room.tick(21000);assert.equal(room.seats[0],null);
  room.game.phase='finished';room.finishedAt=22000;room.tick(26000);assert.equal(room.game.phase,'ready');assert.equal(room.deadline,56000);
});
