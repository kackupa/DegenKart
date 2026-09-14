"use client";
import {useEffect,useRef,useState} from 'react';
import {RaceRenderer} from './renderer';
import {createGame,noControls,standings,ITEM_NAMES,type Controls,type GameState} from './simulation';
import {angleDelta} from './circuit';
import './broadcast.css';

type Snapshot={type:'state';round:number;game:GameState;you:number;slots:(string|null)[];lobbySeconds:number;viewers:number;result:{round:number;winner:string}|null};
const keys:Record<string,keyof Controls>={KeyW:'throttle',ArrowUp:'throttle',KeyS:'brake',ArrowDown:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'drift',ShiftLeft:'drift',KeyX:'item'};
export default function MultiplayerGame({url}:{url:string}){
  const canvas=useRef<HTMLCanvasElement>(null),dialog=useRef<HTMLDialogElement>(null);
  const socket=useRef<WebSocket|null>(null),input=useRef(noControls()),follow=useRef(-1),driver=useRef(-1);
  const [state,setState]=useState<Snapshot|null>(null),[status,setStatus]=useState('Connecting to the shared race…');
  const [connected,setConnected]=useState(false),[notice,setNotice]=useState(''),[camera,setCamera]=useState(-1),[adminError,setAdminError]=useState('');
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
  const send=(message:object)=>{if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify(message));};
  useEffect(()=>{
    if(!canvas.current)return;
    const renderer=new RaceRenderer(canvas.current,createGame());
    let latest:Snapshot|null=null,previous:Snapshot|null=null,received=0,last=performance.now(),frame=0,stopped=false,retry=1000;
    let reconnect:ReturnType<typeof setTimeout>,lastStateAt=0,lastRound=0;
    const keyboard=new Set<string>(),pointers=new Map<number,keyof Controls>();
    const sync=()=>{const c=noControls();for(const code of keyboard){const key=keys[code];if(key)c[key]=true;}for(const key of pointers.values())c[key]=true;input.current=c;};
    const clear=()=>{keyboard.clear();pointers.clear();input.current=noControls();send({type:'input',controls:input.current});};
    const connect=()=>{
      const ws=new WebSocket(url);socket.current=ws;
      ws.onmessage=event=>{
        let data;try{data=JSON.parse(event.data);}catch{return;}
        if(data.type==='state'){
          if(latest&&latest.round===data.round&&data.game.phase==='racing'&&data.game.time>5){const before=standings(latest.game)[0],after=standings(data.game)[0];if(before.id!==after.id)setNotice(`${after.name} takes the lead`);}
          previous=latest;latest=data;received=performance.now();lastStateAt=received;retry=1000;
          if(lastRound!==data.round){previous=null;lastRound=data.round;clear();follow.current=-1;setCamera(-1);}
          if(driver.current!==data.you){clear();driver.current=data.you;}
          setConnected(true);setStatus('');setState(data);
        }else if(data.type==='error')setNotice(data.message);
        else if(data.type==='admin-result'){if(data.ok){dialog.current?.close();setNotice('New lobby opened.');}else setAdminError(data.message);}
      };
      ws.onclose=()=>{if(stopped)return;clear();driver.current=-1;setConnected(false);setStatus('Reconnecting… Your kart is handled by a bot.');reconnect=setTimeout(connect,retry+Math.random()*500);retry=Math.min(15000,retry*2);};
      ws.onerror=()=>ws.close();
    };
    connect();
    const sender=setInterval(()=>{
      if(socket.current?.readyState===WebSocket.OPEN){
        send({type:'input',controls:input.current});
        if(lastStateAt&&performance.now()-lastStateAt>5000)socket.current.close();
      }
    },50);
    const down=(event:KeyboardEvent)=>{
      if(driver.current<0||event.target instanceof Element&&event.target.closest('input,dialog,textarea'))return;
      if(keys[event.code]){event.preventDefault();keyboard.add(event.code);sync();}
      if(event.code==='KeyR'&&!event.repeat)send({type:'reset-kart'});
    };
    const up=(event:KeyboardEvent)=>{keyboard.delete(event.code);sync();};
    const visibility=()=>{if(document.hidden)clear();};
    const pointer=(event:PointerEvent)=>{
      const target=(event.target as Element).closest<HTMLButtonElement>('[data-drive]');if(!target)return;
      event.preventDefault();target.setPointerCapture(event.pointerId);pointers.set(event.pointerId,target.dataset.drive as keyof Controls);sync();
    };
    const release=(event:PointerEvent)=>{pointers.delete(event.pointerId);sync();};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pointerdown',pointer);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);window.addEventListener('lostpointercapture',release);
    const animate=(now:number)=>{
      const dt=Math.min(.1,(now-last)/1000);last=now;
      if(latest){
        const t=Math.min(1,(now-received)/50),game=latest.game;
        const renderGame=previous&&previous.round===latest.round?{...game,time:previous.game.time+(game.time-previous.game.time)*t,racers:game.racers.map((r,i)=>{const p=previous!.game.racers[i];return {...r,x:p.x+(r.x-p.x)*t,z:p.z+(r.z-p.z)*t,yaw:p.yaw+angleDelta(r.yaw,p.yaw)*t};})}:game;
        renderer.render(renderGame,dt,latest.you>=0?latest.you:follow.current);
      }
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    return()=>{stopped=true;clearTimeout(reconnect);clearInterval(sender);cancelAnimationFrame(frame);socket.current?.close();renderer.releaseFrames();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pointerdown',pointer);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);window.removeEventListener('lostpointercapture',release);};
  },[url]);
  const game=state?.game,you=connected?(state?.you??-1):-1,board=game?standings(game):[];
  const racer=game?.racers[you>=0?you:camera>=0?camera:board[0]?.id??0];
  const lobby=game?.phase==='ready',position=board.findIndex(r=>r.id===you)+1;
  const selectCamera=(id:number)=>{follow.current=id;setCamera(id);};
  const label=(name:string)=>name==='kekityket'?'KekityKek':name==='smille'?'Smille':name==='damoos3'?'DaMoos3':name;
  const announcement=game?.phase==='finished'?`${state?.result?.winner??board[0]?.name} wins!`:game&&game.messageTime>0&&game.message!=='GO!'?game.message:notice;
  return <main className={`broadcast-race ${you>=0?'is-driving':''}`} aria-label="Pepecoin Kart live race">
    <canvas className="broadcast-canvas" ref={canvas} aria-label={you>=0?'Your kart: W accelerate, S brake, A/D steer, Space drift, X item':camera<0?'Stadium view: entire track':'Following '+label(racer?.name??'kart')} tabIndex={0}/>
    <header className="broadcast-top">
      <a className="broadcast-logo" href="./" aria-label="Pepecoin Kart home">PEPECOIN<span>KART</span><small>KEKSPACE CIRCUIT</small></a>
      <div className="broadcast-clock"><span className={connected?'live-dot':''}>{connected?'LIVE':'CONNECTING'}</span><strong>{!connected?'Joining the broadcast':lobby?`Next race in ${state?.lobbySeconds}s`:game?.phase==='countdown'?'On the grid':game?.phase==='finished'?'Race complete':`Lap ${Math.min(3,(racer?.laps??0)+1)} / 3`}</strong><small>Race {state?.round??'—'} · {state?.viewers??0} watching</small></div>
      <details className="broadcast-settings"><summary aria-label="Settings" title="Settings">⚙</summary><div><strong>Race settings</strong>{you>=0&&<button onClick={()=>send({type:'leave'})}>Leave kart</button>}<button disabled={!connected} onClick={()=>{setAdminError('');dialog.current?.showModal();}}>Admin · reset lobby</button><small>WASD / arrows · Drive<br/>Space · Drift · X · Item</small></div></details>
    </header>
    <nav className="broadcast-board" aria-label="Leaderboard">
      {board.map((r,i)=><button key={r.id} disabled={you>=0} aria-pressed={you>=0?you===r.id:camera===r.id} aria-label={`${i+1}. ${label(r.name)}, ${state?.slots[r.id]==='bot'?'bot':state?.slots[r.id]?'human':'open seat'}${you<0?', follow kart':''}`} onClick={()=>selectCamera(r.id)}>
        <span className="board-rank">{i+1}</span><i style={{background:r.color}}/><span className="board-name">{label(r.name)}</span><small>{r.id===you?'YOU':state?.slots[r.id]==='bot'?'BOT':state?.slots[r.id]?'HUMAN':'OPEN'}</small>{r.finish!==null&&<span title="Finished">⚑</span>}
      </button>)}
    </nav>
    {status&&<div className="broadcast-toast connection" role="status">{status}<small>The free server may need a minute to wake.</small></div>}
    {connected&&announcement&&<div className={`broadcast-toast ${game?.phase==='finished'?'winner':''}`} role="status"><small>{game?.phase==='finished'?'CHEQUERED FLAG':'ON TRACK'}</small>{announcement}</div>}
    {game?.phase==='countdown'&&<div className="broadcast-countdown" role="status">{Math.ceil(game.countdown)}</div>}
    {you>=0&&racer&&<div className="broadcast-driver-hud"><strong>{position}<small> / 4</small></strong><span>{Math.round(racer.speed*3.6)} <small>KM/H</small></span><div className="broadcast-item"><small>ITEM · X</small><b>{racer.item?ITEM_NAMES[racer.item]:'Collect a box'}</b></div></div>}
    {you<0?<footer className="broadcast-bottom">
      <div className="broadcast-view-label"><span>{camera<0?'TRACKSIDE':'ON BOARD'}</span><strong>{camera<0?'The whole race':label(racer?.name??'')}</strong></div>
      <nav className="broadcast-cameras" aria-label="Race cameras"><button aria-pressed={camera===-1} onClick={()=>selectCamera(-1)}>Stadium</button>{game?.racers.map(r=><button key={r.id} aria-pressed={camera===r.id} onClick={()=>selectCamera(r.id)}>{label(r.name)}</button>)}</nav>
      <div className="broadcast-join"><button disabled={!connected||!lobby} onClick={()=>{setNotice('');send({type:'join'});}}>{!connected?'Connecting…':lobby?'Play':'Next race soon'}{connected&&lobby&&<span>↗</span>}</button><small>{lobby?`${4-(state?.slots.filter(Boolean).length??0)} places open · No sign-up`:'Watch now. Join the next grid.'}</small></div>
    </footer>:<>
      <div key={state?.round} className="broadcast-driving-hint">{lobby?`You’re in · starts in ${state?.lobbySeconds}s`:'WASD / arrows to drive · Space to drift · X to use item'}</div>
      <div className="broadcast-touch" aria-label="Driving controls">
        <div>{(['left','right'] as (keyof Controls)[]).map(key=><button key={key} data-drive={key} aria-label={`Steer ${key}`}>{key==='left'?'◀':'▶'}</button>)}</div>
        <div>{(['brake','drift','item','throttle'] as (keyof Controls)[]).map(key=><button key={key} data-drive={key} className={key} disabled={key==='item'&&!racer?.item}>{key==='throttle'?'GO':key.toUpperCase()}</button>)}</div>
      </div>
    </>}
    <dialog className="broadcast-dialog" ref={dialog} aria-labelledby="admin-title" onClose={()=>dialog.current?.querySelector('form')?.reset()}>
      <form onSubmit={e=>{e.preventDefault();setAdminError('Checking…');send({type:'admin-reset',password:new FormData(e.currentTarget).get('password')});}}>
        <small>ADMIN ONLY</small><h2 id="admin-title">Reset shared lobby</h2><p>This ends the current race for everyone.</p><label>Admin password<input name="password" type="password" required autoComplete="off"/></label>
        <p role="alert">{adminError}</p><div><button type="button" onClick={()=>dialog.current?.close()}>Cancel</button><button disabled={!connected}>Reset lobby</button></div>
      </form>
    </dialog>
  </main>;
}
