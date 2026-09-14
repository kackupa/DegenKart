import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from '../server/node_modules/ws/wrapper.mjs';
// Run against the local test server, never against the public race.
const url='ws://localhost:10001/race';
function wait(client,predicate){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{client.off('message',check);reject(new Error('Timed out waiting for race message'));},5000);function check(raw){const data=JSON.parse(raw);if(predicate(data)){clearTimeout(timeout);client.off('message',check);resolve(data);}}client.on('message',check);});}
test('five WebSocket clients share a race, four claim seats, inputs stay owned, admin reset is protected',async t=>{
  const clients=Array.from({length:5},()=>new WebSocket(url,{origin:'http://localhost:3001'}));
  t.after(()=>clients.forEach(c=>c.close()));
  await Promise.all(clients.map(c=>wait(c,d=>d.type==='state')));
  const denied=wait(clients[0],d=>d.type==='admin-result');clients[0].send(JSON.stringify({type:'admin-reset',password:'wrong'}));assert.equal((await denied).ok,false);
  const allowed=wait(clients[0],d=>d.type==='admin-result');clients[0].send(JSON.stringify({type:'admin-reset',password:'local-integration-test'}));assert.equal((await allowed).ok,true);
  const ready=await wait(clients[4],d=>d.type==='state'&&d.game.phase==='ready');assert.equal(ready.lobbySeconds,30);
  for(let i=0;i<4;i++){const assigned=wait(clients[i],d=>d.type==='state'&&d.you===i);clients[i].send(JSON.stringify({type:'join'}));await assigned;}
  const fifth=wait(clients[4],d=>d.type==='error');clients[4].send(JSON.stringify({type:'join'}));assert.match((await fifth).message,/next race|full/i);
  const racing=await wait(clients[4],d=>d.type==='state'&&d.game.phase==='racing');assert.equal(racing.you,-1);assert.equal(racing.slots.filter(s=>s==='player').length,4);
  clients[0].send(JSON.stringify({type:'input',controls:{throttle:true},kart:1,x:99999}));
  const moving=await wait(clients[4],d=>d.type==='state'&&d.game.racers[0].speed>1);
  assert.equal(moving.game.racers[1].speed,0);assert.ok(moving.game.racers[0].x<99999);
  clients[0].close();const bots=await wait(clients[4],d=>d.type==='state'&&d.slots[0]==='bot');assert.equal(bots.you,-1);
});
