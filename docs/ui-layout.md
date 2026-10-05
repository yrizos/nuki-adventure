# UI Layout

The screen is divided vertically into two areas.

Landscape orientation is not supported.

```text
┌────────────────────────┐
│                        │
│       GAME VIEW        │
│                        │
├────────────────────────┤
│     CONTROL PANEL      │
└────────────────────────┘
```

## Sizing

- Sizes and spacing follow Material Design
- Margins and gaps follow the Material spacing grid
- Every control meets the Material minimum touch target size

## Desktop

- The layout is a centered column instead of spanning the full window width
- The background outside the column is pitch black

## Game View

- Top of the screen
- Full screen width on phones and full column width on desktop
- Takes all space above the control panel
- Shows the game world

## Control Panel

- Bottom of the screen
- Holds the movement and action controls

```text
┌────────────────────────┐
│                   (A)  │
│   ( ◉ )      (B)       │
└────────────────────────┘
```

- Left side: a virtual joystick for movement
- Right side: an A button and a B button for actions, placed on a diagonal with A at the top right and B at the bottom left
- The joystick ring fills the height inside the padding
- Each control is centered with its lip, so a face and its lip sit centered together

### Pixel Art

- The control panel is pixel art drawn from palette codes, like the game world, so the two areas read as one game
- The panel is measured in panel pixels, and each panel pixel is a whole number of device pixels, so the art stays crisp at every width
- A panel pixel is the largest whole number of device pixels that fits 180 panel pixels across the column, and never less than one device pixel
- Every control has a one pixel Ink outline and takes its light from the top left
- The panel is deep violet in V0, which sits between the red A and the blue B, with an Ink row and then a V1 row along its top edge where it meets the game view
- The space between the joystick and the action buttons absorbs any width left after rounding

### Scaling

- The column never narrows below 320 pixels to fit the window height, and the page scrolls instead
- The action button touch area covers half the panel, so it stays above the Material minimum touch target at every width

### Measurements

All values are in panel pixels.

| Element | Size |
| --- | --- |
| Padding on all four sides | 16 |
| Panel height | 92 |
| Joystick ring | 60 across, with a 3 pixel rim |
| Joystick knob | 28 across |
| Direction arrows | 8 × 4, 3 pixels inside the rim |
| A and B buttons | 28 across |
| Gap between the A and B positions | 4 |
| Button and knob lip | 2 |
| Button letters | 8 × 9, with 2 pixel strokes |

### Joystick

- The ring is large enough for a thumb to land on reliably
- The knob matches the size of the action buttons
- The knob never travels beyond the inner edge of the rim, so it never covers the rim
- The knob moves in whole panel pixels
- Four arrows inside the ring point up, right, down and left, and the arrows for the held direction light up
- The knob sits on a lip below it, and while the joystick is held the knob sinks into its lip, so the lip disappears
- The knob has a thumb dimple at its center
- A dead zone of 30 percent of the knob's travel keeps a resting thumb from moving the hero
- Up, right, down and left each cover 60 degrees around their arrow, and each diagonal covers the 30 degrees between them, so a thumb aimed slightly off a straight line still moves the hero straight

### Action Buttons

- A and B are circles that sit on a lip below them
- A pressed button sinks into its lip, so the lip disappears
- The right half of the control panel is the touch area for the action buttons, and a touch anywhere in it presses the button whose center is nearest

## Browser Behavior

- Holding a finger on the control panel never opens a context menu or a callout
- Touches on the control panel never zoom the page
- Dragging down never reloads the page

## Keyboard

- Arrow keys move the hero
- Z or Space presses A
- X or Enter presses B
- A key press shows the matching action button as pressed
