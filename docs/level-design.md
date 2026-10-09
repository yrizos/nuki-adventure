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
- The hero never starts near the exit door. With the current top-edge exits, the hero starts on the bottom playable edge, facing into the level.
- After the first level, the start represents entry from the previous level's exit. Align its column with the previous door's center, scaled to the new map's width, within one tile. Do not move the start beside the new exit for convenience.

### Signposts

- Every orb has a hint sign on its approach. Every traversable route from the hero start to that orb must enter the hint sign's reading range before the orb can be collected. A shorter recommended route is not enough if another route bypasses the sign.
- Every exit door has its own reachable, readable sign beside it. Its text gives a general hint about completing the level and opening the door, separate from the orb's location hint.
- Place the exit sign as close to the fence as possible, on reachable ground immediately inside it and beside either end of the door. For the current layouts, it stands one row below the fence and one column outside the door's width, either left or right. Both sides are valid. Keep the doorway clear and the fence intact; never move the door to match another level's sign coordinates.
- Sign text matches the level's actual number of orbs. A one-orb level uses singular nouns, verbs and pronouns, and never implies that the player must find additional orbs. A level with several orbs says how many there are, in the exit sign's general hint.
- An orb's hint sign names that orb's color and a landmark. The exit sign never names an orb color or location.
- Signposts refer to recognizable, visible landmarks such as apple trees, a lake, flowers or a group of rocks. They never use compass directions, compass abbreviations or bearings. This includes north, south, east, west and their combinations or equivalents in any language. The player has no compass.
- Test entry placement, sign-before-orb ordering, exit sign placement beside the door and against the fence, objective-count wording and forbidden compass wording for every authored level. Use movement and actual reading range for route checks, not only marker distances or sign counts.

### Orbs

- A level has at least one orb.
- Every orb is reachable and has a tile of its own.
- No orb is hidden by a tree canopy or the door.

### Stars

- A layout marks exactly fifteen star spots, and five of them hold stars each time the level starts.
- Every star spot is reachable and not hidden.
- No star spot shares a tile with an orb, the hero start or another star spot.
- A layout either marks star spots or gives a star count for random placement, never both.

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

Stars exist to encourage exploration of the whole map, so every star spot is chosen by hand and a level never uses a star count for random placement. Picking five of fifteen spots each time the level starts makes every run feel different while each star still lands somewhere worth reaching. Spread the spots across the map rather than gathering them in one place, so any five of them still cover it.

Star spots belong on optional dead ends, on side routes, in places worth seeing away from the mandatory route and in places the player can see before knowing how to reach. They never mark the mandatory route, and stars are never required to complete a level.

### Optional Paths and Dead Ends

An intentional dead end holds a payoff, usually a star spot but sometimes another discovery. Not every dead end needs a star, because placement should stay authored rather than predictable.

### Required Objects

Orbs and other mandatory objectives never depend on accidental discovery. Beyond the checked rules, they never look like scenery and never rely on color alone to show their meaning.

### Area Shapes

Each area is a place the player recognizes as a whole, such as a forest, a lake, a garden, a courtyard, ruins or an island. Area boundaries follow the shape of those places, never a convenience such as a straight column split. Collecting an orb improves the player's understanding of the map as well as moving the level forward.

The seam between a restored and a faded area is a gradient about three tiles wide that stays on screen until the next orb is collected. Place an area boundary where that gradient reads as the change from one place to another, such as a shoreline, a tree line or a track, and never rely on the color difference to show a route.

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

A tree is two tiles wide, and its canopy hides the two tiles above it. Clusters and rows have to leave those tiles free of orbs and star spots.

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
