import {createServer} from 'node:http';
import {randomUUID,timingSafeEqual,createHash} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {RaceRoom} from './room.js';

const room=new RaceRoom();
const origins=new Set((process.env.ALLOWED_ORIGINS||'https://kackupa.github.io').split(',').map(s=>s.trim()));
const adminPassword=process.env.ADMIN_PASSWORD;
const digest=value=>createHash('sha256').update(value).digest();
const http=createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url!=='/health'){res.writeHead(404);res.end('{}');return;}
  res.end(JSON.stringify({status:'ok',round:room.round,phase:room.game.phase,connections:wss.clients.size}));
});
const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
http.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/race'||!origins.has(req.headers.origin)||wss.clients.size>=250){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
const adminAttempts=new Map();
wss.on('connection',(ws,req)=>{
  ws.id=randomUUID();ws.alive=true;ws.window=Date.now();ws.count=0;
  const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim();
  const send=data=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
  ws.on('pong',()=>{ws.alive=true;});ws.on('error',()=>{});
  ws.on('message',data=>{
    const now=Date.now();if(now-ws.window>1000){ws.window=now;ws.count=0;}
    if(++ws.count>60){ws.close(1008,'Too many messages');return;}
    let message;try{message=JSON.parse(data);}catch{return;}
    if(!message||typeof message!=='object')return;
    try{
      if(message.type==='join')room.join(ws.id,now);
      if(message.type==='input')room.input(ws.id,message.controls,now);
      if(message.type==='leave')room.leave(ws.id);
      if(message.type==='reset-kart')room.resetKart(ws.id);
      if(message.type==='admin-reset'){
        const attempt=adminAttempts.get(ip)||{count:0,until:now+60000};
        if(now>attempt.until){attempt.count=0;attempt.until=now+60000;}
        attempt.count++;adminAttempts.set(ip,attempt);
        const valid=attempt.count<=5&&adminPassword&&typeof message.password==='string'&&timingSafeEqual(digest(message.password),digest(adminPassword));
        if(!valid){send({type:'admin-result',ok:false,message:'Reset denied. Check your password or wait one minute.'});return;}
        room.lobby(now);send({type:'admin-result',ok:true});
      }
    }catch(error){send({type:'error',message:error.message});}
  });
  ws.on('close',()=>room.leave(ws.id));send(room.snapshot(ws.id,Date.now()));
});
const tick=setInterval(()=>room.tick(Date.now()),1000/60);
const broadcast=setInterval(()=>{
  const now=Date.now();for(const ws of wss.clients){
    if(ws.bufferedAmount>128000){ws.close(1013,'Connection too slow');continue;}
    if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({...room.snapshot(ws.id,now),viewers:wss.clients.size-room.seats.filter(Boolean).length}));
  }
},50);
const heartbeat=setInterval(()=>{
  for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}
  for(const [ip,attempt] of adminAttempts)if(Date.now()>attempt.until)adminAttempts.delete(ip);
},10000);
http.listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>console.log('Shared race server listening'));
process.on('SIGTERM',()=>{clearInterval(tick);clearInterval(broadcast);clearInterval(heartbeat);for(const ws of wss.clients)ws.close(1012,'Server restarting');http.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();});
