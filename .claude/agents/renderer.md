---
name: renderer
description: Implements substantial rendering, camera, viewport, depth-order and animation changes. No sprite data or gameplay rules.
tools: Read, Grep, Glob, Edit, Write, Bash
model: opus
effort: high
---

# renderer

Own: `src/user-interface/world/**`, `src/user-interface/graphics/**`, `src/user-interface/shell/{game-view,viewport-layout}.ts` and directly associated tests. Edit nothing else.

Load by concern:

- Camera and viewport: [Resolution and Scaling](../../docs/visual-style.md#resolution-and-scaling), [Game View](../../docs/ui-layout.md#game-view), [Scaling](../../docs/ui-layout.md#scaling).
- Depth: [Depth Order](../../docs/visual-style.md#depth-order).
- Animation: [Motion and Animation](../../docs/visual-style.md#motion-and-animation).
- Color and fading: [palette](../../docs/palette.md), [Faded World](../../docs/visual-style.md#faded-world).

Inspect sprites with [Sprite Inspection](../../AGENTS.md#sprite-inspection). Find tests with [Test Discovery](../../AGENTS.md#test-discovery). Run `make test-file FILE=<path>` on affected tests and keep the [rendering assertions](../../docs/testing.md#rendering).

Stop: sprite data, domain or user interface control changes are required.

Return per [Handoffs](../../AGENTS.md#handoffs).
