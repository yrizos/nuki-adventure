# Glossary

Definitions only. Rules that use these terms live in [Level Design](level-design.md).

## Screen

[UI Layout](ui-layout.md) defines the canonical screen terms: game view, control panel, joystick (ring and knob), action button A and B, action button cross, sound switch, full screen switch, menu switch, start screen, confirmation, end screen and level picker.

## Game World

| Term | Definition |
| --- | --- |
| Tile | One 32 × 32 pixel grid square used for map positions and interactions. |
| World Position | A point in game pixels from the top left corner of the level. |
| Feet | The small oval where the hero meets the ground. It collides with obstacles. The tile under its middle decides what the hero picks up, reads or walks into. |
| Obstacle | The outline of the part of an object or ground the hero cannot walk through. It follows where the object meets the ground and never reaches beyond the tile it blocks. |
| Level | One enclosed part of the game world, bounded by woodland or fences. |
| Playable Area | The connected traversable tiles reachable from the hero's start, excluding the closed door. |
| Magical Arrival | The 48-frame presentation in which the hero materializes at her start before movement begins. |
| Door | The level exit. It opens once every key is collected and color has returned to the whole door. Stepping into it completes the level. |
| Hidden | Describes a tile that a tree canopy, a woodland canopy or the door is drawn over. |
| Star Spot | A tile in a level's layout that can hold a star. Each level start picks the stars from these spots. |
| Permanent Star Spot | A star spot that holds a star every time the level starts. Each one takes a star from the five the level start picks. |
| Star Count | The number of stars a level holds. Stars go to the star spots, or to random reachable tiles that are not hidden. |
| Key | A collectible that floats, buzzes and hums when the hero is near. Each restores color to its own area. Gold by default. A level may make its keys silver, which changes only the color. |
| Stone | A static gray obstacle that is never part of a level boundary. |
| Fenced Enclosure | A closed ring of fence standing free inside the level. It may hold a swing gate. |
| Dividing Fence | A fence line that joins the level boundary at both ends and splits the level in two. Its swing gate is the only passage between the two parts. |
| Scenery | Everything the player does not interact with: grass, trees, woodland, water, paths, flowers and stones. |
| Prop | A scenery object standing on the ground, such as a tree, as opposed to a ground tile. |
| Tree Variant | A tree's fruit: none, oranges, apples or lemons. |
| Flower Variant | A flower cluster's petal colors and arrangement. Each level chooses its variants. |
| Tree Cluster | Trees whose footprints touch, including at a corner. |
| Mandatory Route | The tiles of every shortest walk from the hero start through every key to the door. |
| Exploration Area | Reachable tiles at least three steps away from the mandatory route. |
| Ground Shadow | The shadow directly below an object, drawn in the shading step of the surface beneath it. |

### Swing Gate

A single wooden leaf hinged in a fence. In a fence row, pressing A on any of the three tiles directly south or north of it opens it, in any facing. In a fence column, the same holds for the three tiles directly west or east of it. Pressing A again from those tiles closes it. It never completes the level. Once open, the hero can pass it.

### Boulder

A large gray rock covering one tile. Holding A while she stands on the adjacent tile facing it, or presses against it from that side, grips it. Gripping alone moves nothing. While she grips it, walking in any direction moves the boulder and her together one tile that way, and she keeps facing it. A move happens only when both the boulder and she have room. Releasing A lets go. It never enters woodland, water, a fence, a tree, a stone, the gate or the door. It rolls over stars and keys, which the hero collects as she steps onto their tiles.

### Pressure Plate

A flat stone set into the ground that holds the swing gate shut. The hero standing on it or a boulder on it presses it. The gate opens by itself while the plate is pressed and closes by itself once nothing presses it. A sound plays when the plate is pressed and a different one when it is released. While the plate holds the gate shut, pressing A beside the gate shows a message that the door does not open.

### Reachable

Describes a tile the hero can walk to from her start without stepping into the door. Tiles beyond a closed swing gate and tiles behind a boulder count as reachable, because she can always open the gate or move the boulder.

## Fading and Restoration

| Term | Definition |
| --- | --- |
| Faded World | The starting state, in which only the hero, stars and keys are in color. |
| Faded Version | The variant of a scenery tile or prop in which each palette step maps to a neutral. |
| Restoration | The return of color, spreading outward from a point. |
| Area | The part of a level that one key returns to color. |

## Saved Progress

| Term | Definition |
| --- | --- |
| Progress | What the game remembers between visits: the continue level, the unlocked levels and each level's last playthrough. Never a level in progress. |
| Playthrough | One play of a level from start to door: play time, stars collected and the level's star count. |
| Play Time | Game frames from the first playable frame until the hero steps into the door. Arrival frames are excluded. |
| Level Order | The sequence of levels. It names the first level, which is always unlocked, and the level each completion unlocks. It holds every level once and is never empty. |
| Unlocked Level | A level the player has reached, or whose preceding level the player has completed. A level never locks again. |
