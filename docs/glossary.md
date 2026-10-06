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

One 32 × 32 pixel square of the grid that map positions, collisions and interactions use.

### Hero

The girl of about seven whom the player moves through the game world.

### Collectible

A star or an orb that the hero picks up.

### Level

One enclosed part of the game world that the hero plays through, from her start tile to the door.

### Door

The exit of a level. It opens once the hero picks up every orb in the level, and stepping into it completes the level.

### Reachable

Describes a tile the hero can walk to from her start tile without stepping into the door.

### Hidden

Describes a tile that a tree canopy or the door is drawn over.

### Star

A gold collectible.

### Star Count

The number of stars a level holds. Each time the level starts, its stars go to random tiles that are reachable and not hidden.

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
