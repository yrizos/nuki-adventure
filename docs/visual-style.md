# Visual Style

Color codes refer to the [palette](palette.md). Element colors live there, not here.

## Resolution and Scaling

### Native Resolution

- The canvas covers the whole game view with no empty space.
- Every game view shows at least 7 × 7 tiles. Taller views show more rows.
- Maps and puzzles rely only on what fits in the minimum 7 × 7 tile area.
- The camera centers the hero in pixels unless clamped at a map edge.

### Scaling

- The factor is the largest whole number that still shows at least 7 tiles (224 game pixels) across both width and height.
- Canvas size in game pixels is the view size in device pixels divided by the factor, rounded up. The partial pixel at the right and bottom is cropped.
- Every game pixel has the same device size. A one device pixel difference is a defect.

### Rendering

- The backing store matches the canvas size in game pixels and displays at that size times the factor.
- Image smoothing is off and the canvas uses pixelated rendering.
- Sprites and the camera are drawn at whole pixel positions only.
- Sprites are never scaled, rotated, skewed or filtered at draw time. Mirroring is the only transform, and only for art drawn to be symmetric.
- Sprites are grids of palette codes in `assets/sprites/<name>/data.js`, each with a `preview.html`. Never image files.
- Terrain transitions share base grids and water frames instead of repeating whole tiles. Vite expands them into static sprite data before the game loads. Standalone previews expand the same source once.

## Grid and Perspective

### Grid

- Tiles are 32 × 32 pixels. Positions, collisions and interactions use the tile grid.
- Sprites can extend above their tile, with their base on the tile they occupy.

### Three-Quarter View

- The camera looks down from the south at about 45 degrees. Objects show their top surface and front face. Side faces are never drawn.
- Front faces are one ramp step darker than top surfaces.
- Characters show the head and the top of the shoulders.

### Depth Order

- Layers: ground, ground decoration, objects and characters, effects.
- Objects and characters sort by the y position of their base, lowest drawn last.
- Tall objects overlap the tile above, and the hero passes behind that overlap.

## Light and Shading

- Light comes from the top left. Highlights sit on top and left edges, shading on bottom and right edges.
- Shading follows the form: a round stone has a curved terminator, a box has flat faces. Shading never rings a shape's edge regardless of light.
- Each object uses two or three steps from one ramp plus its outline.
- Ground shadows sit directly below an object, four pixels tall and four pixels narrower than its base, with ends two pixels shorter on each side of the bottom row. They use the shading step of the surface below.
- Every object meeting the ground has a contact row: one pixel row of the surface's shading step directly beneath its base.
- Trees darken the ground tile behind their overlap by one step along a 4 pixel band.
- Doorways and openings use the darkest step of their ramp, never Ink.

## Value and Contrast

- The hero has the widest value range on screen, from Ink to her lightest highlight. Stars and keys have the second widest.
- Props span at most three steps of their ramp.
- Ground tiles use one base step plus the steps directly above and below it, which together cover at most 20 percent of the tile.
- A ramp's darkest and lightest steps appear in ground tiles only along transitions and shorelines, or where the palette assigns them.
- In grayscale, every screen keeps the same reading order as in color.

## Materials

| Material | Rules |
| --- | --- |
| Grass | Tufts are 4 to 8 pixel clusters pointing up with a shading pixel at the base. They cover 10 to 20 percent of a tile and never form rows or a grid. |
| Foliage | Canopies are rounded leaf clusters of 8 to 16 pixels, never one smooth circle. Each cluster has a highlight top left and shadow bottom right. At least three notches break the visible outline. |
| Wood | Grain runs along the board in shading lines of 6 or more pixels. Board ends show one shading row. Planks are separated by one shading pixel. |
| Stone | At most two cracks per tile, 6 to 12 pixels long. Edges miss two to four corner pixels. Highlights are clusters on the top left facets only. Stones within two tiles of water carry G1 and G2 moss on selected top and side surfaces. |
| Fences | Posts joined by two rails, each rail a three-pixel band of highlight, wood and shading. Each piece joins neighboring fences and the door on all four sides without seams. Ground shadow 8 pixels wide below the post. |
| Water | Ripples are horizontal lines 4 to 10 pixels long, never vertical. Shore foam is broken into segments with gaps of 2 to 6 pixels. Objects in water show a W0 band along the waterline. |
| Water lilies | Pads float only on ground tiles whose four corners are all water, so they never touch the shore foam. Pads gather in one group of 3 to 5 neighboring pads per pond. A pond with at least 12 such tiles gets a second group of 2 to 3 pads. Each level start places them anew, with a drift of up to 4 pixels off the tile grid. |
| Flowers | Petals are 2 to 4 pixels each around a center. At most two petal colors per tile. |

## Outlines

- The hero, stars, keys and stones have a closed one pixel Ink outline. Lines between parts of one sprite, such as hair and face, use that part's darkest assigned step.
- Scenery never uses Ink. Its outline uses the darkest step of its own ramp on the bottom and right sides only. Ground tiles have no outlines.

## Line Work and Clusters

- Lines use the ratios 1:1, 1:2, 1:3 or 2:1, one ratio per line.
- Curves change step length gradually, such as 3, 2, 1, 1, 2, 3, never out of sequence.
- Every color area is at least two connected pixels. Single pixels appear only as eyes, catchlights and flower centers.
- Two steps never run alongside each other in parallel stripes.
- Anti-aliasing is placed by hand at curve corners with an intermediate step of the same ramp. Outer silhouettes and Ink outlines are never anti-aliased.

## Sprites

### Sizes

| Element | Sprite size | Footprint |
| --- | --- | --- |
| Hero | 32 × 32 | 1 tile |
| Stars and keys | 24 × 24 | 1 tile |
| Stones and small props | 32 × 32 | 1 tile |
| Trees | 64 × 64 | 2 × 1 tiles at the base |
| Fences | 32 × 32 | 1 tile |
| Doors | 96 × 96 | 3 × 1 tiles at the base |
| Butterflies | 9 × 7 | None |
| Birds | 11 × 9 sitting, 11 × 7 flying | None |
| Frogs | 15 × 11, ripples included | None |

A new element uses the smallest size that fits its shape.

### Hero

- A girl of about seven, two heads tall.
- Separate frames for down, up, left and right. Left and right are drawn separately unless the design is fully symmetric.
- Her single-color silhouette is recognizable in all four directions.
- No mouth when facing away. The facing down frame adds one catchlight at the top left of each eye.
- Hair has at least three steps, with a highlight band across the top left of the head.
- The t-shirt shows one fold line on each side. One row separates the t-shirt from the jeans at the waist.
- Hands and shoes are each two pixels while she stands or walks.

### Stars and Keys

- Centered in their tile with a four pixel empty margin.
- All keys share one sprite: a round bow, a shaft and teeth. Gold and silver differ only in color.

### Scenery Props

- Every prop has a ground shadow.
- Repeated props have at least two variants, and identical variants never touch. Fruit trees are the exception, because each fruit has one tree shape.
- Each plain tree shape has four versions that differ in a few leaf and bark pixels. One version is a slightly warmer green and one a slightly cooler green, so woodland mixes shades but still reads as one kind of tree. Touching trees differ by shape, and the version within a shape is picked by a fixed pattern per map.

### Door

- A wooden lintel and two posts frame it, with grain.
- Closed: vertical planks with two rails across each leaf and two handles at the center.
- Open: a dark doorway, with the inward leaves visible only as their edges. Light motes rise through it.
- One ground shadow across its width.

### Swing Gate

- One wooden leaf one ramp step darker than the fences, hinged on the post at its west side.
- Frames are 32 × 64 pixels with their bottom on the gate tile, so the swung leaf rises into the tile north of it. The hinge sits on the same pixel in every frame.
- Eight authored frames rotate the leaf north around the hinge, two game frames each, sixteen in total. A ninth frame parks the leaf at about 90 degrees along the west side of the passage.
- The swing uses authored frames only. The leaf never slides, shrinks, fades, or is rotated or scaled at runtime.
- Depth sorted at the base of its tile. Faded or colored like the fences beside it. Restoring color never changes its frame.
- The open leaf blocks only a thin strip along the west edge of the gate tile and the tile north of it.
- While the gate swings, the hero shows her pushing frames facing up.

### Woodland

- Woodland reuses the plain tree art, including every version of each shape, placed by a fixed pattern per map that never changes between frames.
- Canopies overlap so no ground shows inside the woodland.
- In a woodland-bounded level, woodland continues beyond the map edges, so the camera never shows where it ends.
- Woodland follows ordinary depth order, shading, ground shadows and restoration. Faded, it still reads as impassable and distinct from clearing grass.
- Low ferns and small shrubs grow on clearing grass beside woodland, sparsely, on about one edge tile in five by a fixed pattern per map, so the edge stays irregular. They are walk-through ground decoration and stay off the ring around the hero start.

### Butterflies

- Butterflies are effects. They are drawn above every prop and the hero and cast no ground shadow.
- They visit flower areas and orchards. A flower area is a group of flowers each within five tiles of another flower in it. An orchard is a cluster of fruit trees. Plain trees and woodland get none.
- Each flower area or orchard gets one butterfly per five stops, at most three. Flower stops sit at tile centers. Orchard stops sit near the top of the canopy above each footprint tile. A lone flower gets two extra hovering points beside it.
- A butterfly rests at a stop, then flies to the nearest stop it has not visited, and retraces its route once every stop is visited.
- Four colors: yellow, red, violet and pink. On a fruit tree a butterfly uses only colors that stand out from the fruit: yellow or violet on apples, violet or pink on oranges, red, violet or pink on lemons. A mixed orchard uses only colors allowed on every tree in it.
- Butterflies exist only in color. They appear in an area as it is restored and never in the faded world.

### Birds

- Birds are effects like butterflies. They are drawn above every prop and the hero and cast no ground shadow. They exist only in color, so they appear in restored areas and never in the faded world.
- A bird is drawn side-on in brown and orange, so it reads apart from the front-facing, brightly colored butterflies.
- Birds keep to the places butterflies skip. Perching birds sit on the canopy top of plain trees and woodland trees. Ground birds peck and hop on open grass, more than two tiles from the hero start. A sky bird crosses the whole map.
- Each map gets one perching bird per 8 candidate trees and one ground bird per 32 open grass tiles, at most three of each, and one sky bird. A map always has fewer birds than butterflies, so perching and ground birds together number at most two below its butterflies. Spots are spread evenly by a fixed pattern per map.
- A perching or ground bird flies in from the side, stays a while, flies off and stays away longer than it stayed. A sky crossing repeats far less often. Birds drift out of step, so the number in view changes over time.
- A ground bird pecks twice, hops a stride along, pecks twice, turns and hops back.
- A ground bird flies to the open grass spot within three tiles that is farthest from the hero once the hero comes within 48 pixels. With no such spot, it leaves for the rest of its visit. Perching and sky birds never flee.
- Birds face their direction of travel. A perched bird faces the way it arrived.

### Frogs

- Frogs exist only in color, so they appear in restored areas and never in the faded world. They are drawn at water level, above lily pads and below every prop and the hero, and cast no ground shadow.
- Each pond gets zero, one or two frogs at random when the level loads. A frog rests only on lily pads of its pond, and two frogs never share a pad.
- A frog sits and blinks, sometimes croaks once mid-rest, then moves on. It leaps to a pad within two tiles, or dives with a ripple, stays hidden and surfaces with a ripple on another pad of its own.
- A frog faces its direction of travel and keeps that facing while it rests.

## Terrain

- Each terrain has at least three base variants of equal detail density, placed by a fixed pattern per map.
- Detail touches a tile edge only when it continues into the neighbor.
- Every pair of terrains that can meet has a transition set of at least 16 tiles covering edges, outer corners and inner corners. Path edges use E2. Shorelines use W0 on the water side and W4 for foam.

## Faded World

- At the start, only the hero, stars and keys are in color. Every scenery tile and prop has a faded version that maps each step to a neutral through `faded` in [`palette.js`](../assets/sprites/palette.js), then corrected by hand.
- A faded object differs from its ground through its silhouette, ground shadow or at least one neutral step. Stones on grass rely on their shadow and highlight, because N3 stone matches faded grass.
- The magical arrival changes only the hero's visibility and never the faded state.

### Restoring Color

- Color returns through an ordered 4 × 4 dither dissolve. It spreads from the center of the key's tile as a circle, one tile every 4 frames.
- Each changing pixel first shows its final color one step lighter for 8 frames, so a bright crest travels with the front. Ink and a ramp's lightest step stay as they are.
- Pixels that are the same before and after never change.
- Only the collected key's area and its seam band change.
- The seam between colored and faded areas is a band of the same dither about three tiles wide, centered on the area edge and eased at both ends. It never animates. The dissolve passes through it and ends exactly on the settled seam.
- During the last restoration, the door is drawn open where color reaches it. The hero can enter once color covers the whole door.

### Leaving a Level

- Stepping into the open doorway completes the level. The world darkens to Ink through the same dither, 3 frames per threshold.
- Once fully Ink, the next level starts faded, or the menu screen opens after the last level.

## Motion and Animation

### Movement

- The hero moves two pixels per frame at 60 frames per second: 16 frames per cardinal tile, 23 per diagonal tile.
- The camera follows in whole pixels and stops at map edges.
- Pushed objects move at the hero's speed and stay in contact with her.

### Timing

| Animation | Frames | Timing |
| --- | --- | --- |
| Hero walk | 4 per direction | 8 game frames each, one cycle per two cardinal tiles, continuous across tiles and diagonals |
| Hero idle | 2 | Blink of 6 frames every 180, except facing up. Shoulders lift one pixel every 90 |
| Hero push | 2 per direction | 8 game frames each |
| Star bob | 4 | 1 pixel up and down, 10 game frames each |
| Key float | Sine, whole pixels | 2 pixels up and down over 150 frames, 1 pixel sideways over 60. The shadow stays still |
| Water | 4 | 15 game frames each, all tiles in sync |
| Pressure plate sinking | 3 | 4 game frames each. Sinks deeper into the ground while pressed and rises in reverse once released. A release partway down rises from the current frame |
| Flowers sway | 2 | 30 game frames each, offset per tile |
| Tree leaves | 1 cluster shift | Every 40 game frames, out of sync between trees |
| Butterfly wings | 2 | 6 game frames each while flying, 30 while resting |
| Butterfly flight | Eased arc, whole pixels | 0.75 pixels per frame, at least 12 frames per flight. The arc lifts 6 pixels, with a 2 pixel flutter of 3 beats. Rests last 36 to 83 frames |
| Bird perch | 6 | Sit with a tail flick every 36 game frames, 6 game frames each |
| Bird ground | 4 per peck, 2 per hop | 6 game frames each. Two pecks, then two hops of a 4 pixel stride |
| Bird flight | 2 wing frames, eased arc, whole pixels | 6 game frames each. 1.5 pixels per frame, at least 18 frames per flight. Visits arc 10 pixels from 160 pixels aside and 112 up, flee flights arc 6 |
| Bird visits | Cycle | 3000 to 3900 frames per cycle, staying 900 to 1199. A sky crossing repeats every 10800 frames, climbing one tile with a 3 pixel wave of 3 beats |
| Light motes | 1 | Rise 1 pixel every 4 frames over 64 pixels, sway 1 pixel every 40, offset per mote |
| Restoring color | 16 thresholds | Front moves 1 tile every 4 frames, crest lasts 8 |
| Leaving a level | 16 thresholds | 3 frames each, 48 total |

### Magical Arrival

The hero materializes at her start over 48 game frames and cannot move until it ends.

| Frames | Animation |
| --- | --- |
| 0 to 15 | Eight Paper light motes with two-position trails spiral inward from about 20 pixels around her body. Hero and shadow are invisible |
| 16 to 39 | The hero appears from her feet upward through the ordered 4 × 4 dither, with a line of Paper pixels on the rising edge. Her shadow appears at frame 16. The motes circle her |
| 40 to 47 | Fully visible. The motes rise, spread and disappear |
| 48 onward | Normal idle and movement |

- Uses existing hero frames in her start facing, the existing light mote and the dither. No art of its own.
- The reveal masks only the hero. Motes stay within about 20 pixels of her, move in whole pixels and keep ordinary depth order.
- No transparency fades, scaling, rotation or blur. Nothing marks the end and no pause follows.

### Intro

The [intro](ui-layout.md#intro) is a still comic page drawn with the game's own art at its one size. Falling apples copy the apple clusters of the apple tree. The sound word Μ Π Ο Υ Μ ! is the game font at three times its size, or twice where three times does not fit the panel, in Y3, Y2 and O2 from top to bottom with an Ink outline.

| Frames | What shows |
| --- | --- |
| Each panel's first 32 | The panel appears through the ordered 4 × 4 dither, one threshold every 2 frames. Earlier panels stay |
| 0, 120, 240, 360, 480 | Panels 1 to 5 start to appear |
| 272 to 293 | Once panel 3 is whole, the whole page trembles in whole pixels, at most 3, and settles |
| 600 to 647 | The whole page darkens to Ink like [leaving a level](#leaving-a-level), then the menu screen opens |

### Animation Rules

- Frames of one animation keep the same silhouette area. The hero is the exception, because her frames shift feet and pigtails.
- The hero's head moves at most one pixel.
- Looping tiles line up across tile edges in every frame.
- Stopping on a passing frame shows a settle frame for 8 game frames while her pigtails catch up.
- Arms swing opposite to the legs, one pixel forward and back. Shoulders dip one pixel on passing frames.
- Turning shows the new facing for 2 game frames before she moves.
- Keys are collected by walking onto them, with no pause, pose or held-key animation. Restoration starts at once, movement continues and a congratulations message appears.
- No transparency, screen shake, motion blur or glow filters. The [intro](#intro) tremble is the one exception.
