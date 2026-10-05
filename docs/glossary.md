# Glossary

## Screen Layout

### Canvas

The 144 × 144 pixel drawing surface inside the game view. It scales by a whole number of device pixels and sits centered in the game view.

### Control Panel

The fixed-size area at the bottom of the screen that holds the joystick and the action buttons.

### Game View

The square area at the top of the screen that shows the game world. It spans the full screen width on phones and the full column width on desktop, and has a fixed size.

### Message Panel

The area between the game view and the control panel that shows text during play. It takes all remaining space.

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

One 16 × 16 pixel square of the grid that map positions, collisions and interactions use.

### Hero

The girl of about seven whom the player moves through the game world.

### Collectible

A star or an orb that the hero picks up.

### Star

A gold collectible.

### Orb

A collectible in red, blue, violet or teal. Each orb carries its own symbol or shape.

### Signpost

A wooden board in the game world that the player interacts with.

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
