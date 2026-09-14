"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createGame, startRace, stepGame, standings, resetKart, noControls, ITEM_NAMES, SPECIALS, activateItem, type Controls, type GameState } from "./simulation";
import { RaceRenderer } from "./renderer";
import { LAPS, TRACK_LENGTH, CHECKPOINTS } from "./circuit";
import PoolPanel from "./PoolPanel";
import {createPool,claimSlot,claimNextSlot,placeBet,settlePool,cancelPool,collectClaim,nextRound,fillBotSlots,type Pool} from "./pool";
import {shouldPauseOnBlur} from "./spectator";

function visitorPool(){let p=createPool();for(let i=0;i<4;i++)p=claimSlot(p,i,`demo-ai-${i}`);return p;}

type Action = "start" | "pause" | "restart" | "reset" | "confirmRestart";
const INTER_RACE_SECONDS=30;
function hud(g:GameState,followId=0) {
  const p=g.racers[followId],board=standings(g);
  return {phase:g.phase,paused:g.paused,countdown:Math.ceil(g.countdown),time:g.time,speed:Math.round(p.speed*3.6),lap:Math.min(LAPS,p.laps+1),position:board.findIndex(r=>r.id===followId)+1,item:p.item,
    drift:p.driftCharge,boost:p.boost,shield:p.shield,message:g.messageTime>0?g.message:"",checkpoint:(p.nextCheckpoint-1)%CHECKPOINTS,
    racers:board.map(r=>({id:r.id,name:r.name,color:r.color,lap:Math.min(3,r.laps+1),finish:r.finish})),lapTimes:[...p.lapTimes],stats:{...g.stats}};
}
export function formatTime(seconds:number){const minutes=Math.floor(seconds/60);return `${String(minutes).padStart(2,"0")}:${(seconds%60).toFixed(2).padStart(5,"0")}`;}
const keyMap:Record<string,keyof Controls>={ArrowUp:"throttle",KeyW:"throttle",ArrowDown:"brake",KeyS:"brake",ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",Space:"drift",ShiftLeft:"drift",ShiftRight:"drift",KeyX:"item"};

export default function RaceGame(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const resetDialog=useRef<HTMLDialogElement>(null);
  const [resetError,setResetError]=useState("");
  const input=useRef<Controls>(noControls());
  const keyboard=useRef(new Set<string>());
  const pointers=useRef(new Map<number,keyof Controls>());
  const [view,setView]=useState(()=>hud(createGame()));
  const [error,setError]=useState("");
  const ledger=useRef<Pool>(visitorPool());
  const [pool,setPool]=useState(visitorPool);
  const controlled=useRef(-1);
  const camera=useRef(-1);
  const [following,setFollowing]=useState(-1);
  const [notice,setNotice]=useState("");
  const lobbyDeadline=useRef<number|null>(null);
  const [lobbySeconds,setLobbySeconds]=useState(INTER_RACE_SECONDS);
  function updatePool(next:Pool){ledger.current=next;setPool(next);}
  function poolAction(action:()=>Pool){try{updatePool(action());setNotice("");}catch(e){setNotice(e instanceof Error?e.message:"Action failed.");}}
  function expireLobby(){
    if(ledger.current.phase==="open"&&lobbyDeadline.current!==null&&Date.now()>=lobbyDeadline.current){
      actionRef.current("start");setNotice("Joining and betting have closed. Bots filled the spare karts.");return true;
    }
    return false;
  }
  const actionRef=useRef<(action:Action)=>void>(()=>{});
  const specialPreview=useRef<(id:number)=>void>(()=>{});

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    let game=createGame();
    // Arrivals are already spectators. No start/watch action is required.
    game.phase="racing";
    let renderer:RaceRenderer;
    try {
      renderer=new RaceRenderer(canvas,game);
    } catch(e) {
      const message=e instanceof Error?e.message:"The game could not start.";
      const failedFrame=requestAnimationFrame(()=>setError(message));
      return()=>cancelAnimationFrame(failedFrame);
    }
    let frame=0,last=performance.now(),accumulator=0,hudClock=0;
    specialPreview.current=(id:number)=>{
      if(game.phase!=="racing"||game.paused)return;
      const racer=game.racers[id];if(racer.finish!==null||racer.stunUntil>game.time)return;
      const held=racer.item;racer.item=SPECIALS[id];activateItem(game,racer);racer.item=held;
    };
    const syncInput=()=>{
      input.current=noControls();
      for(const code of keyboard.current){const key=keyMap[code];if(key)input.current[key]=true;}
      for(const key of pointers.current.values())input.current[key]=true;
    };
    const clearInput=()=>{keyboard.current.clear();pointers.current.clear();input.current=noControls();};
    const openLobby=(message:string)=>{
      ledger.current=nextRound(ledger.current);setPool(ledger.current);
      game=createGame();controlled.current=-1;camera.current=-1;setFollowing(-1);
      renderer.yaw=game.racers[0].yaw;clearInput();accumulator=0;
      lobbyDeadline.current=Date.now()+INTER_RACE_SECONDS*1000;setLobbySeconds(INTER_RACE_SECONDS);setNotice(message);
    };
    actionRef.current=(action:Action)=>{
      if(action==="restart"){
        setResetError("");resetDialog.current?.showModal();return;
      }
      if(action==="confirmRestart"){
        openLobby("New grid — click Play to join. Any refunds remain claimable under Bet.");
      }
      if(action==="start"&&ledger.current.phase==="open"){
        const next=fillBotSlots(ledger.current);
        ledger.current=next;setPool(next);startRace(game);
      }
      if(action==="pause"&&controlled.current>=0&&game.phase!=="ready"&&game.phase!=="finished"){game.paused=!game.paused;clearInput();}
      if(action==="reset")resetKart(game,controlled.current);
      setView(hud(game));
    };
    const onKey=(event:KeyboardEvent)=>{
      if(event.target instanceof Element&&event.target.closest("dialog"))return;
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      if(controlled.current<0)return;
      if(keyMap[event.code]){event.preventDefault();keyboard.current.add(event.code);syncInput();}
      if(event.repeat)return;
      if(event.code==="Enter"){if(game.phase==="ready")actionRef.current("start");else if(game.phase==="finished")actionRef.current("restart");}
      if(event.code==="Escape"||event.code==="KeyP"){event.preventDefault();actionRef.current("pause");}
      if(event.code==="KeyR")actionRef.current("reset");
    };
    const onKeyUp=(event:KeyboardEvent)=>{keyboard.current.delete(event.code);syncInput();};
    const onBlur=()=>{clearInput();if(shouldPauseOnBlur(controlled.current)&&(game.phase==="racing"||game.phase==="countdown")){game.paused=true;setView(hud(game));}};
    const onVisibility=()=>{if(document.hidden)onBlur();};
    window.addEventListener("keydown",onKey);window.addEventListener("keyup",onKeyUp);window.addEventListener("blur",onBlur);document.addEventListener("visibilitychange",onVisibility);
    const animate=(now:number)=>{
      const elapsed=Math.max(0,(now-last)/1000),dt=Math.min(.1,elapsed);last=now;
      if(ledger.current.phase==="open"&&lobbyDeadline.current!==null){
        const remaining=Math.max(0,Math.ceil((lobbyDeadline.current-Date.now())/1000));
        setLobbySeconds(previous=>previous===remaining?previous:remaining);
        if(remaining===0){actionRef.current("start");setNotice("");}
      }
      // Browsers throttle hidden tabs. Catch spectators up on return instead of
      // pausing the race or showing a resume overlay (still a local demo).
      accumulator+=controlled.current<0?Math.min(240,elapsed):dt;
      if(ledger.current.phase==="cancelled")game.paused=true;
      while(accumulator>=1/60){stepGame(game,input.current,1/60,controlled.current);accumulator-=1/60;}
      const winner=standings(game).find(r=>r.finish!==null);
      if(game.phase==="ready"&&ledger.current.phase==="locked")startRace(game);
      if(winner&&ledger.current.phase==="locked"){
        ledger.current=settlePool(ledger.current,winner.id);setPool(ledger.current);
      }
      if(game.phase==="finished")openLobby(`${standings(game)[0].name} wins! New grid — click Play to race again.`);
      if(ledger.current.phase==="cancelled")openLobby("Race cancelled. Refunds are claimable under Bet. Click Play for the new grid.");
      const followId=controlled.current>=0?controlled.current:camera.current;
      renderer.render(game,dt,followId);
      hudClock+=dt;if(hudClock>.08){setView(hud(game,followId<0?standings(game)[0].id:followId));hudClock=0;}
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    const debugWindow=window as Window & {__degenKart?:()=>unknown};
    if(process.env.NODE_ENV!=="production")debugWindow.__degenKart=()=>({phase:game.phase,paused:game.paused,time:game.time,input:{...input.current},player:{...game.racers[0]},camera:{x:renderer.cameraX,z:renderer.cameraZ,yaw:renderer.yaw},stats:{...game.stats},racers:game.racers.map(r=>({...r}))});
    return()=>{cancelAnimationFrame(frame);renderer.releaseFrames();clearInput();window.removeEventListener("keydown",onKey);window.removeEventListener("keyup",onKeyUp);window.removeEventListener("blur",onBlur);document.removeEventListener("visibilitychange",onVisibility);delete debugWindow.__degenKart;};
  },[]);

  function pointerInput(id:number,key:keyof Controls,down:boolean){
    if(down)pointers.current.set(id,key);else pointers.current.delete(id);
    const next=noControls();for(const code of keyboard.current){const k=keyMap[code];if(k)next[k]=true;}for(const k of pointers.current.values())next[k]=true;input.current=next;
  }
  const active=view.phase==="racing"||view.phase==="countdown";
  const driverId=pool.slots.indexOf("you");
  const followedName=view.racers.find(r=>r.id===following)?.name;
  return <main className={`game-shell ${driverId<0?"spectator-shell":"driver-shell"}`}>
    <header className="masthead"><Link className="brand" href="/" aria-label="Pepecoin Kart home"><span className="flag-mark" aria-hidden="true"/><span>PEPECOIN<span className="brand-kart">KART</span></span></Link><div className="edition">KEKSPACE CIRCUIT <span>VOL. 01</span></div><span className="session-badge"><i/> COMMUNITY GRAND PRIX</span></header>
    <section className="race-heading"><div><p className="eyebrow">KEKSPACE <span>/</span> PEPECOIN COMMUNITY</p><h1>Kekspace Circuit</h1></div><div className="course-details"><span>{(TRACK_LENGTH/1000).toFixed(2)} KM CIRCUIT</span><span>3 LAPS</span><span>4 KARTS MAX</span></div></section>
    <div className="race-layout">
      <section className="play-column" aria-label="Race game">
        <div className="screen-frame">
          <canvas ref={canvasRef} aria-label={driverId<0?(following===-1?"Stadium view: the entire track and all four racers":"Chase camera: "+followedName):"Behind-the-kart racing. W to accelerate, S to brake, A and D to steer, Space to drift, X for items."} tabIndex={0}/>
          <div className="screen-grain" aria-hidden="true"/>
          <div className="race-hud" aria-label="Race status"><div className="position-display"><span>POSITION</span><strong>{view.position}<small> / 4</small></strong></div><div className="lap-display"><span>LAP <b>{String(view.lap).padStart(2,"0")}</b><small> / 03</small></span><time>{formatTime(view.time)}</time></div></div>
          {driverId>=0&&view.phase!=="ready"&&<div className="item-slot"><span>ITEM <kbd>X</kbd></span><strong>{view.item===null?"—":view.item==="turbo"?">>>":view.item==="pulse"?"✦":"◇"}</strong><small>{view.item?ITEM_NAMES[view.item]:"COLLECT A CRATE"}</small></div>}
          {driverId>=0&&view.phase==="racing"&&!view.paused&&<div className="speed-hud"><strong>{view.speed.toString().padStart(3,"0")}</strong><span>KM/H</span><div className="drift-meter"><i style={{width:`${Math.min(100,view.drift/2.4*100)}%`}}/></div><small>{view.boost>0?"BOOST ACTIVE":view.shield>0?"SHIELD ACTIVE":view.drift>=.85?"RELEASE FOR BOOST":view.drift>0?"CHARGING DRIFT":""}</small></div>}
          {driverId>=0&&view.message&&view.phase==="racing"&&!view.paused&&<div className="race-message" role="status">{view.message}</div>}
          {view.phase==="ready"&&pool.phase==="open"&&<div className="broadcast-status">NEXT RACE · {Math.floor(lobbySeconds/60)}:{String(lobbySeconds%60).padStart(2,"0")} · {pool.slots.filter(Boolean).length}/4 READY<small style={{display:"block",marginTop:6}}>Bots fill spare karts when the timer ends</small></div>}
          {view.phase==="countdown"&&!view.paused&&<div className="countdown-overlay"><strong>{view.countdown}</strong><span>{driverId>=0?"HOLD W / ↑ TO LAUNCH":"RACE STARTING"}</span></div>}
          {view.paused&&<div className="pause-overlay"><div><p className="eyebrow">ENGINE IDLING</p><h2>{pool.phase==="cancelled"?"CANCELLED":"PAUSED"}</h2>{pool.phase!=="cancelled"&&<button className="primary-button" onClick={()=>actionRef.current("pause")}>RESUME RACE <span>▶</span></button>}</div></div>}
          {view.phase==="finished"&&<div className="broadcast-status">{view.racers[0].name} WINS · RACE COMPLETE</div>}
          {error&&<div className="pause-overlay" role="alert"><p>{error}</p></div>}
        </div>
        {driverId<0?<nav className="camera-selector" aria-label="Race cameras">
          <button aria-pressed={following===-1} onClick={()=>{camera.current=-1;setFollowing(-1);}}>Stadium</button>
          {[...view.racers].sort((a,b)=>a.id-b.id).map(r=><button key={r.id} aria-pressed={following===r.id} onClick={()=>{camera.current=r.id;setFollowing(r.id);}}><i style={{background:r.color}}/>{r.name}</button>)}
        </nav>:<div className="game-toolbar"><span>DRIVING · {followedName}</span><button disabled={!active||pool.phase==="cancelled"} onClick={()=>actionRef.current("pause")}>{view.paused?"RESUME":"PAUSE"}</button></div>}
        <div className="drive-controls" aria-label="Driving controls" hidden={driverId<0}>
          {([ ["left","←","STEER"],["right","→","STEER"],["brake","S / ↓","BRAKE"],["throttle","W / ↑","ACCELERATE"],["drift","SPACE","DRIFT"],["item","X","USE ITEM"] ] as [keyof Controls,string,string][]).map(([key,shortcut,label])=><button key={key} className={`drive-key ${key}`} aria-label={label==="STEER"?`Steer ${key}`:label} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pointerInput(e.pointerId,key,true);}} onPointerUp={e=>pointerInput(e.pointerId,key,false)} onPointerCancel={e=>pointerInput(e.pointerId,key,false)} onLostPointerCapture={e=>pointerInput(e.pointerId,key,false)}><kbd>{shortcut}</kbd><span>{label}</span></button>)}
        </div>
      </section>
      <aside className="race-sidebar">
        <PoolPanel pool={pool} names={[...view.racers].sort((a,b)=>a.id-b.id).map(r=>r.name)}
          onBet={(kart,amount)=>{if(!expireLobby())poolAction(()=>placeBet(ledger.current,"you",kart,amount));}}
          onClaim={()=>{if(expireLobby())return;try{const next=claimNextSlot(ledger.current,"you"),kart=next.slots.indexOf("you");updatePool(next);controlled.current=kart;camera.current=kart;setFollowing(kart);setNotice("");}catch(e){setNotice(e instanceof Error?e.message:"Could not join the race.");}}}
          onCollect={()=>poolAction(()=>collectClaim(ledger.current,"you"))}
          onCancel={()=>poolAction(()=>cancelPool(ledger.current))}/>
        {notice&&<p className="pool-notice" role="status">{notice}</p>}
        <section className="grid-panel"><div className="panel-heading"><h2>THE GRID</h2><span>04 RACERS</span></div><ol className="grid-list">{view.racers.map((r,index)=><li key={r.id} className={r.id===driverId?"is-player":""} style={{"--racer-color":r.color} as CSSProperties}><span className="grid-position">{String(index+1).padStart(2,"0")}</span><i className="racer-swatch"/><strong>{r.name}</strong><span className="grid-lap">{r.finish!==null?"FIN":"L"+r.lap}</span></li>)}</ol><div className="grid-foot"><i/> {driverId<0?"SPECTATING":"RACING"}</div></section>
        <section className="race-notes"><p className="eyebrow">KNOW YOUR LINES</p><h2>Grip it.<br/>Slide it.<br/><em>Send it.</em></h2><p>Hold <b>Space</b> while turning. Build charge, then release for a burst of speed.</p><div className="legend"><span><i className="pickup-dot"/> ITEM CRATES</span><span><i className="boost-dot"/> BOOST PADS</span></div><p className="small-note">Barriers and karts slow you down. Lost your line? Press <b>R</b> to face the course.</p></section>
        <section className="lap-panel"><div className="panel-heading"><h2>LAP TIMES</h2><span>{view.checkpoint}/8 GATES</span></div>{[0,1,2].map(i=><div key={i}><span>LAP 0{i+1}</span><time>{view.lapTimes[i]!==undefined?formatTime(view.lapTimes[i]):"— — : — —"}</time></div>)}</section>
      </aside>
    </div>
    <details className="demo-tools"><summary>Race controls</summary><button onClick={()=>actionRef.current("restart")}>New lobby</button>{pool.phase==="open"&&<button onClick={()=>actionRef.current("start")}>Fill empty karts with AI & start</button>}{process.env.NODE_ENV!=="production"&&SPECIALS.map((special,id)=><button key={special} disabled={view.phase!=="racing"||view.paused} onClick={()=>specialPreview.current(id)}>Try {ITEM_NAMES[special]}</button>)}</details>
    <dialog ref={resetDialog} aria-labelledby="reset-title" onClose={()=>{resetDialog.current?.querySelector("form")?.reset();setResetError("");}} style={{background:"#17212c",color:"#fff",border:"1px solid #64738b",padding:"24px",maxWidth:"min(360px,90vw)"}}>
      <form onSubmit={event=>{
        event.preventDefault();
        // Local-only UI guard. Public static code cannot enforce admin authentication.
        if(new FormData(event.currentTarget).get("password")!=="kackupa"){setResetError("Incorrect password.");return;}
        resetDialog.current?.close();actionRef.current("confirmRestart");
      }}>
        <h2 id="reset-title">Reset lobby</h2>
        <label htmlFor="reset-password">Admin password</label>
        <input id="reset-password" name="password" type="password" required autoComplete="off" style={{display:"block",width:"100%",margin:"12px 0",padding:"10px",boxSizing:"border-box"}}/>
        {resetError&&<p role="alert">{resetError}</p>}
        <button type="button" onClick={()=>resetDialog.current?.close()}>Cancel</button>{" "}
        <button type="submit">Reset lobby</button>
      </form>
    </dialog>
    <footer className="page-footer"><span>PEPECOIN KART <b>© 2026</b></span><span>INDEPENDENT PEPECOIN COMMUNITY GAME</span><span className="footer-detail">UNOFFICIAL · FREE TO PLAY</span></footer>
  </main>;
}
