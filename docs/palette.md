# Color Palette

Hex values and the faded mapping live in [`src/presentation/sprites/palette.js`](../src/presentation/sprites/palette.js). [`src/presentation/palette.ts`](../src/presentation/palette.ts) defines the valid codes and the ramp order. This file assigns codes to elements.

## Principles

- Ramp steps run darkest to lightest. Shadows lean toward blue or teal, highlights toward yellow.
- A new hue is added as a full four-step ramp, never as a single color.
- Ink is the outline color for everything the player interacts with: the hero, stars, keys and stones. Ink has no lighter ramp step.
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

## World

| Element | Colors |
| --- | --- |
| Hero | E3 hair, E2 hair shading, E4 hair highlights, E1 eyes, Paper catchlights, S2 skin, S1 skin shading, S3 skin highlights, P2 t-shirt, P1 t-shirt shading, P3 t-shirt highlights, W1 jeans, W0 jeans shading, E1 shoes |
| Grass | G2 base, G3 tufts, G1 shading |
| Trees | G1 canopy, G0 shadow, G3 leaf highlights, E1 trunk, E0 trunk shadow |
| Water | W1 body, W0 deep edges, W2 ripples, W4 foam |
| Water lilies | G2 pads, G3 highlights, G1 shading and bottom right edges, P3 petals, P2 petal shading, Y3 centers, W0 waterline |
| Paths | E3 base, E4 highlights, E2 edges |
| Flowers | R3, V3, W3 or Paper petals, Y3 centers, G1 stems |
| Stars | Y2 body, Y1 shading, Y3 shine |
| Keys | Y2 core, Y1 shading, Y3 shine. Silver keys use N3, N4 and W4 on the same pixels |
| Stones | N3 base, N2 shading, N4 highlight |
| Mossy stones | Stone colors, with G1 moss and G2 moss highlights on selected top and side surfaces |
| Boulder | N4 base, N3 shading and crack, Paper highlight, one step lighter than stones so it reads as movable |
| Pressure plate | O0 outline, O2 base, O1 shading and groove, O3 highlight. Its faded grays are darker than the boulder's, so the two stay apart before restoration |
| Fences | E1 wood, E2 highlight, E0 shading |
| Gate | E0 wood and shading, E1 highlight |
| Door | E1 frame, E2 frame highlights, E0 frame shading and grain, E2 planks, E0 plank lines and handles, E0 doorway when open |
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
| Start screen and level picker | Ink background with no texture. Buttons use the A button colors, pressed state included |
| Game name | Paper, with ΠΟΛΥΧΡΩΜΗ letters cycling through V2, T2 and R2, and ΝΟΥΚΙ in Y2 |
| Level card clock | Paper face, N4 shading, Ink outline, marks and hands |
| Level card star | Same as the world star |
| Locked level card | The whole card through the faded mapping |

## Contrast

Text needs at least 4.5:1. Controls need at least 3:1. Pairs closest to those limits:

| Pair | Ratio |
| --- | --- |
| R1 on Ink, pressed menu buttons | 3.1:1 |
| R2 on V0, A button | 3.9:1 |
| V2 on V0, joystick ring | 4.3:1 |
| W2 on V0, B button | 4.5:1 |
| Paper on R1 or W1, pressed letters | 5.0:1 |

Stars and keys reach only 1.3:1 against paths and 1.9:1 against grass, so their Ink outline is required. It reaches 5.8:1 against grass and 8.4:1 against paths. Keys and stars share colors and differ by silhouette alone.
