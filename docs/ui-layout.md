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
