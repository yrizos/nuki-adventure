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

### Scaling

- The control panel is designed for a 360 pixel column and scales as a whole with the column width
- Every size, gap and distance in the panel scales by the same factor, so the controls keep their shapes, spacing and proportions at every width
- The column never narrows below 320 pixels to fit the window height, and the page scrolls instead, so the action buttons stay above the Material minimum touch target

### Measurements

All values apply at the 360 pixel design width.

| Element | Size |
| --- | --- |
| Padding on all four sides | 32 pixels |
| Panel height | 184 pixels |
| Joystick ring | 120 pixels across, with a 2 pixel border |
| Joystick knob | 56 pixels across |
| Direction arrows | 12 × 8 pixels, 8 pixels inside the ring |
| A and B buttons | 56 pixels across |
| Gap between the A and B positions | 8 pixels |
| Button and knob lip | 4 pixels |
| Button letters | 22 pixels, bold |

### Joystick

- The ring is large enough for a thumb to land on reliably
- The knob matches the size of the action buttons
- The knob never travels beyond the inner edge of the ring, so it never covers the ring border
- Four arrows inside the ring point up, right, down and left
- The knob sits on a lip below it, which disappears while the joystick is held
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
