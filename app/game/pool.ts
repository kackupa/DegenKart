// Local prototype ledger. Never use browser state as custody or settlement authority.
export type Pool = {
  phase: "open" | "locked" | "paid" | "burned" | "cancelled";
  slots: (string | null)[];
  bets: { owner: string; kart: number; amount: number }[];
  balances: Record<string, number>;
  claims: Record<string, number>;
  burned: number;
  winner: number | null;
};
export function createPool(): Pool {
  return { phase: "open", slots: [null,null,null,null], bets: [], balances: { you: 1000 }, claims: {}, burned: 0, winner: null };
}
export function totalPot(p: Pool) { return p.bets.reduce((sum,b)=>sum+b.amount,0); }
export function fillBotSlots(p: Pool): Pool {
  if(p.phase!=="open")return p;
  let next=p;
  for(let i=0;i<4;i++)if(next.slots[i]===null)next=claimSlot(next,i,`demo-ai-${i}`);
  return next;
}
export function claimNextSlot(p: Pool, owner: string): Pool {
  const kart=p.slots.findIndex(slot=>slot===null);
  if(kart<0)throw new Error("The grid is full. Watch this race and join the next one.");
  return claimSlot(p,kart,owner);
}
export function claimSlot(p: Pool, kart: number, owner: string): Pool {
  if(p.phase!=="open" || !Number.isInteger(kart) || kart<0 || kart>3 || p.slots[kart] || p.slots.includes(owner)) throw new Error("That kart cannot be claimed.");
  const slots=[...p.slots]; slots[kart]=owner;
  return {...p,slots,phase:slots.every(Boolean)?"locked":"open"};
}
export function placeBet(p: Pool, owner: string, kart: number, amount: number): Pool {
  if(p.phase!=="open") throw new Error("Betting is closed.");
  if(!Number.isInteger(kart)||kart<0||kart>3||!Number.isSafeInteger(amount)||amount<=0) throw new Error("Enter a positive whole number of $KART.");
  if(amount>(p.balances[owner]??0)) throw new Error("Not enough $KART.");
  return {...p,bets:[...p.bets,{owner,kart,amount}],balances:{...p.balances,[owner]:p.balances[owner]-amount}};
}
export function settlePool(p: Pool, winner: number): Pool {
  if(p.phase!=="locked" || !Number.isInteger(winner)||winner<0||winner>3) throw new Error("This race cannot be settled.");
  const winning=p.bets.filter(b=>b.kart===winner), total=totalPot(p);
  const stake=winning.reduce((sum,b)=>sum+b.amount,0);
  if(!stake) return {...p,phase:"burned",winner,burned:total};
  const owners=new Map<string,number>();
  for(const b of winning) owners.set(b.owner,(owners.get(b.owner)??0)+b.amount);
  // Largest remainders allocate every demo unit; ties follow first bet order.
  const shares=[...owners].map(([owner,amount],order)=>{
    const numerator=BigInt(total)*BigInt(amount), denominator=BigInt(stake);
    return {owner,order,amount:Number(numerator/denominator),remainder:numerator%denominator};
  });
  let dust=total-shares.reduce((sum,s)=>sum+s.amount,0);
  shares.sort((a,b)=>a.remainder===b.remainder?a.order-b.order:a.remainder>b.remainder?-1:1);
  for(const share of shares) if(dust>0){share.amount++;dust--;}
  const claims={...p.claims};
  for(const share of shares)claims[share.owner]=(claims[share.owner]??0)+share.amount;
  return {...p,phase:"paid",winner,claims};
}
export function cancelPool(p: Pool): Pool {
  if(p.phase!=="open"&&p.phase!=="locked") throw new Error("This race has already settled.");
  const claims:Record<string,number>={...p.claims};
  for(const b of p.bets) claims[b.owner]=(claims[b.owner]??0)+b.amount;
  return {...p,phase:"cancelled",claims};
}
export function collectClaim(p: Pool, owner: string): Pool {
  const amount=p.claims[owner]??0;
  if(!amount) throw new Error("Nothing left to claim.");
  return {...p,balances:{...p.balances,[owner]:(p.balances[owner]??0)+amount},claims:{...p.claims,[owner]:0}};
}
// A new round releases every seat, never previously earned claims or balances.
export function nextRound(p: Pool): Pool {
  const previous=p.phase==="open"||p.phase==="locked"?cancelPool(p):p;
  return {...createPool(),balances:{...previous.balances},claims:{...previous.claims}};
}
