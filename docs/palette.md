# Color Palette

Hex values and the faded mapping live in [`assets/sprites/palette.js`](../assets/sprites/palette.js). [`src/user-interface/graphics/palette.ts`](../src/user-interface/graphics/palette.ts) defines the valid codes and the ramp order. This file assigns codes to elements.

## Principles

- Ramp steps run darkest to lightest.
- Each ramp shifts hue as it changes value. Greens run from a dark teal G0 to a pale yellow green G4. Earth runs from a plum E0 to a cream E4.
- Shadows lean cool, toward blue, teal or violet. Highlights lean warm, toward yellow or cream.
- The neutrals are cool. N1 to N4 are blue grays and Ink is a deep indigo. Paper is a warm cream.
- Every step is lighter than the one before it, so each ramp stays readable in grayscale.
- A new hue is added as a full four-step ramp, never as a single color.
- Ink is the outline color for the hero, orbs, stones and the boulder. Ink also colors small dark details such as eyes and pupils. Ink has no lighter ramp step.
- Pure white is never used. Pure black is only the desktop background outside the game column.

## Codes

| Ramp | Codes |
| --- | --- |
| Neutrals | Ink, N1, N2, N3, N4, Paper |
| Greens | G0 to G4 |
| Earth | E0 to E4 |
| Water | W0 to W4 |
| Gold | Y0 to Y3 |
| Red | R0 to R3 |
| Violet | V0, V0a, V1, V2, V3 |
| Teal | T0 to T3 |
| Pink | P0 to P3 |
| Skin | S0 to S3 |
| Orange | O0 to O3 |
| Moss | M0 to M3 |
| Fir | F0 to F3 |

## World

| Element | Colors |
| --- | --- |
| Hero | E3 hair, E2 hair shading, E4 hair highlights, E1 hair strands, Ink eyes, Paper catchlights, S2 skin, S1 skin shading, S3 skin highlights, S0 mouth, R1 open mouth, R3 cheeks, P2 t-shirt, P1 t-shirt shading, P3 t-shirt highlights, P0 t-shirt creases, W1 jeans, W0 jeans shading, W2 jeans highlights, E1 shoes with E2 and E3 accents |
| Grass | G2 base, G3 tufts, G4 tuft tips, G1 shading |
| Undergrowth | G3 leaves, G4 leaf tips, G2 and G1 shading, G0 deep shadow |
| Trees | G1 canopy, G0 shadow, G2 and G3 leaf highlights, E1 trunk, E2 trunk highlight, E0 trunk shadow. A warm version uses M2 and M3 on the G2 and G3 pixels for an olive green. A cool version uses F2 and F3 for a blue green. Fruit trees add R2 apples with R1 shading and R3 shine, Y1 oranges with Y0 shading and S3 shine, or Y3 lemons with Y2 shading and Paper shine |
| Water | W1 body, W2 ripples, W3 ripple highlights, W4 foam |
| Water lilies | G2 pads, G3 and G4 highlights, G1 shading and bottom right edges, G0 accents, P3 petals, P2 and P1 petal shading, Paper petal accents, Y2 and Y3 centers, W0 waterline, W2 ripples |
| Paths | E3 base, E4 highlights, E2 shading |
| Terrain transitions | Grass, path and water colors where tiles meet. Shores add G1 grass edges, an E2 bank, E1 bank shading, a W0 waterline, W4 foam and W3 highlights |
| Ground shadows | G1 or E2, one color per shadow |
| Flowers | R3, V3, W3 or Paper petals, shaded with R2 and R1, V2 and V1, W2 and W1, or N4 and N3. Y3 centers with Y2 and Y1 shading. G1 stems, G3 leaves |
| Orbs | One ramp per orb: rim, shading, body and light steps 0 to 3 of R, O, Y, T, W, V or P, and steps 1 to 4 of G so green stands out from G2 grass. Paper core and shine. [`sprite-library.ts`](../src/user-interface/graphics/sprite-library.ts) maps each hue to its steps |
| Stones | N3 base, N2 shading, N1 deep shading, N4 highlight, Paper glints |
| Mossy stones | Stone colors, with M2 moss, M3 moss highlights and M1 and M0 moss shading on selected top and side surfaces |
| Boulder | N4 base, N3 shading and crack, N2 crack accents, Paper highlight, one step lighter than stones so it reads as movable |
| Pressure plate | O0 outline, O2 base, O1 shading and groove, O3 highlight. Its faded grays are darker than the boulder's, so the two stay apart before restoration |
| Fences | E1 wood, E2 highlight, E0 shading, E3 post and rail tops |
| Gate | E0 wood and shading, E1 board highlights, E2 rails and brace, N3 and N1 iron fittings |
| Door | E1 frame, E2 frame highlights and planks, E3 lintel and band highlights, E0 frame shading and plank lines, N3 and N1 hinges, N4 and N1 studs, N4, N3 and N1 ring handles, N4, N3 and N2 stone base, E0 doorway when open |
| Butterflies | Four steps per color. Y0 body and wing edges, Y2 wings, Y1 and Y3 wing markings. Red, violet and pink butterflies use R0 to R3, V0 to V3 or P0 to P3 on the same pixels |
| Birds | E3 head highlight, E2 head and back, E1 wing, E0 tail, lower outline and feet, Ink eye, O2 breast, O1 breast shading, O3 breast highlight, Y2 beak |
| Frogs | T2 body, T1 shading, back spot and feet, T0 outline and mouth line, T3 back highlight, Ink pupils, Y2 iris, Y3 throat and croak sac, Paper eye and sac shine. Ripples use W3 and W2 rings with W4 foam |
| Light motes | Paper |

## UI

| Element | Colors |
| --- | --- |
| Control panel | V0 background, V0a grip dots, an Ink row then a V1 row along the top edge |
| Joystick | V2 ring edge, Ink well with a V1 bottom right wall, V2 arrows (P3 while held) |
| Joystick knob | P2 face, P3 highlight, P1 shading, P1 thumb dimple, P0 lip, Ink outline |
| A button | R2 face, R3 highlight, R1 shading, R0 lip, Ink outline and letter |
| B button | W2 face, W3 highlight, W1 shading, W0 lip, Ink outline and letter |
| Pressed button | Face, highlight and shading drop one step (A to R1, B to W1). Letter turns Paper |
| Framed box (message box, switches, level cards) | Ink outline, V1 inner edge, V0 fill, Paper text and symbols |
| Intro | Ink page and gutters. Panels and texts in the framed box colors. The sound word in Y3, Y2 and O2 with an Ink outline. Skip circle with an Ink ring and an N1 face filling with Paper, shaded N4 |
| Menu screen and level picker | Ink background with no texture. Buttons use the A button colors, pressed state included |
| Game name | Letters cycle through the R, O, Y, G, T, V and P ramps, light on top, base in the middle, dark at the bottom. Ink outline, Paper sticker border, V1 shadow. The shine is Paper with each letter's light step on both edges. Each sparkle has a Paper center and rays in one light step: R3, Y3, G4, T3 or P3. Confetti bits take the base steps R2, O2, Y2, G3, T2, V2 and P2 |
| Level card clock | Paper face, N4 shading, Ink outline, marks and hands |
| Locked level card | The whole card through the faded mapping |

## Contrast

Text needs at least 4.5:1. Controls need at least 3:1. Pairs closest to those limits:

| Pair | Ratio |
| --- | --- |
| R1 on Ink, pressed menu buttons | 3.3:1 |
| R2 on V0, A button | 4.1:1 |
| V2 on V0, joystick ring | 4.7:1 |
| Paper on R1 or W1, pressed letters | 4.9:1 |
| W2 on V0, B button | 5.1:1 |

Orb ramps can sit close in value to the ground below them, so their Ink outline is required. Ink reaches 6.0:1 against grass and 9.0:1 against paths.
