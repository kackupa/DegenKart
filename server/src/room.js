import {createGame,noControls,startRace,stepGame,standings,resetKart} from '../../app/game/simulation.ts';
export class RaceRoom {
  constructor(){this.game=createGame();this.game.phase='racing';this.seats=[null,null,null,null];this.inputs=new Map();this.round=1;this.deadline=0;this.finishedAt=0;this.result=null;}
  lobby(now){this.game=createGame();this.seats.fill(null);this.inputs.clear();this.round++;this.deadline=now+30000;this.finishedAt=0;}
  join(id,now){
    if(this.game.phase!=='ready'||now>=this.deadline)throw new Error('Wait for the next race.');
    if(this.seats.includes(id))return this.seats.indexOf(id);
    const slot=this.seats.indexOf(null);if(slot<0)throw new Error('The grid is full.');
    this.seats[slot]=id;this.inputs.set(id,{controls:noControls(),at:now,active:now});
    if(this.seats.every(Boolean))this.start(now);return slot;
  }
  input(id,raw,now){
    if(!this.seats.includes(id)||!raw||typeof raw!=='object')return;
    const controls=noControls();for(const key of Object.keys(controls))controls[key]=raw[key]===true;
    const previous=this.inputs.get(id);this.inputs.set(id,{controls,at:now,active:Object.values(controls).some(Boolean)?now:previous?.active??now});
  }
  leave(id){const slot=this.seats.indexOf(id);if(slot>=0)this.seats[slot]=null;this.inputs.delete(id);}
  resetKart(id){const slot=this.seats.indexOf(id);if(slot>=0)resetKart(this.game,slot);}
  start(now){for(const entry of this.inputs.values())entry.active=now;startRace(this.game);}
  tick(now){
    if(this.game.phase==='ready'){if(now>=this.deadline)this.start(now);return;}
    if(this.game.phase==='finished'){if(now-this.finishedAt>=4000)this.lobby(now);return;}
    const controls=new Map();this.seats.forEach((id,slot)=>{
      if(!id)return;const entry=this.inputs.get(id);
      if(entry&&now-entry.active>20000){this.leave(id);return;}
      controls.set(slot,entry&&now-entry.at<500?entry.controls:noControls());
    });
    stepGame(this.game,noControls(),1/60,-1,controls);
    if(this.game.time>180)this.game.phase='finished';
    if(this.game.phase==='finished'){this.finishedAt=now;this.result={round:this.round,winner:standings(this.game)[0].name};}
  }
  snapshot(id,now){return {type:'state',round:this.round,game:this.game,you:this.seats.indexOf(id),slots:this.seats.map(owner=>owner===id?'you':owner?'player':this.game.phase==='ready'?null:'bot'),lobbySeconds:Math.max(0,Math.ceil((this.deadline-now)/1000)),result:this.result};}
}
