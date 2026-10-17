# Level Design

Terms follow the [glossary](glossary.md). A level that breaks a hard constraint must not ship.

## Hard Constraints

The `Level` constructor (`src/level/domain/level.ts`), `Scenery.of` (`src/level/domain/scenery.ts`), `levelFromLayout` (`src/level/content/level-layout.ts`) and the authored-level tests enforce most rules. Rules marked (unchecked) have no validator, so the designer checks them.

Every new hard constraint comes with a deterministic test that checks it in every authored level it applies to.

### Hero and Door

- Exactly one hero start and exactly one door. The door is three tiles wide, on open ground.
- The door stands on the top edge of the playable area, facing inward, never on another edge. Scenery may lie behind it, outside the reachable area.
- The door stands beside a reachable tile.
- The door stands in a fence or is framed by woodland. No canopy covers its opening. (unchecked)
- The hero start is reachable, not hidden, at least seven rows below the door and facing up.
- All eight tiles around the hero start are walkable, with no stone or flower, and no tree, woodland or door canopy covers them.
- The hero start lies one visibly free row above the bottom boundary. No open ground that a canopy leaves visible lies more than one row below it.
- The hero start lies within two tiles, counting diagonals, of a path end: a path tile with exactly one path tile beside it on an edge. The start itself counts as a path tile.

### Usable Items

- No tree canopy hides a usable item: a star spot, a key, a boulder spot, a pressure plate, a swing gate or the tile from which a gate is approached.

### Keys

- At least one key. Every key is reachable, has its own tile and is not hidden.

### Stars

- A layout marks exactly twenty star spots, and five hold stars each time the level starts. The code accepts fifteen or more, so twenty is checked only by level tests.
- A layout MAY mark up to four [permanent star spots](glossary.md#game-world) with `@`. They count toward the twenty. Each holds a star every time, and the level start picks the rest of the five from the other spots.
- Every star spot is reachable and not hidden. No star spot shares a tile with a key, the hero start or another star spot. Permanent star spots count as star spots.
- Every star spot is clearly visible. No woodland or tree stands on the tile directly above it or on either tile diagonally above it, and woodland or trees never stand both directly left and directly right of it. Bad example: a star spot in a one-tile bay of the woodland edge, with canopy above it and beside it, reads as hidden even though no canopy covers its tile.
- No star spot lies on the [mandatory route](glossary.md#game-world), and at least half of the star spots lie in [exploration areas](glossary.md#game-world). `src/level/testing/routes.ts` computes both.
- A layout marks star spots or gives a star count, never both. Authored levels always mark star spots.

### Trees

- Every tree in a tree cluster has the same tree variant.
- A tree is two tiles wide, and its canopy hides the two tiles above it.

### Woodland

- Woodland lies on grass inside the level and never shares a tile with a tree, flower or fence.
- Woodland is impassable and blocks its whole tile.
- In a woodland-bounded level, every tile the hero cannot reach is woodland, water, the door or covered by a prop. No unreachable grass or path tile exists.
- Woodland drawn beyond the map edges is decoration and never adds playable space. (unchecked)

### Canopies

A canopy is the part of woodland or a tree drawn over the tile above it. A hidden tile is one a canopy covers.

- The hero MAY walk on hidden tiles.
- Every key, every star spot and the tile in front of the door are reachable from the hero start without stepping on a hidden tile.
- The hero can walk a complete loop around every obstacle without stepping on a hidden tile. Obstacles are water, [fenced enclosures](glossary.md#game-world), trees and stones. Bad example: a lake whose only shore passage on one side is a strip under the woodland canopy.

### Fenced Enclosures

- Nuki can walk a complete loop around the outside of every [fenced enclosure](glossary.md#game-world). Every tile that touches the fence from outside, corners included, is open ground with no stone or woodland.

### Dividing Fences

A [dividing fence](glossary.md#game-world) deliberately breaks free movement. It blocks the way until the hero opens its gate, which teaches how gates work.

- A level MAY hold one dividing fence. It is not a fenced enclosure.
- The dividing fence holds one of the level's swing gates.
- The dividing fence is part of the level boundary. The loop rules under Canopies and Free Movement do not apply to it.
- The rules for diagonal gaps, swing gates and path tiles apply to it in full.

### Free Movement

- Nuki can walk a complete loop around every obstacle inside the level: water, fenced enclosures, trees and stones.
- No such obstacle touches the level boundary, corners included, either directly or through a chain of other obstacles that touch each other. The boundary is the woodland, the door, the map edge and any dividing fence.

### Diagonal Gaps

- No two blocking tiles meet only at a corner while the two tiles on the other diagonal are open ground. The drawing shows a passage there that she cannot walk through. Blocking tiles are woodland, water, trees, fences, stones and the door.

### Path Tiles

- Every path tile shares an edge with another path tile. The door, the hero start and a swing gate count as path tiles. Corner-only contact is rejected.

### Swing Gates

- A level MAY hold one or two [swing gates](glossary.md#swing-gate), each marked `G`. Each gate opens on its own, and every rule below applies to each one.
- Two gates never share a tile among their gate tiles, approach tiles and the tiles they swing into. No tile lies beside both gates, so pressing A always works one gate. Bad example: two gates in one fence row with a single fence between them.
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

- A level with exactly one swing gate MAY hold one [pressure plate](glossary.md#pressure-plate), marked `P`, on path ground.
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

- Audience: players are about seven years old. Early levels stay simple. A level that introduces a mechanic only needs to teach it clearly. Nothing new has to happen after the player solves it.
- Purpose: define what a level is for before building it. Only one mechanic per level is new.
- Mechanics: each one appears in four stages across levels: introduce, practice, vary, combine. It first appears where no other new mechanic must be solved at the same time.
- Star spots: choose by hand and concentrate them in exploration areas, which exist to reward curiosity. Place them on optional dead ends, side routes, scenic spots and places visible before they are reachable. Never on the mandatory route. Stars are never required.
- Dead ends: an intentional dead end holds a payoff, usually a star spot. Not every one needs a star.
- Required objects: keys never depend on accidental discovery, never look like scenery and never rely on color alone. Players find keys through terrain and the proximity hum.
- Mandatory route: it is the tour of the level, because young players follow paths and sounds and rarely leave them. It passes most of the level's sections. Exploration areas add stars and places on top of that tour, never in place of it. Bad example: a route that reaches the key through one corner while every other section lies off it.
- New mechanics: from the tile where the hero approaches the level's new mechanic, a goal it leads to, such as the door or a key, is visible within the minimum view of [Native Resolution](visual-style.md#native-resolution). A sound cue alone never gives the reason to use the mechanic.
- Exploration: a level holds meaningful space outside the mandatory route. Optional branches lead to distinct places. A larger map adds navigable space, not decoration.
- Paths and sections: prefer complex paths that link distinct sections over one track through open ground. Each section is a separate place with its own character, entered through a clear opening. Paths branch, turn and rejoin between sections. Bad example: a single path running straight from the start to the door with scenery on either side.
- Woodland outline: every woodland edge that faces open ground, along the map border and inside the level, steps in or out at least every three tiles. Steps vary in depth and spacing, never a regular zigzag. The woodland's thickness varies along the border, so the clearing never reads as a rectangle. A layout with a longer straight woodland edge is not finished. Bad example: open ground running for nine rows beside a one-tile woodland band along the map edge.
- Door position: vary the door's column along the top edge from level to level. Place it toward the left or right as often as near the middle. Bad example: every level with its door at the center of the top edge.
- Areas: each area is a recognizable place, such as a forest, lake, garden, courtyard, ruins or island. Boundaries follow those places, never a straight split. The restoration seam is a gradient about three tiles wide. Put it where it reads as a change of place, such as a shoreline, tree line or track. Never use color to show a route.
- Returning to the door: the player knows where the door is before the last key. Backtracking is fine when the space has changed through color, a new route or a shortcut. Avoid long returns through unchanged space.
- Difficulty dimensions: map size, mandatory travel, objective count, route choices, mechanics combined, backtracking, similarity between places, obstacle density, memory load, strength of navigation cues. When a level is harder than the previous one, name the dimension that increased. Do not raise several at once. Mandatory travel does not shrink from one level to the next unless the designer decides it should.

## Level Sequence

Each level introduces exactly one new element. Later levels may reuse it.

| Level | Introduces |
| --- | --- |
| 1 | Exploration |
| 2 | [Dividing fence](glossary.md#game-world) |
| 3 | [Fenced enclosure](glossary.md#game-world) |
| 4 | Moving a [boulder](glossary.md#boulder) |
| 5 | [Pressure plate](glossary.md#pressure-plate) |
| 6 | Two keys: gold and silver |
| 7 | Three keys: gold, silver and bronze |

## Natural Layouts

Guidance only. Never overrides a hard constraint or the readability of the mandatory route.

| Place | Do | Never |
| --- | --- | --- |
| Orchards | Planting groups, rows staggered, interrupted or unevenly spaced, open grass between groups. | A symmetrical maze. Fruit trees as a perimeter wall. |
| Woodland edges | Follow [Woodland outline](#design-guidance). Fill inaccessible land outside a clearing with woodland. | Empty inaccessible ground. |
| Forests | Irregular clusters of varying density with clearings, thinning toward the edge. | Straight bands of trees. |
| Lakes and shores | Uneven outlines with bays and points. A distinctive shoreline shape. | Plain rectangles. |
| Ponds | A self-contained body with an irregular shore, sized to its surroundings. Leaves most space open. | Closing a gap in another boundary. |
| Paths | Winding, branching worn tracks. Turns and slants step through a full corner tile. Straight paths only in built places, such as a courtyard or the door approach. | Diagonal staircases of single tiles. |
| Flowers | Beds, patches, or along fences, woodland and paths. | Single tiles spread evenly over open ground. |
| Stones | Small groups, or along shores and paths. Varied silhouettes from the five stone variants. | A boundary or continuous chain. Identical variants touching. |
| Tree variants | One or two in a small level, more in larger ones. Different variants for distinct clusters. | Mixed variants within one cluster. |

## Playtesting

No numerical limits exist yet. Playtests should capture completion time, time to each key, stars collected, route, wrong turns, repeated traversal, stalls, help needed, time to first movement, and whether the arrival, the woodland boundary, optional paths and inaccessible space read as intended.
