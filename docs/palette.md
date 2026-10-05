# Color Palette

## Principles

- Each ramp shifts hue as it changes brightness, with shadows leaning toward blue or teal and highlights toward yellow
- Scenery uses mid-saturation steps, while stars and orbs own the brightest, most saturated steps
- In the game world, Y1 and Y2 are reserved for stars
- Flowers use soft light steps, never the saturated steps reserved for orbs
- Ink is the single outline color for everything the player interacts with: the hero, stars, orbs, signposts, stones and floor triggers
- Pure black is used only for the desktop background outside the game column; pure white is not used
- A new hue is added as a full ramp of four steps, never as a single color

## Ramps

Steps run from darkest to lightest.

### Neutrals

| Code | Hex |
| --- | --- |
| Ink | `#1C1A2E` |
| N1 | `#34344F` |
| N2 | `#565875` |
| N3 | `#8A8CA6` |
| N4 | `#C4C6D6` |
| Paper | `#F5F2E9` |

### Greens

| Code | Hex |
| --- | --- |
| G0 | `#1F4A3F` |
| G1 | `#2F7A4A` |
| G2 | `#5AA845` |
| G3 | `#9BD35A` |
| G4 | `#D8EE8C` |

### Earth

| Code | Hex |
| --- | --- |
| E0 | `#3A2622` |
| E1 | `#6E4430` |
| E2 | `#A8703F` |
| E3 | `#D9B072` |
| E4 | `#F0DDA6` |

### Water

| Code | Hex |
| --- | --- |
| W0 | `#1E3A6E` |
| W1 | `#2F67B8` |
| W2 | `#4FA0E3` |
| W3 | `#9AD7F5` |
| W4 | `#E6F7FF` |

### Gold

| Code | Hex |
| --- | --- |
| Y0 | `#9A5A12` |
| Y1 | `#E3961C` |
| Y2 | `#FFC93A` |
| Y3 | `#FFF0A0` |

### Red

| Code | Hex |
| --- | --- |
| R0 | `#6E1C33` |
| R1 | `#C2303E` |
| R2 | `#F0604F` |
| R3 | `#FFB3A3` |

### Violet

| Code | Hex |
| --- | --- |
| V0 | `#3F2466` |
| V0a | `#482A74` |
| V1 | `#7A45BF` |
| V2 | `#B47EF0` |
| V3 | `#E8C9FF` |

### Teal

| Code | Hex |
| --- | --- |
| T0 | `#134A52` |
| T1 | `#1F8A8A` |
| T2 | `#3CC8B4` |
| T3 | `#A6F0DE` |

### Pink

| Code | Hex |
| --- | --- |
| P0 | `#6B1F4F` |
| P1 | `#C23A7E` |
| P2 | `#F27AB0` |
| P3 | `#FFC2DD` |

### Skin

| Code | Hex |
| --- | --- |
| S0 | `#7A4A38` |
| S1 | `#C08262` |
| S2 | `#E8B896` |
| S3 | `#FFE0C7` |

## World

| Element | Colors |
| --- | --- |
| Hero | E3 hair, E2 hair shading, E4 hair highlights, E1 eyes, Paper eye catchlights, S2 skin, S1 skin shading, S3 skin highlights, P2 t-shirt, P1 t-shirt shading, P3 t-shirt highlights, W1 jeans, W0 jeans shading, E1 shoes |
| Grass | G2 base, G3 tufts, G1 shading |
| Trees | G1 canopy, G0 shadow, G3 leaf highlights, E1 trunk, E0 trunk shadow |
| Water | W1 body, W0 deep edges, W2 ripples, W4 foam |
| Paths | E3 base, E4 highlights, E2 edges |
| Flowers | R3, V3, W3 or Paper petals, Y3 centers, G1 stems |
| Signposts | E1 board, E2 highlight, E0 shadow |
| Stars | Y2 body, Y1 shading, Y3 sparkle |
| Stones | N3 base, N2 shading, N4 highlight |
| Floor triggers | N2 plate, N1 inset, Y3 inset when activated |
| Fences | E1 wood, E2 highlight, E0 shading |
| Door | E1 frame, E2 frame highlights, E0 frame shading and grain, E2 planks, E0 plank lines and handles, E0 doorway when open |
| Light motes | Paper |

### Orbs

| Orb | Shading | Core | Shine |
| --- | --- | --- | --- |
| Red | R1 | R2 | R3 |
| Blue | W1 | W2 | W3 |
| Violet | V1 | V2 | V3 |
| Teal | T1 | T2 | T3 |

## Future Elements

- Stone walls and paved floors use N2 to N4
- Wooden buildings use E0 to E2
- Roofs use R0 to R1, V0 to V1 or W0 to W1

## UI

UI colors map onto Material 3 color roles.

| Material role | Element | Color |
| --- | --- | --- |
| Surface container | Control panel background | V0 |
| Surface container | Control panel grip dots | V0a |
| Outline | Control panel top edge | Ink row, then a V1 row |
| Outline | Joystick ring edge | V2 |
| Surface container lowest | Joystick well | Ink, with a V1 bottom right wall |
| Outline | Joystick direction arrows | V2, P3 while held |
| On surface variant | Joystick knob | P2, with a P3 highlight, P1 shading, a P1 thumb dimple and a P0 lip, matching the hero's t-shirt |
| Primary | A button | R2, with an R3 highlight, R1 shading, an R0 lip and an Ink letter |
| Secondary | B button | W2, with a W3 highlight, W1 shading, a W0 lip and an Ink letter |
| Outline | Knob and button outlines | Ink |
| Surface container | Message box fill | V0 |
| Outline | Message box edge | Ink outline, then a V1 inner edge |
| On surface | Message box text | Paper |
| Surface container | Sound and full screen switch fill | V0 |
| Outline | Sound and full screen switch edge | Ink outline, then a V1 inner edge |
| On surface | Sound switch speaker and full screen switch corners | Paper |

### Pressed State

- A pressed button drops one step on its face, highlight and shading, so A becomes R1 and B becomes W1
- The letter on a pressed button switches to Paper
- A pressed button sinks into its lip, so the lip is no longer visible
- Touch and keyboard presses use the same pressed state

## Accessibility

### Contrast

Text targets the Web Content Accessibility Guidelines (WCAG) minimum of 4.5:1, and controls target the 3:1 minimum for non-text elements.

| Pair | Ratio |
| --- | --- |
| Ink on R2, A letter | 5.2:1 |
| Ink on W2, B letter | 6.0:1 |
| Paper on R1, pressed A letter | 5.0:1 |
| Paper on W1, pressed B letter | 5.0:1 |
| R2 on V0, A button | 3.9:1 |
| W2 on V0, B button | 4.5:1 |
| V2 on V0, joystick ring | 4.3:1 |
| P2 on V0, joystick knob | 4.9:1 |
| V2 on Ink, joystick arrows | 5.8:1 |
| P3 on Ink, lit joystick arrows | 11.3:1 |
| Paper on V0, message text | 11.3:1 |
| Paper on V0, sound and full screen switch symbols | 11.3:1 |

### Collectibles

- Stars reach only 1.3:1 brightness contrast against paths and 1.9:1 against grass, so the Ink outline on stars is required
- Orb cores reach between 1.0:1 and 1.4:1 against grass and stand out by hue alone, so orbs need the Ink outline as well
- Ink outlines reach 5.8:1 against grass and 8.4:1 against paths
- Each orb carries a distinct symbol or shape alongside its color
