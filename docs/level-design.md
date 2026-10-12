# Level Design

Terms follow the [glossary](glossary.md). A level that breaks a hard constraint must not ship.

## Hard Constraints

The `Level` constructor (`src/domain/level/level.ts`), `Scenery.of` (`src/domain/level/scenery.ts`), `levelFromLayout` (`src/infrastructure/level-layout.ts`) and the authored-level tests enforce most rules. Rules marked (unchecked) have no validator, so the designer checks them.

### Hero and Door

- Exactly one hero start and exactly one door. The door is three tiles wide, on open ground.
- The door stands on the top edge of the playable area, facing inward, never on another edge. Scenery may lie behind it, outside the reachable area.
- The door stands beside a reachable tile.
- The door stands in a fence or is framed by woodland. No canopy covers its opening. (unchecked)
- The hero start is reachable, not hidden, at least seven rows below the door and facing up.
- All eight tiles around the hero start are walkable, with no stone or flower, and no tree, woodland or door canopy covers them.
- The hero start lies one visibly free row above the bottom boundary. No open ground that a canopy leaves visible lies more than one row below it.
- The hero start lies within two tiles, counting diagonals, of a path end: a path tile with exactly one path tile beside it on an edge. The start itself counts as a path tile.

### Keys

- At least one key. Every key is reachable, has its own tile and is not hidden.

### Stars

- A layout marks exactly twenty star spots, and five hold stars each time the level starts. The code accepts fifteen or more, so twenty is checked only by level tests.
- Every star spot is reachable and not hidden. No star spot shares a tile with a key, the hero start or another star spot.
- A layout marks star spots or gives a star count, never both. Authored levels always mark star spots.

### Trees

- Every tree in a tree cluster has the same tree variant.
- A tree is two tiles wide, and its canopy hides the two tiles above it.

### Woodland

- Woodland lies on grass inside the level and never shares a tile with a tree, flower or fence.
- Woodland is impassable and blocks its whole tile.
- In a woodland-bounded level, every tile the hero cannot reach is woodland, water, the door or covered by a prop. No unreachable grass or path tile exists.
- Woodland drawn beyond the map edges is decoration and never adds playable space. (unchecked)

### Path Tiles

- Every path tile shares an edge with another path tile. The door, the hero start and a swing gate count as path tiles. Corner-only contact is rejected.

### Swing Gates

- A level MAY hold one [swing gate](glossary.md#swing-gate), marked `G`.
- The gate stands on path ground in a fence row, between a fence directly west and a fence directly east, or in a fence column, between a fence directly north and a fence directly south.
- A gate in a row is approached from the south and swings north. A gate in a column is approached from the west and swings east.
- The gate tile, its approach tile and the tile it swings into are open ground with no stone.
- The approach tile is reachable with the gate closed. Walking into the gate never opens it.
- With the gate closed, no movement reaches the far side through fences, woodland or a diagonal.
- The gate blocks its whole tile until it finishes opening, and again from the moment it starts closing.

### Boulders

- A level MAY hold one [boulder](glossary.md#boulder). Each `O` marks a spot where it may start, and each play picks one spot at random.
- Every spot satisfies every boulder rule.
- The boulder stands on its own open ground, never on a stone, the door, the gate tile, its approach tile or the tile it swings into.
- No key or star spot shares a boulder's tile. (unchecked for keys)
- No move of a gripped boulder leaves it where the hero can no longer move it out of the way of a key or the door. (unchecked)

### Pressure Plates

- A level with a swing gate MAY hold one [pressure plate](glossary.md#pressure-plate), marked `P`, on path ground.
- The plate stands on open ground with no stone, never on the door.
- The plate stands at least two tiles, counting diagonals, from the gate tile and from the tile the gate swings into.

### Magical Arrival

- A level MAY open with the [magical arrival](visual-style.md#magical-arrival).
- All eight tiles around the start are open ground with no tree, woodland, stone, flower, key or star spot, and no canopy covers them. (unchecked)

### Areas

- Every area holds at least one tile. A level's key areas together cover every tile.

### Viewport

- Puzzles and navigation decisions follow the minimum view rule in [Native Resolution](visual-style.md#native-resolution).

## Design Guidance

- Purpose: define what a level is for before building it. Only one mechanic per level is new.
- Mechanics: each one appears in four stages across levels: introduce, practice, vary, combine. It first appears where no other new mechanic must be solved at the same time.
- Landmarks: every meaningful navigation decision has a recognizable landmark, such as a tree group, shoreline shape, structure, unusual path or the door. Place landmarks at junctions, not as decoration.
- Star spots: choose by hand and spread them so any five still cover the map. Place them on optional dead ends, side routes, scenic spots and places visible before they are reachable. Never on the mandatory route. Stars are never required.
- Dead ends: an intentional dead end holds a payoff, usually a star spot. Not every one needs a star.
- Required objects: keys never depend on accidental discovery, never look like scenery and never rely on color alone. Players find keys through landmarks, terrain and the proximity hum.
- Exploration: a level holds meaningful space outside the mandatory route. Optional branches lead to distinct places. A larger map adds navigable space, not decoration.
- Areas: each area is a recognizable place, such as a forest, lake, garden, courtyard, ruins or island. Boundaries follow those places, never a straight split. The restoration seam is a gradient about three tiles wide. Put it where it reads as a change of place, such as a shoreline, tree line or track. Never use color to show a route.
- Returning to the door: the player knows where the door is before the last key. Backtracking is fine when the space has changed through color, a new route, a landmark or a shortcut. Avoid long returns through unchanged space.
- Difficulty dimensions: map size, mandatory travel, objective count, route choices, mechanics combined, backtracking, similarity between places, obstacle density, memory load, strength of navigation cues. When a level is harder than the previous one, name the dimension that increased. Do not raise several at once.

## Natural Layouts

Guidance only. Never overrides a hard constraint or the readability of the mandatory route.

| Place | Do | Never |
| --- | --- | --- |
| Orchards | Planting groups, rows staggered, interrupted or unevenly spaced, open grass between groups. A gap in a row is a landmark. | A symmetrical maze. Fruit trees as a perimeter wall. |
| Woodland edges | Irregular, with projections and recesses. Fill inaccessible land outside a clearing with woodland. | Straight continuous tree walls. Empty inaccessible ground. |
| Forests | Irregular clusters of varying density with clearings, thinning toward the edge. | Straight bands of trees. |
| Lakes and shores | Uneven outlines with bays and points. A distinctive shoreline shape. | Plain rectangles. |
| Ponds | A self-contained body with an irregular shore, sized to its surroundings. Leaves most space open. | Closing a gap in another boundary. |
| Paths | Winding, branching worn tracks. Turns and slants step through a full corner tile. Straight paths only in built places, such as a courtyard or the door approach. | Diagonal staircases of single tiles. |
| Flowers | Beds, patches, or along fences, woodland and paths. | Single tiles spread evenly over open ground. |
| Stones | Small groups, or along shores and paths. Varied silhouettes from the five stone variants. | A boundary or continuous chain. Identical variants touching. |
| Tree variants | One or two in a small level, more in larger ones. Different variants for distinct clusters to mark landmarks. | Mixed variants within one cluster. |

## Playtesting

No numerical limits exist yet. Playtests should capture completion time, time to each key, stars collected, route, wrong turns, repeated traversal, stalls, help needed, time to first movement, and whether the arrival, the woodland boundary, optional paths and inaccessible space read as intended.
