# Degen Kart: Mirage Motorway

The current race surface is a local Canvas 2D game with four karts. Claim any kart to drive against three AI, or spectate four AI and switch chase cameras. The former Socket.IO server in `server/` is retained as legacy scaffolding; it does **not** run the new simulation and is not connected to this client. No wallet, real token custody, shared multiplayer, or on-chain betting is active.

## Demo pool

Observer/stadium remains the default. The participation panel separates Back a
winner (radio selection, stake, quick amounts and a changing gross payout estimate)
from Want to race (one Join race action, no kart chooser). `claimNextSlot` assigns
the lowest-index empty place and rejects duplicate/full/closed joins. The fourth
claim locks betting and starts the countdown on the next animation tick. Closed
race panels show the pot distribution and disabled betting/join status. Use the
collapsed Demo controls to open an empty lobby for testing these interactions.

`pool.ts` implements immutable local demo balances, four exclusive kart slots and betting lock on the fourth claim. The start button explicitly fills remaining slots with demo AI and begins the countdown after locking. Stake whole demo KART while the lobby is open. The first checkpoint-validated finisher settles the pot: winning backers receive pro-rata claims, or the pot burns when no bets backed that winner. Largest remainders allocate integer rounding dust, with first-bet order as the tie break. Cancel before settlement to make original stakes refundable; claims cannot be collected twice. New Demo cancels unsettled races and requires collection before reset. Refreshing discards all demo state and restores 1,000 demo KART. No burn transaction is emitted.

This ledger is a product prototype, not a smart contract. Production requires authenticated server-authoritative claims and physics, durable race/escrow records, authenticated outcome finalization, $KART contract details, and audited on-chain payout/burn/refund paths. Browser state must never authorize real settlement. Driver/server disruption and result-dispute rules still need precise production criteria; spectator disconnects must not cancel the shared race. Recognizable cartoon portrait assets are not yet integrated.

## Play

Completed races automatically open a fresh 120-second join window. Four claims
start the next race immediately; at timeout bots fill any empty places (including
all four if nobody joins), lock betting and start the three-second countdown.
Play reserves a seat without immediately filling bots. An underfilled grid keeps
its bets and human seats; it is not cancelled or refunded. Every round requires
a new Play click. Unclaimed winnings/refunds survive later rounds. The
deadline uses wall-clock time, including time spent in background tabs. This is
still a per-browser prototype, not a shared server scheduler.

On all screen sizes, the visitor surface is race-first with a fixed Bet/Play
bar and horizontally scrollable 44px camera buttons. Bet opens a native modal
sheet (centered on desktop): focus stays inside, Escape/Close dismiss it, and the race continues.
The same pool state powers desktop and mobile; closed betting cannot accept stakes.
Play is disabled on a closed/full grid or after joining, with a next-race hint.
Desktop has no permanent pool or standings sidebar. Real-device Safari/Android performance
and virtual-keyboard behavior still need hardware testing.

Visitors now enter a running four-AI demonstration automatically in Stadium view.
The camera strip below the canvas switches between the full-circuit elevated view
and each kart's chase camera. Spectators have no pause hotkeys or pause-on-blur;
after browser background throttling the local simulation catches up (up to four
minutes, longer than one demo race). This is not server-backed race continuity.
Drivers retain a local safety pause when focus is lost. Driver HUD/instructions
are hidden for visitors. Demo lobby/reset controls and pool rules are collapsed;
open a new demo lobby there to try claiming a kart or pre-race bets. No automatic
next-race scheduler or shared multiplayer has been added.

Run the existing `pnpm dev` script and open its local URL. Press Enter or Start Race, then hold W / up to accelerate. A/D or left/right steer; S / down brakes. Hold Space or Shift while turning to drift; once charged, release to boost. X consumes an item. P / Escape pauses. R reorients a stuck kart onto the road without advancing its checkpoints. On-screen controls accept simultaneous touch pointers. Losing focus pauses and releases controls.

## Engine

- `app/game/circuit.ts`: a closed Catmull–Rom spline, arc-length sampling, nearest-road projection, eight ordered checkpoints, boost pads, item crates and obstacle positions.
- `app/game/simulation.ts`: fixed-step world-space kart motion, steering and slip angle, acceleration, braking, off-road drag, collision responses, AI look-ahead steering, drift charge, consumable afterburner/pulse/shield items, pickup respawns and a three-lap finish.
- `app/game/renderer.ts`: software perspective projection into an 800×450 Canvas. Road quads are clipped against the near plane and painted by depth. Karts and props scale with camera depth; the camera follows the player's actual position and heading. Original kart sprites and scenery are drawn procedurally; the old generated track image is unused.
- `app/game/RaceGame.tsx`: keyboard/touch input, animation loop, pause/restart and a lower-frequency React HUD. The physics step runs at 60 Hz independently of React rendering. Delta time is bounded after stalls.

The renderer is deliberately 2.5D: a flat drivable plane and sprite objects with perspective, rather than a 3D mesh world with jumps. The road really moves through the camera; it is not a transformed background image. Drift and handling are arcade physics, not a vehicle dynamics model.

## Verification

`pnpm test` exercises actual physics: throttle/brake/steering, drift release, collisions, all three items, pickup respawn, ordered lap checks, pause and a complete race driven through the AI controller. Node 22.18+ or 24 is required for the tests' native TypeScript imports. `pnpm build` verifies the existing Vinext build. `pnpm test:render` validates the built page after building.

In development only, `window.__degenKart()` exposes a read-only snapshot of controls, world coordinates, camera and race events for browser verification. It does not offer mutation or cheats.

## Multiplayer follow-up

The new physics must be run authoritatively on the Node server, accepting controls rather than arbitrary client position updates. Clients will need reconciliation, snapshot interpolation and shared race lifecycle. The legacy percentage-progress protocol cannot safely represent this world.
