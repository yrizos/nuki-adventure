# Rendering

Color codes refer to the [palette](palette.md).

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

### Drawing

- The backing store matches the canvas size in game pixels and displays at that size times the factor.
- Image smoothing is off and the canvas uses pixelated rendering.
- Sprites and the camera are drawn at whole pixel positions only.
- Sprites are never scaled, rotated, skewed or filtered at draw time. Mirroring is the only transform, and only for art drawn to be symmetric.

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

## Faded World

- At the start, only the hero and the orbs are in color. Every scenery tile and prop has a faded version that maps each step to a neutral through `faded` in [`palette.js`](../assets/sprites/palette.js), then corrected by hand.
- A faded object differs from its ground through its silhouette, ground shadow or at least one neutral step. Stones on grass rely on their shadow and highlight, because N3 stone matches faded grass.
- The [magical arrival](animation.md#magical-arrival) changes only the hero's visibility and never the faded state.

### Restoring Color

- Color returns through an ordered 4 × 4 dither dissolve. It spreads from the center of the orb's tile as a circle, one tile every 4 frames.
- Each changing pixel first shows its final color one step lighter for 8 frames, so a bright crest travels with the front. Ink and a ramp's lightest step stay as they are.
- Pixels that are the same before and after never change.
- Only the collected orb's area and its seam band change.
- The seam between colored and faded areas is a band of the same dither about three tiles wide, centered on the area edge and eased at both ends. It never animates. The dissolve passes through it and ends exactly on the settled seam.
- During the last restoration, the door is drawn open where color reaches it. The hero can enter once color covers the whole door.

### Leaving a Level

- Stepping into the open doorway completes the level. The world darkens to Ink through the same dither, 3 frames per threshold.
- Once fully Ink, the next level starts faded, or the menu screen opens after the last level.
