"use client";
import type {Pool} from "./pool";
import {RACERS} from "../data/racers";
export default function PoolPanel({pool,names,onClaim}: {pool:Pool;names:string[];onBet?:(kart:number,amount:number)=>void;onClaim:()=>void;onCollect?:()=>void;onCancel?:()=>void}) {
  const joined=pool.slots.includes("you"),open=pool.phase==="open";
  return <div className="participation-panel"><section className="pool-panel" aria-label="Pepecoin Kart race lobby">
    <div className="panel-heading"><h2>NEXT RACE</h2><span>FREE PLAY</span></div>
    <p className="pool-state is-open">Kekspace Circuit</p><p className="small-note">Press Play to take the next kart. Everyone else watches.</p>
    <div className="bet-racers">{names.map((name,kart)=><div key={kart} className={pool.slots[kart]?"is-selected":""}>{RACERS[kart]&&<img src={RACERS[kart].portrait} alt="" width="42" height="42"/>}<span>{name}</span><small>{pool.slots[kart]?pool.slots[kart]==="you"?"YOU":pool.slots[kart]==="player"?"PLAYER":"BOT":"OPEN"}</small></div>)}</div>
    <button className="bet-submit" disabled={!open||joined} onClick={onClaim}>{joined?"YOU’RE IN":open?"PLAY":"RACE IN PROGRESS"}</button>
    <p className="small-note">{joined?"The race starts when the grid is ready.":"No wallet, account or entry fee."}</p>
    <details className="pool-rules"><summary>Race rules</summary><p className="small-note">Four racers take the grid. Bots fill empty places when the timer ends. Pepecoin Kart is an independent community game.</p></details>
  </section></div>;
}
