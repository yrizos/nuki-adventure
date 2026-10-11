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

### Level Entry

- The game view shows the level as soon as it starts, with no loading screen or overlay
- The control panel stays visible
- WHEN a level opens with the [magical arrival](visual-style.md#magical-arrival), movement starts after its 48 frames with no button press
- The menu switch works throughout the arrival

### Message Box

- Messages appear in a box inside the game view, aligned to its bottom edge
- The box spans the game view with an 8 pixel margin on the left, right and bottom, measured in game pixels
- The box has a one pixel Ink outline with clipped corners, a one pixel V1 inner edge and a V0 fill, matching the control panel's top edge
- Text is Paper, set in a 5 × 9 pixel font with one pixel strokes and 2 pixels between letters, with 10 pixels of padding and 16 pixel lines, and wraps between words
- Messages are written in Greek capitals without accent marks
- The box appears and disappears through the ordered 4 × 4 dither, one threshold per game frame, so it never uses transparency
- A hidden live region repeats the shown text for screen readers

### Sound Switch

- A sound switch sits in the top right corner of the game view, 8 panel pixels from the top and right edges, below the top safe-area inset
- It is 19 × 19 panel pixels and uses the message box frame: a one pixel Ink outline with clipped corners, a one pixel V1 inner edge and a V0 fill
- A Paper speaker sits at its center, with two sound waves while sound is on and a cross in place of the waves while sound is off
- Its touch area never shrinks below the Material minimum touch target, even when the drawn switch is smaller
- It turns the music and every sound effect on or off together
- The game remembers the choice for the next visit

### Full Screen Switch

- A full screen switch sits just left of the sound switch, with the same size and frame
- The gap between the two switches is 4 panel pixels, widened where needed so their touch areas meet without overlapping
- A Paper symbol of four corners sits at its center, pointing outward while the page is not full screen and inward while it is
- It shows the whole page full screen or returns it to normal
- It appears only in browsers that can show a page full screen, so it is hidden on iPhone

### Menu Switch

- A menu switch sits just left of the full screen switch, or just left of the sound switch where full screen is hidden, with the same size, frame and gap
- A Paper symbol of three stacked bars sits at its center
- It leaves the level in progress at once and opens the start screen, and the level starts afresh when chosen again

## Start Screen

- The start screen covers the whole page, including the control panel, whenever the game opens and whenever the menu switch is pressed
- It is pixel art on the panel pixel grid, on a plain Ink background with no scenery
- The game name, Η ΠΟΛΥΧΡΩΜΗ ΠΕΡΙΠΕΤΕΙΑ ΤΗΣ ΝΟΥΚΙ, sits at the top in the message box font, over two centered lines, in the colors set in the palette
- Each time the start screen opens, the game name appears through the ordered 4 × 4 dither, one threshold every 2 game frames, and then stays still. The buttons work from the first frame
- Below it sit two buttons in the A button colors with a lip, each sinking into its lip while pressed: ΝΕΟ ΠΑΙΧΝΙΔΙ starts the first level and ΕΠΙΛΟΓΗ ΕΠΙΠΕΔΟΥ opens the level picker
- Starting the first level from ΝΕΟ ΠΑΙΧΝΙΔΙ keeps every unlocked level and every last playthrough
- Nuki stands at the bottom of the screen facing the player, at one panel pixel per hero pixel, breathing and blinking as she does when idle in a level
- Her idle animation runs on the game's frame clock from the moment the start screen opens, and the screen owns no timer of its own
- Arrow keys move keyboard focus between the buttons, and A or B chooses the focused one
- The start screen scrolls when its contents do not fit

## Level Picker

- The level picker covers the whole page like the start screen, on the same background
- It lists every level of the game in order, one card per level, above a ΠΙΣΩ button in the A button colors that returns to the start screen
- Each card is a window in the message box frame, and every card has the same size whatever its statistics, so the cards line up
- The top of a card shows the level number in Paper at twice the font size
- The bottom of a completed level's card shows a clock drawing beside the last play time, as minutes and seconds, and a star drawing beside the last stars out of all stars
- The numbers are Paper, in the message box font
- Time and stars appear only on level cards
- An unlocked level that has no completed playthrough shows its number only, with no time, stars, dash or label
- A locked level's card is drawn through the faded world's neutral palette mapping, shows its number only and cannot be focused or chosen
- Tapping an unlocked card starts that level, and a locked level never starts, whatever chose it
- Arrow keys move keyboard focus between the cards and ΠΙΣΩ, and A or B chooses the focused one
- No button or card ever shows an outline, focused or not
- The cards are spaced so each touch area stays above the Material minimum touch target
- Screen readers hear each card as the level number, then the last time and stars in words, or that it is locked
- The level picker scrolls when its contents do not fit

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
- The knob and the buttons have a one pixel Ink outline, and every control takes its light from the top left
- The panel is deep violet in V0, which sits between the red A and the blue B, with an Ink row and then a V1 row along its top edge where it meets the game view
- The panel surface has a grip texture of 2 × 2 dots, spaced 8 pixels apart, with every other row of dots shifted by 4 pixels
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
- Four arrows inside the ring point up, right, down and left, and an arrow lights up while the thumb leans more than 22.5 degrees toward it
- The knob sits on a lip below it, and while the joystick is held the knob sinks into its lip, so the lip disappears
- The knob has a thumb dimple at its center
- The hero starts walking once the knob travels 30 percent of its reach and stops when it falls back below 25 percent, so a resting thumb neither moves her nor starts and stops her
- The hero walks along the exact angle of the thumb

### Action Buttons

- A and B are circles that sit on a lip below them
- A pressed button sinks into its lip, so the lip disappears
- The right half of the control panel is the touch area for the action buttons, and a touch anywhere in it presses the button whose center is nearest
- A and B are disabled while a level is played, because no level uses them. A disabled button is dimmed and ignores touch and keys
- A and B are enabled on the start screen and the level picker, where they choose items

## Browser Behavior

- Holding a finger on the control panel never opens a context menu or a callout
- Touches on the control panel never zoom the page
- Dragging down never reloads the page

## Keyboard

- Arrow keys move the hero
- Z or Space presses A
- X or Enter presses B
- Escape opens the start screen, like the menu switch
- A key press shows the matching action button as pressed
