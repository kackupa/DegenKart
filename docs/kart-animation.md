# Kart animation

Asset: `public/assets/racers/kart-directions-v1.png`, generated using the built-in image generation tool from the four existing racer kart portraits.

Rows: Pr0m3theus, KekityKek, Smille, DaMoos3. Runtime columns: rear, right, left, front. The generated direction ordering is used as drawn. A flat magenta background is colour-keyed once during loading; cropped 160px canvases are reused each frame.

The renderer selects direction from kart/camera heading and steering. Speed drives suspension and tread animation. Simulation drift, boost, impact, shield and finish states drive particles and reactions; deceleration triggers brake lamps. These effects do not change physics. Both chase and stadium views use this animation path.

## Generation prompt

Create one production sprite ATLAS derived from the four attached existing kart character assets. Preserve each identity, outfit, accessories and kart colours. Exactly 4 columns x 4 rows, square overall image, regular equal square cells, transparent background, no labels or borders. Row1 green guitar frog black/lime kart Pr0m3theus. Row2 cream frog red cap red/gold kart KekityKek. Row3 rainbow LED helmet frog purple/cyan kart Smille. Row4 Moses frog burgundy cloak staff burgundy/gold kart DaMoos3. Every cell contains the complete kart and seated driver at equal scale with 15% clear margins, consistent ground baseline. Columns are DIRECTIONS, not different characters: column1 DIRECT REAR VIEW pointing away from camera, only back of head/helmet and rear exhausts visible, absolutely no looking over shoulder; column2 REAR LEFT THREE QUARTER pointing to upper left; column3 REAR RIGHT THREE QUARTER pointing upper right; column4 DIRECT FRONT VIEW pointing toward camera, face and front bumper visible. Slightly elevated classic 16bit racing camera, not overhead. Clear changes in vehicle heading between cells essential. Crisp pixel art matching supplied assets but simplified to readable roughly96pixel game sprites, chunky tyres, strong outlines. NO flames, particles, lightning, smoke or baked shadows: effects added at runtime. Guitar/staff attached. Transparent alpha background, never black background. No new characters, no text or logos. This is a turn-around sprite sheet for a real animated game.

Background correction: preserve all sixteen sprites and replace the baked checkerboard with a uniform magenta chroma-key background. The runtime removes that background.

## Verification

`tests/kart-animation.test.mjs` covers direction selection, stopped/finished motion, braking, drift lean and rendering without simulation mutation. TypeScript and targeted ESLint checks pass. Live preview checked with the four-racer simulation.
