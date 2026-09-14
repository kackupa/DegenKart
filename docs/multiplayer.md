# Shared race

GitHub Pages serves the browser client. Render runs a single authoritative in-memory race at `wss://pepecoin-kart-race.onrender.com/race`. Clients send only controls; the server owns positions, pickups, collisions, specials, laps and the result.

- Four human slots, assigned first-come-first-served by Play.
- 30-second lobby; a full grid starts immediately. Empty seats use AI.
- Each completed race shows results for four seconds, then releases every seat.
- Disconnects turn the vacated kart into AI. Reconnection returns as a spectator.
- Inputs older than 500ms stop accelerating; 20 seconds without active controls releases the seat to AI.
- Races have a three-minute maximum to prevent stalled drivers blocking the next lobby.
- One WebSocket per browser tab; no account identity or persistent seat recovery yet.
- Clients interpolate the server's 20Hz snapshots. No client-side prediction yet; distant players will feel latency.
- Prototype limit: 250 simultaneous WebSocket connections per server. No multi-instance scaling or persistent results.
- Server restart resets the room. No real-money betting or custody is implemented.

## Admin

The shared lobby reset checks `ADMIN_PASSWORD` on the server, with five attempts per minute per client IP. Render generated a new random secret; retrieve/change it in the service's Environment page. The old public `kackupa` password does not authorize the shared race reset. Do not commit the new password or put it in the browser configuration.

## Deployment

Render: Free Node service, Frankfurt, root directory blank, `npm ci --prefix server`, `npm start --prefix server`, health check `/health`, `NODE_VERSION=22.18.0`.

The public-repository deployment works without an authenticated Git provider. Use Render's Manual Deploy after server updates unless automatic deploys are enabled and confirmed. Keep a single server instance. Free hosting may sleep and lose in-memory state.

GitHub Pages: GitHub Actions publishing source, not branch/Jekyll. `pages/main.tsx` uses `app/game/server-address.ts`. The original local Next/Vinext preview remains available independently.

## Verification

`node --test tests/multiplayer.test.mjs tests/specials.test.mjs tests/kart-animation.test.mjs` checks room lifecycle and simulation.

For a local network test, start the server with PORT=10001, ALLOWED_ORIGINS=http://localhost:3001 and ADMIN_PASSWORD=local-integration-test; then run `node --test tests/network.test.mjs`. That test uses five real WebSocket clients and must not target the public server.
