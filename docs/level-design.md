# Level Design

This document defines how levels are designed. It builds on the [glossary](glossary.md) for domain terms and on the [visual style](visual-style.md) for what the game view shows.

Hard constraints are enforced by code, and a level that breaks one fails to load. Design guidance is judged by people and by playtesting, so no check enforces it.

## Hard Constraints

The `Level` constructor in `src/domain/level/level.ts`, `Scenery.of` in `src/domain/level/scenery.ts` and `levelFromLayout` in `src/infrastructure/level-layout.ts` enforce these rules.

### Hero and Door

- A layout has exactly one explicit hero start.
- A layout has exactly one door, three tiles wide, on open ground.
- The door stands on the top edge of the playable area, facing inward. Scenery may lie behind it, outside the area the hero can reach.
- The door stands beside a reachable tile, so the hero can walk through it once it opens.

### Orbs

- A level has at least one orb.
- Every orb is reachable and has a tile of its own.
- No orb is hidden by a tree canopy or the door.

### Stars

- Every star is reachable and not hidden.
- No star shares a tile with an orb, the hero start or another star.
- A layout either places its stars by hand or gives a star count for random placement, never both.

### Trees

- Every tree in a tree cluster has the same tree variant.

### Areas

- Every area holds at least one tile.
- The areas of a level's orbs together cover every tile.

### Viewport

Puzzles and navigation decisions follow the minimum view rule in the [visual style](visual-style.md#native-resolution).

## Design Guidance

### Level Purpose

Define the purpose of a level before building it, such as introducing a mechanic, teaching navigation around water or practicing a return to a known landmark. A level can contain several mechanics, but only one of them is new.

### Introducing Mechanics

A mechanic appears in four stages across levels: introduce, practice, vary and combine. It first appears where the player can understand it without solving another new mechanic at the same time. Signposts can support this, but the level teaches through play wherever possible.

### Landmarks

Every meaningful navigation decision has a recognizable landmark, such as a distinctive group of trees, a shoreline shape, a structure, a signpost, an unusual path shape or the door. Landmarks belong where the player chooses a direction rather than spread as decoration, so important junctions never look interchangeable.

### Star Placement

Stars exist to encourage exploration of the whole map, so every star is placed by hand and a level never uses a star count for random placement. Spread them across the map rather than gathering them in one place.

They belong on optional dead ends, on side routes, in places worth seeing away from the mandatory route and in places the player can see before knowing how to reach. They never mark the mandatory route, and stars are never required to complete a level.

### Optional Paths and Dead Ends

An intentional dead end holds a payoff, usually a star but sometimes another discovery. Not every dead end needs a star, because placement should stay authored rather than predictable.

### Required Objects

Orbs and other mandatory objectives never depend on accidental discovery. Beyond the checked rules, they never look like scenery and never rely on color alone to show their meaning.

### Area Shapes

Each area is a place the player recognizes as a whole, such as a forest, a lake, a garden, a courtyard, ruins or an island. Area boundaries follow the shape of those places, never a convenience such as a straight column split. Collecting an orb improves the player's understanding of the map as well as moving the level forward.

### Returning to the Door

The player knows where the door is before collecting the last orb. The return can involve backtracking, as long as the space has changed through restored color, a newly understood route, a recognized landmark, a shortcut or a connection found earlier. Long mandatory returns through unchanged space are avoided.

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

Trees stand in regular rows and columns with even spacing and clear walkways between the rows. A gap in a row is a natural landmark.

### Forests

Trees gather in irregular clusters of varying density, with clearings between them, and they thin out toward the forest edge. A clearing is a natural landmark. Straight bands of trees read as an orchard or a hedge, not a forest.

### Lakes and Shores

Water has uneven outlines with bays and points, never plain rectangles. A distinctive shoreline shape helps the player recognize where they are.

### Paths

Paths wind and branch like worn tracks rather than following straight grid lines. Straight paths belong only to built places, such as a courtyard or the approach to the door.

### Gardens and Flowers

Flowers grow in beds, in patches or along edges such as fences and paths. They are not spread evenly as single tiles across open ground.

### Rocks

Stones gather in small groups or lie along shores and paths. They are not spread evenly across open ground.
Use varied stone silhouettes within those groups, drawing from the five stone variants. Identical variants never touch.

### Tree Variants

Levels use all four tree variants across the game, but a level does not need every variant. A small level uses one or two, and larger levels add more, up to all four.
Favor different variants between distinct clusters or places so their silhouettes and fruit help distinguish landmarks. Every tree within a cluster still uses the same variant.

### Tree Size

A tree is two tiles wide, and its canopy hides the two tiles above it. Clusters and rows have to leave those tiles free of orbs and stars.

## Playtesting

No numerical limits apply yet. For each level, playtests should eventually capture:

- completion time
- time to each orb
- stars collected
- route taken
- wrong turns
- repeated traversal
- signposts read
- periods without progress
- whether help was needed

This data will show the actual difficulty of each level. Rules on level size, route complexity and objective density wait until enough of it exists.
