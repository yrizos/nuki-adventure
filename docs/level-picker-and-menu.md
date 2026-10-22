# Level Picker and Menu

Colors are set in [Color Palette](palette.md#ui). Text lines follow [Text](ui-layout.md#text). The frame is the [message box](ui-layout.md#message-box) frame.

## Menu Screen

- Covers the whole page, control panel included, when the game opens, when Escape leaves the intro, when the end screen leaves and when the menu switch is pressed.
- Pixel art on the panel pixel grid, on a plain background with no scenery.
- The game name is one logo over three centered lines: Η ΠΟΛΥΧΡΩΜΗ, ΠΕΡΙΠΕΤΕΙΑ and ΤΗΣ ΝΟΥΚΙ.
  - All letters share one heavy display font, and every other letter sits one pixel lower.
  - Each line closes into one outlined block, the three blocks share one sticker border, and a shadow falls below it.
  - The logo sits midway between the top of the screen and the buttons.
  - On each opening it appears through the ordered 4 × 4 dither, one threshold every 2 game frames.
  - Once whole, it rests for 3 seconds. Then a shine sweeps diagonally across the letters from top left to bottom right, 2 pixels per game frame, and the rest begins again.
  - Once the logo is whole, small sparkles twinkle on the dark around it, in its corners and beside its shorter lines, never over the sticker or its shadow. One sparkle at a time grows from a dot to a cross to a four-point star and shrinks back, one step every 4 game frames, then the dark rests for 10 steps before the next spot lights. Reopening the screen starts them again from dark.
  - Also once the logo is whole, 14 square confetti bits of 2 × 2 pixels drift down behind it, one pixel every 4 game frames. They start 12 pixels above the logo and 6 pixels to each side of it, and after 12 pixels below it they start again at the top. Reopening the screen hides them until the logo is whole again.
- At the bottom, all three buttons in this order, 8 pixels apart like the confirmation's answers, always shown, styled like the A button and sinking into their lips while pressed. All share the width of the widest. Buttons work from the first frame, and the first enabled button takes focus.
- A button whose condition does not hold is disabled. It is dimmed like a disabled action button and ignores touch and keys.

| Button | Enabled when | Action |
| --- | --- | --- |
| ΣΥΝΕΧΕΙΑ | A level was started, unless the last level started is the final level and it has a completed playthrough | Resumes the level in progress at its last calm moment with its play time, without the magical arrival. With no level in progress, starts the last level started |
| ΕΠΙΠΕΔΑ | Any progress is saved | Opens the level picker |
| ΝΕΟ ΠΑΙΧΝΙΔΙ | Always | Plays the intro, then starts the first level. With progress saved, opens the confirmation first |

- The menu screen and the level picker cover all three switches.
- The screen scrolls when its contents do not fit.

### Confirmation

- A modal over the menu screen. The menu screen stays in place behind it, dimmed by an ordered dither of Ink that stops at half the thresholds. The modal covers the switches too.
- One message box frame, centered on the page, with 16 pixels of padding. It holds ΝΕΟ ΠΑΙΧΝΙΔΙ; over Η ΠΡΟΟΔΟΣ ΘΑ ΧΑΘΕΙ. in the message box font, both lines centered.
- 16 pixels below the question, ΝΑΙ and ΟΧΙ at the menu screen button width, 8 pixels apart. ΝΑΙ wears the A button colors and ΟΧΙ the B button colors. ΟΧΙ takes focus.
- The modal and its dimming appear and disappear through the ordered 4 × 4 dither, one threshold per game frame. The answers act only once the modal is whole.
- While the modal is open, keys and touches reach only ΝΑΙ and ΟΧΙ.
- ΝΑΙ deletes all saved progress and plays the intro. ΟΧΙ dithers the modal out. Escape closes it at once.

## Level Picker

### Modal

- ΕΠΙΠΕΔΑ opens the level picker as a big modal over the menu screen. It appears and disappears like the [confirmation](#confirmation): the same Ink dither darkens the menu screen behind it, and the same dither masks the box while it comes and goes. Cards and ΠΙΣΩ act only once the modal is whole.
- The modal covers the whole page, switches included. It shares the confirmation's width, and the margin above and below the box matches the margin beside it.
- The box wears the message box frame. Inside it, ΕΠΙΠΕΔΑ sits at the top in the message box font, then the cards, then a row with two scroll buttons on the left and ΠΙΣΩ on the right.
- The scroll buttons are A-colored with an up and a down arrow. Each press scrolls the cards by most of their visible height. A scroll button is disabled once there is nothing more in its direction. ΠΙΣΩ wears the B button colors at its own text width.
- Only the cards scroll. The heading and ΠΙΣΩ stay in place, and no scrollbar is drawn, so a card cut off at the edge shows that there is more.
- On opening, the card of the level ΣΥΝΕΧΕΙΑ would start takes focus and scrolls into view. With nothing to continue, the first unlocked card does.
- ΠΙΣΩ dithers the modal out and returns focus to ΕΠΙΠΕΔΑ. The menu screen behind it does not replay its title. Escape and the menu switch close it at once.

### Cards

- One card per level in order, two to a row. All cards share one size, wearing the message box frame.
- The top of a card is a map of the whole level, centered in a one pixel Ink border, so each level is recognized by its layout. The level's longer side fills the 60 pixel map, and each map pixel takes the most common color of its part of the painted world. The orbs are left out, because they land on different spots every time a level is built.
  - An unlocked level shows its world in color, as its orbs restore it, whether or not it was completed.
  - The level that ΣΥΝΕΧΕΙΑ would start shows the 32 × 32 Nuki, centered on the map, with her idle breathing and blinking on the game's frame clock from the moment the picker opens.
  - A locked level shows no map. Its window stays filled with the message box color, with the 16 × 16 padlock at its center.
- The level number sits over the map's top left corner at the font size, 4 pixels in from the map's edges, with a one pixel Ink outline so it reads on any ground.
- Below the map, a strip in the message box color. A completed level shows a 9 × 9 clock and its last play time at the right. A level without a completed play leaves the strip empty.
- A card sinks one pixel while pressed. Tapping an unlocked card starts that level.
- A locked card cannot be focused or chosen. A locked level never starts by any route.
- Screen readers hear the level number, then the last time in words, or that it is locked.

## Menus

- On the menu screen and the level picker, arrow keys move focus and A or B chooses the focused item.
- No button or card ever shows a focus outline.
