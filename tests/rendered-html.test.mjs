import assert from "node:assert/strict";
import test from "node:test";

test("production page renders the race interface and local controls", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Degen Kart.*Mirage Motorway/);
  assert.match(html, /Race cameras/);
  assert.match(html, /aria-label="Race betting"/);
  assert.match(html, /Wait for next race/);
  assert.match(html, /aria-label="Close betting"/);
  assert.match(html, /Stadium/);
  assert.match(html, /Back a winner/);
  assert.match(html, />Play<\/button>/);
  assert.doesNotMatch(html, /WANT TO RACE|Join race|kart-places/);
  assert.doesNotMatch(html, /Claim kart/);
  assert.doesNotMatch(html, />Watch<|>PAUSE<|RESUME RACE|FILL WITH AI &amp; START RACE/);
  assert.match(html, /<canvas/);
  assert.match(html, /ACCELERATE/);
  assert.match(html, /LOCAL GRAND PRIX/);
  assert.match(html, /4 KARTS MAX/);
  assert.doesNotMatch(html, /DEMO ONLY|demo \$KART|Demo controls|New demo lobby/);
  assert.match(html, /Unclaimed payouts are never burned/);
  assert.doesNotMatch(html, /neon-circuit\.png|CONNECT WALLET|PLACE TEST BET|Building your site/);
});
