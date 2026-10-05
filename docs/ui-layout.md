# UI Layout

The screen is divided vertically into three areas.

Landscape orientation is not supported.

```text
┌────────────────────────┐
│                        │
│       GAME VIEW        │
│                        │
├────────────────────────┤
│     MESSAGE PANEL      │
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
- The column narrows until all three areas fit within the window height
- The message panel still keeps room for a few lines of text

## Game View

- Top of the screen
- Square, full screen width on phones and full column width on desktop
- Fixed size
- Shows the game world

## Message Panel

- Between the game view and the control panel
- Takes all remaining space
- Shows text during play
- Uses the Material body text style
- Keeps room for a few lines of text on small phones

## Control Panel

- Bottom of the screen
- Fixed size, set by the action button cross plus the standard margins
- Holds the movement and action controls

```text
┌────────────────────────┐
│                 (A)    │
│   ( ◉ )      (B)       │
│                        │
└────────────────────────┘
```

- Left side: a virtual joystick for movement
- Right side: an A button and a B button for actions, placed on a cross with A at the top position and B at the left position
- The right and bottom positions of the cross stay empty

### Joystick

- The ring is large enough for a thumb to land on reliably
- The knob matches the size of the action buttons
- The knob never travels beyond the ring

### Action Buttons

- A and B use the standard Material action button size

## Keyboard

- Arrow keys move the hero
- Z or Space presses A
- X or Enter presses B
- A key press shows the matching action button as pressed
