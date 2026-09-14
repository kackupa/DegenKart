# Pepecoin Kart

An independent Pepecoin community kart game: one shared Kekspace Circuit race, four karts, and spectators watching for free. It is unofficial and is not endorsed by Pepecoin developers.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The current fork reuses the Canvas race engine, checkpoints, collision, chase/stadium cameras, countdown, AI, mobile controls and spectator surface from Degen Kart.

## Build and deploy

```bash
npm run build
npm run start
```

Deploy the project root to Vercel. No wallet, database, betting, entry fee or blockchain integration is included in this MVP.

## Project map

- `app/game/simulation.ts` — physics, laps, items and AI.
- `app/game/circuit.ts` — Kekspace Circuit geometry and checkpoints.
- `app/game/renderer.ts` / `app/game/sprites.ts` — original pixel-style Canvas visuals.
- `app/data/racers.ts` — data-driven community racer profiles.
- `public/assets/racers/` — replaceable portrait, kart and racer placeholders.
- `TELEGRAM.md` — later Mini App configuration.

To add a racer, add one profile to `app/data/racers.ts` and matching assets under `public/assets/racers/<id>/`. To add a track, add a circuit module and select it from the race configuration. Power-up names are defined in `simulation.ts`; keep new handlers modular.

## MVP limitations

The fork is currently a local browser prototype. Shared server-authoritative multiplayer, persistent identity, Telegram identity validation, and final community artwork still need to be connected before a public event.
