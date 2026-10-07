# Glossary

## Screen Layout

### Canvas

The drawing surface that fills the game view. Its pixel dimensions adapt to the available space, and each game pixel scales to a whole number of device pixels.

### Control Panel

The fixed-size area at the bottom of the screen that holds the joystick and the action buttons.

### Game View

The area at the top of the screen that shows the game world. It spans the full screen width on phones and the full column width on desktop, and takes all space above the control panel.

### Sound Switch

The button in the top right corner of the game view that turns the music and sound effects on or off.

### Full Screen Switch

The button beside the sound switch that shows the page full screen or returns it to normal. It appears only where the browser supports full screen.

### Level End Window

The window that opens after the hero completes a level. It shows the time the level took and the stars collected out of all stars, and its ΣΥΝΕΧΕΙΑ button starts the next level.

### Start Screen

The screen that covers the whole page when the game opens. It shows the game name, starts the continue level or the first level, and holds the level picker.

### Level Picker

The part of the start screen that lists every level by its number with its best playthrough, and starts any unlocked level.

### Menu Switch

The button beside the full screen switch that leaves the level in progress and opens the start screen.

## Joystick

The virtual joystick on the left side of the control panel that the player uses for movement. It consists of a ring and a knob.

### Knob

The part of the joystick that follows the player's thumb. It never travels beyond the ring.

### Ring

The outer boundary of the joystick that limits how far the knob can travel.

## Action Buttons

### Action Button

One of the two buttons, A and B, that the player presses to act. Both sit on the action button cross in the control panel.

### Action Button Cross

The cross layout on the right side of the control panel that holds the action buttons. A takes the top position and B takes the left position, while the right and bottom positions stay empty.

## Game World

### Tile

One 32 × 32 pixel square of the grid that map positions and interactions use.

### World Position

A point in the game world, measured in game pixels from the top left corner of the level.

### Hero

The girl of about seven whom the player moves through the game world.

### Feet

The small oval where the hero meets the ground. The feet collide with obstacles, and the tile under their middle decides what the hero picks up, reads or walks into.

### Heading

The exact direction in which the player steers the hero.

### Obstacle

The outline of the part of an object or ground that the hero cannot walk through. It follows where the object meets the ground, so the hero can walk close to its art, and it never reaches beyond the tile it blocks.

### Collectible

A star or an orb that the hero picks up.

### Level

One enclosed part of the game world that the hero plays through, from her start tile to the door.

### Door

The exit of a level. It opens once the hero has picked up every orb in the level and color has returned to the whole door, and stepping into it completes the level.

### Reachable

Describes a tile the hero can walk to from her start tile without stepping into the door.

### Hidden

Describes a tile that a tree canopy or the door is drawn over.

### Star

A gold collectible.

### Star Count

The number of stars a level holds. A level either places its stars on chosen tiles, or its stars go to random tiles that are reachable and not hidden each time it starts.

### Orb

A collectible in red, blue, violet or teal. Each orb carries its own symbol or shape and restores color to its own area of the level.

### Signpost

A wooden board in the game world that the player interacts with. Each signpost shows its own message when read.

### Stone

A gray object in the game world that the player interacts with.

### Floor Trigger

A plate in the ground that activates when an object arrives on it.

### Scenery

Everything in the game world that the player does not interact with, such as grass, trees, water, paths and flowers.

### Prop

A scenery object that stands on the ground, such as a tree, as opposed to a ground tile.

### Tree Variant

The kind of fruit a tree bears: no fruit, oranges, apples or lemons.

### Tree Cluster

A group of trees whose footprints touch, including at a corner. Every tree in a cluster has the same tree variant.

### Ground Shadow

The shadow directly below an object, drawn in the shading step of the surface beneath it.

### Contact Row

The single row of pixels in the surface's shading step directly beneath the base of an object that meets the ground.

## Fading and Restoration

### Faded World

The state of the game world at the start, in which only the hero, stars and orbs are in color.

### Faded Version

The variant of a scenery tile or prop in which each palette step maps to a neutral.

### Restoration

The return of color to the faded world, which spreads outward from a point.

### Area

A part of a level that returns to color together during restoration. Each orb restores one area, and the areas of a level's orbs together cover every tile.

## Saved Progress

### Progress

What the game remembers between visits: the continue level, the unlocked levels and the best playthrough of each level. It never holds the state of a level in progress.

### Playthrough

One play of a level from its start to the door, made of its play time, the stars collected and the level's star count.

### Play Time

The number of game frames from the start of a level until the hero steps into the door.

### Best Playthrough

The completed playthrough of a level with the most stars collected, where fewer frames of play time decide between equal stars. A playthrough always replaces one made when the level held a different star count.

### Unlocked Level

A level that the player has reached at least once. The first level is always unlocked, and a level never locks again.

### Continue Level

The level that the player reached most recently, which the start screen starts when the player continues.
