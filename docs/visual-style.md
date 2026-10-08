# Visual Style

This document builds on the color palette and the UI layout documents. Color codes refer to the palette.

## Resolution and Scaling

### Native Resolution

- The canvas covers the whole game view and never leaves empty space around it
- Every game view shows at least 7 × 7 tiles, and taller game views show more rows of the map
- Maps and puzzles rely only on what fits inside the minimum 7 × 7 tile area
- The camera centers the hero in pixels whenever it is not clamped at a map edge
- All art is drawn and reviewed at one device pixel per game pixel

### Scaling

- The factor is the largest whole number that still shows at least 7 tiles, which is 224 game pixels, across both the width and the height of the game view
- The canvas size in game pixels is the game view size in device pixels divided by the factor, rounded up
- The partial game pixel left at the right and bottom edges is cropped
- A game pixel that differs in size from another by even one device pixel is a defect

### Rendering

- The canvas backing store matches the canvas size in game pixels and is displayed at that size times the factor in device pixels
- Image smoothing is disabled and the canvas uses pixelated image rendering
- Sprites and the camera are drawn at whole pixel positions only
- Sprites are never scaled, rotated, skewed or filtered at draw time
- Mirroring is the only transform, used only for art drawn to be symmetric
- Tiles and world sprites are authored as grids of palette codes in `src/presentation/sprites/<name>/data.js` and reviewed in the `preview.html` beside each one, never as image files
- Terrain transitions share base grids and water animation frames instead of repeating whole tiles. Vite expands them into static sprite data before the game loads, while standalone previews expand the same source once

## Grid and Perspective

### Grid

- Tiles are 32 × 32 pixels
- Map positions, collisions and interactions use the tile grid
- Sprites can extend above their tile, with their base on the tile they occupy

### Three-Quarter View

- Objects show their top surface and their front face, with the camera looking down from the south at about 45 degrees
- Front faces are one ramp step darker than top surfaces
- Side faces are never drawn
- Characters show the head and the top of the shoulders

### Depth Order

- Layers are drawn in this order: ground, ground decoration, objects and characters, effects
- Objects and characters are sorted by the y position of their base, lowest drawn last
- Tall objects overlap the tile above them, and the hero passes behind that overlap

## Light and Shading

### Light Source

- Light comes from the top left for every asset
- Highlights sit on top and left edges, shading on bottom and right edges
- Ground shadows sit directly below an object, four pixels tall, four pixels narrower than its base

### Shading

- Shading follows the form: a round stone has a curved terminator, a box has flat faces
- Shading that rings the edge of a shape regardless of the light is not allowed
- Each object uses two or three steps from one ramp plus its outline
- Ground shadows use the shading step of the surface below, G1 on grass and E2 on paths

### Dithering

- Dithering is used only on surfaces larger than 64 × 64 pixels
- The only pattern is a 50 percent checkerboard between two adjacent steps of one ramp
- Dithered pixels never animate

## Value and Contrast

### Hierarchy

- The hero has the widest value range on screen, from Ink to her lightest highlight
- Stars and orbs have the second widest range
- Props span at most three steps of their ramp
- Ground tiles use one base step plus the steps directly above and below it, with those two steps covering at most 20 percent of the tile together
- The darkest and lightest steps of any ramp never appear in ground tiles except along transitions and shorelines, or where the palette assigns them, such as E4 path highlights

### Squint Test

- Blurred to a quarter of its size, a screen shows the hero, collectibles and paths as the clearest shapes
- Converted to grayscale, every screen keeps the same reading order as in color

## Materials

### Grass

- Tufts are clusters of 4 to 8 pixels in G3, pointing up, with a G1 pixel at the base
- Tufts cover 10 to 20 percent of a grass tile and never form rows or a regular grid

### Foliage

- Canopies are built from rounded leaf clusters of 8 to 16 pixels, never from a single smooth circle
- Each cluster has a G3 highlight on its top left and G0 on its bottom right
- The canopy edge is broken by leaf clusters, with at least three notches along the visible outline

### Wood

- Grain runs along the length of the board in E0 lines of 6 or more pixels
- Board ends show a single E0 pixel row, and planks are separated by one E0 pixel

### Stone

- Stone surfaces have at most two cracks per tile, each 6 to 12 pixels long, in N2
- Edges are chipped with two to four missing corner pixels
- Highlights are N4 clusters on the top left facets only

### Fences

- A fence is a row of E1 posts joined by two rails, each rail an E2, E1 and E0 band three pixels tall
- Each fence piece joins the fences and door beside it above, below, left and right, so runs and corners meet without seams
- Fence pieces have a ground shadow 8 pixels wide below the post

### Water

- Ripples are horizontal lines 4 to 10 pixels long in W2, never vertical
- Foam along shores is W4, broken into segments with gaps of 2 to 6 pixels
- Objects in water show a W0 band along the waterline

### Flowers

- Petals are 2 to 4 pixels each around a Y3 center
- Clusters mix at most two petal colors per tile

## Contact and Depth

- Every object meeting the ground has a contact row: one pixel of the surface's shading step directly beneath its base
- Ground shadows have flattened ends, two pixels shorter on each side of the bottom row
- Trees darken the ground tile behind their overlap by one step along a 4 pixel band
- Doorways and openings use the darkest step of their ramp, never Ink

## Outlines

### Interactive Elements

- The hero, stars, orbs, signposts, stones and floor triggers have a closed one pixel Ink outline
- Lines between parts of the same sprite, such as hair and face, use the darkest step the palette assigns to that part

### Scenery

- Scenery never uses Ink
- Scenery outlines use the darkest step of its own ramp on the bottom and right sides only
- Ground tiles have no outlines

## Line Work and Clusters

### Lines and Curves

- Lines use the ratios 1:1, 1:2, 1:3 or 2:1, one ratio per line
- Curves change step length gradually, such as 3, 2, 1, 1, 2, 3, and never out of sequence
- A line that breaks its step rhythm is redrawn

### Clusters

- Every color area is at least two connected pixels
- Single pixels appear only as eyes, catchlights, sparkles and flower centers
- Two steps never run alongside each other in parallel stripes

### Anti-Aliasing

- Anti-aliasing is placed by hand at the corners of curves, using an intermediate step of the same ramp
- Outer silhouettes and Ink outlines are never anti-aliased

## Sprites

### Sizes

| Element | Sprite size | Footprint |
| --- | --- | --- |
| Hero | 32 × 32 | 1 tile |
| Stars and orbs | 24 × 24 | 1 tile |
| Signposts | 32 × 32 | 1 tile |
| Stones and small props | 32 × 32 | 1 tile |
| Trees | 64 × 64 | 2 × 1 tiles at the base |
| Small buildings | 96 × 96 | 3 × 2 tiles at the base |
| Fences | 32 × 32 | 1 tile |
| Doors | 96 × 96 | 3 × 1 tiles at the base |

A new element uses the smallest size in this table that fits its shape.

### Hero

- The hero is a girl of about seven, two heads tall
- Her colors follow the hero row of the palette
- The face shows no mouth when facing away
- She has separate frames for down, up, left and right
- Left and right are drawn separately unless the design is fully symmetric
- Her silhouette, filled with a single color, is recognizable in all four directions
- Each eye is an E1 pupil, and the facing down frame adds a single Paper catchlight on the top left of each eye
- Her hair has at least three steps, E2, E3 and E4, with E4 as a highlight band across the top left of the head
- Her t-shirt shows one fold line in P1 on each side, and a W0 row separates the t-shirt from the jeans at the waist
- Hands are S2 clusters shaded in S1, two pixels wide while she stands or walks
- Shoes are E1, two pixels tall while she stands or walks

### Stars and Orbs

- Stars and orbs sit centered in their tile with a four pixel empty margin
- Each orb has its own symbol or shape

### Scenery Props

- Every prop has a ground shadow
- Repeated props have at least two variants, and identical variants never touch. Fruit trees are the exception, because each fruit has one tree shape and every tree in a tree cluster bears the same fruit

### Door

- The door stands in a fence, framed by an E1 wooden lintel and two E1 posts, with an E2 highlight along the top of the lintel and the left of each post, E0 shading on their right and bottom edges, and E0 grain
- The closed door is made of vertical E2 planks separated by E0 lines, with two rails across each leaf and two E0 handles at the center
- The open door shows an E0 doorway, with the leaves swung inward visible only as their E2 and E1 edges
- Paper light motes rise through the open doorway
- The door has one ground shadow across its width

## Terrain

### Tiles

- Each terrain has at least three base variants with equal detail density
- Variants are placed by a fixed pattern per map
- Detail touches a tile edge only when it continues into the neighboring tile

### Transitions

- Every pair of terrains that can meet has a transition set covering edges, outer corners and inner corners, 16 tiles at minimum
- Path edges use E2, and shorelines use W0 on the water side and W4 for foam
- A test map with every terrain beside every other terrain is reviewed whenever a terrain tile changes

## Faded World

At the start, only the hero, stars and orbs are in color. Every scenery tile and prop has a faded version that maps each palette step to a neutral.

### Mapping

| Neutral | Steps that map to it |
| --- | --- |
| N1 | G0, E0, W0, R0, V0, V0a, T0, P0 |
| N2 | G1, E1, W1, Y0, R1, V1, P1, S0 |
| N3 | G2, E2, W2, Y1, R2, V2, T1, P2, S1 |
| N4 | G3, E3, W3, Y2, R3, V3, T2, P3, S2 |
| Paper | G4, E4, W4, Y3, T3, S3 |

- Neutrals map to themselves
- Faded versions are generated from the mapping and then corrected by hand

### Faded Contrast

- An object differs from the ground below it in the faded state through its silhouette, its ground shadow or at least one neutral step
- Stones on grass rely on their N2 shadow and N4 highlight, since N3 stone matches faded grass
- Every map is reviewed fully faded

### Restoring Color

- Color returns through an ordered 4 × 4 dither dissolve, each pixel switching from faded to color at its threshold
- The dissolve spreads outward from the center of the orb's tile as a circle, one tile every 4 frames
- Each pixel that changes first shows its final color one step lighter on its own ramp for 8 frames, so a bright crest travels with the front and steps down to the final color. Ink and the lightest step of a ramp stay as they are
- Pixels that are the same before and after, such as the hero, stars and areas already in color, never change
- The area of the collected orb changes, together with the seam band around it, and the rest of the map keeps its current state
- Where a colored area meets a faded one, the seam is a band of the same ordered 4 × 4 dither about three tiles wide, centered on the area edge and eased at both ends so color feathers in instead of starting at a visible edge
- The seam itself never animates, and the dissolve passes through it, so the last frame of the dissolve is exactly the settled seam
- Every frame of the dissolve contains palette colors only
- The door stays closed until every orb is picked up. During the last restoration it is drawn open where color reaches it, and the hero can step into it once color covers the whole door

### Leaving a Level

- Stepping into the open doorway completes the level
- The colored world then darkens to Ink through the same ordered 4 × 4 dither, each pixel switching at its threshold
- Once the screen is fully Ink, the level end window opens, and ΣΥΝΕΧΕΙΑ starts the next level from its faded state, returning to the first level after the last one

## Motion and Animation

### Movement

- The hero moves two pixels per frame at 60 frames per second, 16 frames per cardinal tile
- Diagonal movement takes 23 frames per tile to preserve the same travel speed, with each axis rounded to whole pixels
- The camera follows the hero in whole pixels and stops at map edges
- Pushed objects move at the hero's speed and stay in contact with her

### Timing

| Animation | Frames | Timing |
| --- | --- | --- |
| Hero walk | 4 per direction | 8 game frames each, one cycle per two cardinal tiles, continuing across tiles and diagonal steps |
| Hero idle | 2 | Blink of 6 frames every 3 seconds, except facing up |
| Hero push | 2 per direction | 8 game frames each |
| Star and orb bob | 4 | 1 pixel up and down, 10 game frames each |
| Star sparkle | 4 | 6 game frames each, every 2 seconds |
| Water | 4 | 15 game frames each, all water tiles in sync |
| Flowers sway | 2 | 30 game frames each, offset per tile |
| Light motes | 1 | Rise 1 pixel every 4 game frames over 64 pixels and sway 1 pixel every 40 game frames, offset per mote |
| Restoring color | 16 dither thresholds | The front moves 1 tile every 4 game frames, and each pixel shows its lighter crest for 8 game frames |
| Leaving a level | 16 dither thresholds | 3 game frames each, 48 in total |

### Animation Rules

- Frames of one animation keep the same silhouette area, except the hero, whose hand-drawn frames shift her feet and pigtails
- The hero's head moves at most one pixel
- Looping tiles line up across tile edges in every frame

### Secondary Motion

- Stopping on a passing frame of the walk shows a settle frame for 8 game frames while her pigtails catch up
- Her arms swing opposite to her legs, one pixel forward and back
- Her shoulders dip one pixel on the passing frames of the walk
- Turning to a new direction shows the new facing for 2 game frames before she moves

### Subtle Motion

- Slow motion such as breathing or swaying uses color shifts along an edge instead of moving whole pixels
- Idle breathing lifts the shoulders by one pixel every 90 game frames
- Leaves on tree edges shift one cluster every 40 game frames, out of sync between trees

### Anticipation and Impact

- A push starts with one frame of the hero leaning in before the object moves
- An object arriving on a floor trigger shows one frame pressed one pixel down
- Orbs are collected by walking onto them, like stars, without a pause, raised-arm pose or held-orb animation. Color restoration starts immediately, movement continues normally and a congratulations message appears

### Effects

- Effects such as sparkles and dust are sprites with their own frames
- Effects end by stepping down their ramp and shrinking
- Transparency, screen shake, motion blur and glow filters are not used

## Production

### Authoring

- Pixel data uses palette codes only and holds no other colors
- Every tile is drawn inside a 3 × 3 arrangement of itself and its neighbors, never in isolation
- Every sprite is drawn on top of each ground it can appear on
- Animations are drawn with onion skinning and played back at game speed before review

### Review

- Every asset is viewed at 1 ×, at the target scale and mirrored horizontally
- Every asset is checked in color, in grayscale and in its faded version
- A screen is reviewed as a whole with all its tiles, props and characters in place
- An asset that fails any check is redrawn, not patched with effects

## Review Checklist

- Only palette colors, and only the steps allowed for the element
- Correct at native size
- Recognizable silhouette when filled with a single color
- Top-left light and the outline rules for its category
- No broken line rhythm, parallel stripes, edge-ringing shading or stray single pixels
- Base on its tile, with a ground shadow where required
- Distinct from its ground in the faded state
- Seamless against itself, its variants and its transitions
- Animations loop without a jump and keep their silhouette area
- Value range stays inside the limit for its category
- Material rules for its surface are met
- Contact row and ground shadow are present
- Secondary motion is present in every hero animation
