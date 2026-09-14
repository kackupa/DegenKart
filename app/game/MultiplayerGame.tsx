"use client";
import {useEffect,useRef,useState} from 'react';
import {RaceRenderer} from './renderer';
import {createGame,noControls,standings,ITEM_NAMES,type Controls,type GameState} from './simulation';
import {angleDelta} from './circuit';
import PoolPanel from './PoolPanel';
import {createPool} from './pool';

type Snapshot={type:'state';round:number;game:GameState;you:number;slots:(string|null)[];lobbySeconds:number;viewers:number;result:{round:number;winner:string}|null};
const keys:Record<string,keyof Controls>={KeyW:'throttle',ArrowUp:'throttle',KeyS:'brake',ArrowDown:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'drift',ShiftLeft:'drift',KeyX:'item'};
export default function MultiplayerGame({url}:{url:string}){
  const canvas=useRef<HTMLCanvasElement>(null),dialog=useRef<HTMLDialogElement>(null);
  const socket=useRef<WebSocket|null>(null),input=useRef(noControls()),follow=useRef(-1),driver=useRef(-1);
  const [state,setState]=useState<Snapshot|null>(null),[status,setStatus]=useState('Connecting to the shared race…');
  const [connected,setConnected]=useState(false),[notice,setNotice]=useState(''),[camera,setCamera]=useState(-1),[adminError,setAdminError]=useState('');
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
  const game=state?.game,you=state?.you??-1,racer=game?.racers[you>=0?you:camera>=0?camera:0];
  const pool={...createPool(),phase:connected&&game?.phase==='ready'?'open' as const:'locked' as const,slots:state?.slots??[null,null,null,null]};
  return <main className={`game-shell ${you<0?'spectator-shell':'driver-shell'}`}>
    <header className="masthead"><a className="brand" href="./">PEPECOIN KART</a><span className="session-badge">{connected?`LIVE · ${state?.viewers??0} WATCHING`:'CONNECTING'}</span></header>
    <div className="race-layout"><section className="play-column" aria-label="Shared race">
      <div className="screen-frame">
        <canvas ref={canvas} aria-label={you>=0?'Your kart: W accelerate, S brake, A/D steer, Space drift, X item':camera<0?'Stadium view':'Kart chase view'} tabIndex={0}/>
        <div className="race-hud"><div className="lap-display">RACE {state?.round??'—'} · LAP {Math.min(3,(racer?.laps??0)+1)}/3 <time>{game?`${Math.floor(game.time/60)}:${(game.time%60).toFixed(1).padStart(4,'0')}`:'—'}</time></div></div>
        {status&&<div className="broadcast-status" role="status">{status}<small style={{display:'block'}}>A sleeping free server can take about a minute to wake.</small></div>}
        {connected&&game?.phase==='ready'&&<div className="broadcast-status">NEXT RACE · 0:{String(state?.lobbySeconds??30).padStart(2,'0')} · {state?.slots.filter(Boolean).length}/4 READY</div>}
        {game?.phase==='countdown'&&<div className="countdown-overlay"><strong>{Math.ceil(game.countdown)}</strong></div>}
        {game?.phase==='finished'&&<div className="broadcast-status">{state?.result?.winner} WINS</div>}
        {you>=0&&racer&&<><div className="item-slot"><span>ITEM · X</span><strong>{racer.item?'✦':'—'}</strong><small>{racer.item?ITEM_NAMES[racer.item]:'COLLECT A CRATE'}</small></div><div className="speed-hud"><strong>{Math.round(racer.speed*3.6)}</strong><span>KM/H</span></div></>}
        {game&&game.messageTime>0&&<div className="race-message" role="status">{game.message}</div>}
      </div>
      {you<0?<nav className="camera-selector" aria-label="Race cameras"><button aria-pressed={camera===-1} onClick={()=>{follow.current=-1;setCamera(-1);}}>Stadium</button>{game?.racers.map(r=><button key={r.id} aria-pressed={camera===r.id} onClick={()=>{follow.current=r.id;setCamera(r.id);}}>{r.name}</button>)}</nav>:<div className="game-toolbar">DRIVING · {racer?.name}<button onClick={()=>send({type:'leave'})}>Leave kart</button></div>}
      {you>=0&&<div className="drive-controls" aria-label="Driving controls">{(['left','right','brake','throttle','drift','item'] as (keyof Controls)[]).map(key=><button key={key} data-drive={key} className={`drive-key ${key}`} style={{touchAction:'none'}}>{key.toUpperCase()}</button>)}</div>}
    </section><aside className="race-sidebar"><PoolPanel pool={pool} names={game?.racers.map(r=>r.name)??[]} onClaim={()=>{setNotice('');send({type:'join'});}}/>{notice&&<p role="status">{notice}</p>}
      <ol>{game&&standings(game).map(r=><li key={r.id}>{r.name} · {r.finish!==null?'FINISHED':`LAP ${Math.min(3,r.laps+1)}`}</li>)}</ol>
    </aside></div>
    <details className="demo-tools"><summary>Race controls</summary><button disabled={!connected} onClick={()=>{setAdminError('');dialog.current?.showModal();}}>New lobby</button></details>
    <dialog ref={dialog} aria-labelledby="admin-title" onClose={()=>dialog.current?.querySelector('form')?.reset()}>
      <form onSubmit={e=>{e.preventDefault();setAdminError('Checking…');send({type:'admin-reset',password:new FormData(e.currentTarget).get('password')});}}>
        <h2 id="admin-title">Reset shared lobby</h2><label>Admin password <input name="password" type="password" required autoComplete="off"/></label>
        <p role="alert">{adminError}</p><button type="button" onClick={()=>dialog.current?.close()}>Cancel</button><button disabled={!connected}>Reset lobby</button>
      </form>
    </dialog>
  </main>;
}
