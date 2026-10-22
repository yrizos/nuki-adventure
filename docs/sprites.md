# Sprites

Color codes refer to the [palette](palette.md).

## Sprite Data

- Sprites are grids of palette codes in `assets/sprites/<name>/data.js`, each with a `preview.html`. Never image files.
- Terrain transitions share base grids and water frames instead of repeating whole tiles. Vite expands them into static sprite data before the game loads. Standalone previews expand the same source once.

## Light and Shading

- Light comes from the top left. Highlights sit on top and left edges, shading on bottom and right edges.
- Shading follows the form: a round stone has a curved terminator, a box has flat faces. Shading never rings a shape's edge regardless of light.
- Each object uses two or three steps from one ramp plus its outline.
- Ground shadows sit directly below an object, four pixels tall and four pixels narrower than its base, with ends two pixels shorter on each side of the bottom row. They use the shading step of the surface below.
- Every object meeting the ground has a contact row: one pixel row of the surface's shading step directly beneath its base.
- Trees darken the ground tile behind their overlap by one step along a 4 pixel band.
- Doorways and openings use the darkest step of their ramp, never Ink.

## Value and Contrast

- The hero has the widest value range on screen, from Ink to her lightest highlight. Orbs have the second widest.
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

- The hero, orbs and stones have a closed one pixel Ink outline. Lines between parts of one sprite, such as hair and face, use that part's darkest assigned step.
- Scenery never uses Ink. Its outline uses the darkest step of its own ramp on the bottom and right sides only. Ground tiles have no outlines.

## Line Work and Clusters

- Lines use the ratios 1:1, 1:2, 1:3 or 2:1, one ratio per line.
- Curves change step length gradually, such as 3, 2, 1, 1, 2, 3, never out of sequence.
- Every color area is at least two connected pixels. Single pixels appear only as eyes, catchlights and flower centers.
- Two steps never run alongside each other in parallel stripes.
- Anti-aliasing is placed by hand at curve corners with an intermediate step of the same ramp. Outer silhouettes and Ink outlines are never anti-aliased.

## Terrain

- Each terrain has at least three base variants of equal detail density, placed by a fixed pattern per map.
- Detail touches a tile edge only when it continues into the neighbor.
- Every pair of terrains that can meet has a transition set of at least 16 tiles covering edges, outer corners and inner corners. Path edges use E2. Shorelines use W0 on the water side and W4 for foam.

## Elements

### Sizes

| Element | Sprite size | Footprint |
| --- | --- | --- |
| Hero | 32 × 32 | 1 tile |
| Orbs | 24 × 24 swirl, 32 × 32 burst | 1 tile |
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

### Orbs

- A 16 × 16 ball centered in its tile with a four pixel empty margin, in the same pixels in every frame.
- Every orb uses one ramp only, plus Ink and Paper. All hues share one grid and differ only in their four ramp steps. Orbs are never multicolored.
- Inside the ball, a band of the orb's light step travels around just inside the outline, and two light arms turn around a fixed 2 × 2 Paper core. A fixed shine sits top left. No sparkles outside the ball.
- Each orb in view takes a different hue until the hues run out, and its own swirl and float phase.

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
- Eight authored frames rotate the leaf north around the hinge. Each shows for two game frames, so the swing takes sixteen game frames. A ninth frame parks the leaf at about 90 degrees along the west side of the passage.
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

## Creatures

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
