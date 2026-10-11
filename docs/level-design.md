# Level Design

This document defines how levels are designed. It builds on the [glossary](glossary.md) for domain terms and on the [visual style](visual-style.md) for what the game view shows.

Hard constraints are enforced by construction checks and authored-level regression tests. A level that breaks a hard constraint must not ship. Design guidance is judged by people and by playtesting.

## Hard Constraints

The `Level` constructor in `src/domain/level/level.ts`, `Scenery.of` in `src/domain/level/scenery.ts`, `levelFromLayout` in `src/infrastructure/level-layout.ts` and the authored-level tests enforce these rules.

### Hero and Door

- A layout has exactly one explicit hero start.
- A layout has exactly one door, three tiles wide, on open ground.
- The door stands on the top edge of the playable area, facing inward. Scenery may lie behind it, outside the area the hero can reach.
- The door stands beside a reachable tile, so the hero can walk through it once it opens.
- The door stands in a fence or is framed by woodland. Its opening stays free of canopies.
- The hero start is reachable and not hidden.
- The hero starts at least seven rows below the door, facing up.

### Keys

- A level has at least one key.
- Every key is reachable and has a tile of its own.
- No key is hidden by a tree canopy, a woodland canopy or the door.

### Stars

- A layout marks at least fifteen star spots, and five of them hold stars each time the level starts.
- Every star spot is reachable and not hidden.
- No star spot shares a tile with a key, the hero start or another star spot.
- A layout either marks star spots or gives a star count for random placement, never both.

### Trees

- Every tree in a tree cluster has the same tree variant.

### Woodland

- Woodland tiles lie on grass inside the level and never share a tile with a tree, flower or fence.
- Every woodland tile is impassable and blocked as a whole tile.
- In a level bounded by woodland, every tile the hero cannot reach is woodland, water, the door or covered by a prop. No unreachable grass or path tile exists.
- Woodland drawn beyond the map edges is decoration only. It never adds playable space.

### Magical Arrival

- A level MAY open with the [magical arrival](visual-style.md#magical-arrival). Level 1 does.
- The arrival needs no input and ends after 48 frames.
- All eight tiles around the start are open ground with no tree, woodland, stone, flower, key or star spot, and no tree or woodland canopy covers them, so the hero never materializes touching a boundary.

### Areas

- Every area holds at least one tile.
- The areas of a level's keys together cover every tile.

### Viewport

Puzzles and navigation decisions follow the minimum view rule in the [visual style](visual-style.md#native-resolution).

## Design Guidance

### Level Purpose

Define the purpose of a level before building it, such as introducing a mechanic, teaching navigation around water or practicing a return to a known landmark. A level can contain several mechanics, but only one of them is new.

### Introducing Mechanics

A mechanic appears in four stages across levels: introduce, practice, vary and combine. It first appears where the player can understand it without solving another new mechanic at the same time. The level teaches through play wherever possible.

### Landmarks

Every meaningful navigation decision has a recognizable landmark, such as a distinctive group of trees, a shoreline shape, a structure, an unusual path shape or the door. Landmarks belong where the player chooses a direction rather than spread as decoration, so important junctions never look interchangeable.

### Star Placement

Stars exist to encourage exploration of the whole map, so every star spot is chosen by hand and a level never uses a star count for random placement. Picking five of at least fifteen spots each time the level starts makes every run feel different while each star still lands somewhere worth reaching. Spread the spots across the map rather than gathering them in one place, so any five of them still cover it.

Star spots belong on optional dead ends, on side routes, in places worth seeing away from the mandatory route and in places the player can see before knowing how to reach. They never mark the mandatory route, and stars are never required to complete a level.

### Optional Paths and Dead Ends

An intentional dead end holds a payoff, usually a star spot but sometimes another discovery. Not every dead end needs a star, because placement should stay authored rather than predictable.

### Required Objects

Keys and other mandatory objectives never depend on accidental discovery. Beyond the checked rules, they never look like scenery and never rely on color alone to show their meaning. Key discovery relies on landmarks, the terrain layout and the key's proximity hum.

### Exploration

A level holds meaningful traversable space outside its mandatory route. Optional branches lead to distinct places or discoveries. Scenery forms recognizable places, never a uniform obstacle grid. A larger map adds navigable space, not only decoration or inaccessible tiles.

### Area Shapes

Each area is a place the player recognizes as a whole, such as a forest, a lake, a garden, a courtyard, ruins or an island. Area boundaries follow the shape of those places, never a convenience such as a straight column split. Collecting a key improves the player's understanding of the map as well as moving the level forward.

The seam between a restored and a faded area is a gradient about three tiles wide that stays on screen until the next key is collected. Place an area boundary where that gradient reads as the change from one place to another, such as a shoreline, a tree line or a track, and never rely on the color difference to show a route.

### Returning to the Door

The player knows where the door is before collecting the last key. The return can involve backtracking, as long as the space has changed through restored color, a newly understood route, a recognized landmark, a shortcut or a connection found earlier. Long mandatory returns through unchanged space are avoided.

### Difficulty

Each of these is a separate dimension of difficulty:

- map size
- mandatory travel distance
- number of objectives
- number of route choices
- number of mechanics combined
- amount of backtracking
- similarity between places
- obstacle density
- how much the player must remember
- strength of navigation cues

When a level is harder than the one before it, name the dimension that increased. A higher level number alone is no reason to raise several dimensions at once.

## Natural Layouts

Places follow the arrangement of their real-world counterparts, so the world feels grown rather than placed on a grid. These rules are guidance only. Natural arrangement never overrides a hard constraint or the readability of the mandatory route.

### Orchards

Trees stand in recognizable planting groups. Rows may be staggered, interrupted or unevenly spaced, with open grass between the groups. A gap in a row is a natural landmark. Paths follow believable movement through the orchard. An orchard never forms a symmetrical maze, and fruit trees never form a perimeter wall.

### Woodland Edges

Woodland edges are irregular, with projections into the clearing and recesses away from it. Straight continuous tree walls are avoided where they make the boundary look artificial. Inaccessible land outside a clearing is filled with woodland, never left as empty ground.

### Forests

Trees gather in irregular clusters of varying density, with clearings between them, and they thin out toward the forest edge. A clearing is a natural landmark. Straight bands of trees read as an orchard or a hedge, not a forest.

### Lakes and Shores

Water has uneven outlines with bays and points, never plain rectangles. A distinctive shoreline shape helps the player recognize where they are.

### Ponds

A pond is a self-contained body of water with an irregular shoreline, sized to its surroundings. It leaves most of the exploration space open and never closes a gap in another kind of boundary.

### Paths

Paths wind and branch like worn tracks rather than following straight grid lines. Straight paths belong only to built places, such as a courtyard or the approach to the door.

### Gardens and Flowers

Flowers grow in beds, in patches or along edges such as fences, woodland and paths. They are not spread evenly as single tiles across open ground.

### Rocks

Stones gather in small groups or lie along shores and paths. They are not spread evenly across open ground. Stones never form a level boundary or a continuous chain.
Use varied stone silhouettes within those groups, drawing from the five stone variants. Identical variants never touch.

### Tree Variants

Levels use all four tree variants across the game, but a level does not need every variant. A small level uses one or two, and larger levels add more, up to all four.
Favor different variants between distinct clusters or places so their silhouettes and fruit help distinguish landmarks. Every tree within a cluster still uses the same variant.

### Tree Size

A tree is two tiles wide, and its canopy hides the two tiles above it. Clusters and rows have to leave those tiles free of keys and star spots.

## Playtesting

No numerical limits apply yet. For each level, playtests should eventually capture:

- completion time
- time to each key
- stars collected
- route taken
- wrong turns
- repeated traversal
- periods without progress
- whether help was needed
- time until the first movement
- whether the magical arrival is visible and understood
- whether woodland reads as impassable
- whether the level boundary looks artificial
- whether optional paths lead to real exploration
- whether empty inaccessible space is visible

This data will show the actual difficulty of each level. Rules on level size, route complexity and objective density wait until enough of it exists.
