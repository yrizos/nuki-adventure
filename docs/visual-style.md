# Visual Style

This document builds on the color palette and the UI layout documents. Color codes refer to the palette.

## Resolution and Scaling

### Native Resolution

- The game view renders at 144 × 144 pixels, which is 9 × 9 tiles
- The hero occupies the center tile whenever the camera is not clamped at a map edge
- All art is drawn and reviewed at this resolution

### Scaling

- The game view keeps the full width set by the UI layout, and the canvas inside it scales by a whole number of device pixels
- The factor is the largest whole number that fits the available width in device pixels
- The canvas is centered in the game view, and leftover space around it is filled with Ink
- A game pixel that differs in size from another by even one device pixel is a defect

### Rendering

- The canvas backing store is 144 × 144, displayed at 144 × factor device pixels
- Image smoothing is disabled and the canvas uses pixelated image rendering
- Sprites and the camera are drawn at whole pixel positions only
- Sprites are never scaled, rotated, skewed or filtered at draw time
- Mirroring is the only transform, used only for art drawn to be symmetric
- Tiles and sprites are authored as pixel data in code, as grids of palette codes, never as image files

## Grid and Perspective

### Grid

- Tiles are 16 × 16 pixels
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
- Ground shadows sit directly below an object, two pixels tall, two pixels narrower than its base

### Shading

- Shading follows the form: a round stone has a curved terminator, a box has flat faces
- Shading that rings the edge of a shape regardless of the light is not allowed
- Each object uses two or three steps from one ramp plus its outline
- Ground shadows use the shading step of the surface below, G1 on grass and E2 on paths

### Dithering

- Dithering is used only on surfaces larger than 32 × 32 pixels
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

- Tufts are clusters of 2 to 4 pixels in G3, pointing up, with a G1 pixel at the base
- Tufts cover 10 to 20 percent of a grass tile and never form rows or a regular grid

### Foliage

- Canopies are built from rounded leaf clusters of 4 to 8 pixels, never from a single smooth circle
- Each cluster has a G3 highlight on its top left and G0 on its bottom right
- The canopy edge is broken by leaf clusters, with at least three notches along the visible outline

### Wood

- Grain runs along the length of the board in E0 lines of 3 or more pixels
- Board ends show a single E0 pixel row, and planks are separated by one E0 pixel

### Stone

- Stone surfaces have at most two cracks per tile, each 3 to 6 pixels long, in N2
- Edges are chipped with one or two missing corner pixels
- Highlights are N4 clusters on the top left facets only

### Water

- Ripples are horizontal lines 2 to 5 pixels long in W2, never vertical
- Foam along shores is W4, broken into segments with gaps of 1 to 3 pixels
- Objects in water show a W0 band along the waterline

### Flowers

- Petals are 1 or 2 pixels each around a Y3 center
- Clusters mix at most two petal colors per tile

## Contact and Depth

- Every object meeting the ground has a contact row: one pixel of the surface's shading step directly beneath its base
- Ground shadows have flattened ends, one pixel shorter on each side of the bottom row
- Tall objects darken the ground tile behind their overlap by one step along a 2 pixel band
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
- Single pixels appear only as eyes, catchlights, sparkles, petals and flower centers
- Two steps never run alongside each other in parallel stripes

### Anti-Aliasing

- Anti-aliasing is placed by hand at the corners of curves, using an intermediate step of the same ramp
- Outer silhouettes and Ink outlines are never anti-aliased

## Sprites

### Sizes

| Element | Sprite size | Footprint |
| --- | --- | --- |
| Hero | 16 × 16 | 1 tile |
| Stars and orbs | 12 × 12 | 1 tile |
| Signposts | 16 × 16 | 1 tile |
| Stones and small props | 16 × 16 | 1 tile |
| Trees | 32 × 32 | 2 × 1 tiles at the base |
| Small buildings | 48 × 48 | 3 × 2 tiles at the base |

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
- Hands are 2 × 2 pixel S2 clusters with an S1 bottom row
- Shoes are 2 pixels tall in E1

### Stars and Orbs

- Stars and orbs sit centered in their tile with a two pixel empty margin
- Each orb has its own symbol or shape
- Only stars and orbs use the brightest, most saturated steps

### Scenery Props

- Every prop has a ground shadow
- Repeated props have at least two variants, and identical variants never touch

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
| N1 | G0, E0, W0, R0, V0, T0, P0 |
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

- Color returns through an ordered 4 × 4 dither dissolve, each pixel switching from faded to full color at its threshold
- The dissolve spreads outward from the point of restoration, one tile ring per step
- Every frame of the dissolve contains palette colors only

## Motion and Animation

### Movement

- The hero moves one pixel per frame at 60 frames per second, 16 frames per tile
- The camera follows the hero in whole pixels and stops at map edges
- Pushed objects move at the hero's speed and stay in contact with her

### Timing

| Animation | Frames | Timing |
| --- | --- | --- |
| Hero walk | 4 per direction | 4 game frames each, one cycle per tile |
| Hero idle | 2 | Blink of 6 frames every 3 seconds |
| Hero push | 2 per direction | 8 game frames each |
| Star and orb bob | 4 | 1 pixel up and down, 10 game frames each |
| Star sparkle | 4 | 6 game frames each, every 2 seconds |
| Water | 4 | 15 game frames each, all water tiles in sync |
| Flowers sway | 2 | 30 game frames each, offset per tile |

### Animation Rules

- Frames of one animation keep the same silhouette area
- The hero's feet stay on the ground line, and her head moves at most one pixel
- Looping tiles line up across tile edges in every frame

### Secondary Motion

- Hair follows the body one frame late in the walk cycle and settles one frame after she stops
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
- Picking up a star or orb shows the hero holding it above her head for 30 game frames

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
