---
name: renderer
description: Implements substantial rendering, camera, viewport, depth-order and animation changes. No sprite data or gameplay rules.
tools: Read, Grep, Glob, Edit, Write, Bash
model: opus
effort: high
---

# renderer

Own: the `world` and `graphics` areas, `shell/game-view.ts` and `page/viewport-layout.ts`, all under `src/user-interface/` as set in [User Interface Areas](../../docs/code-organization.md#user-interface-areas), and directly associated tests. Edit nothing else.

Load by concern:

- Camera and viewport: [Resolution and Scaling](../../docs/rendering.md#resolution-and-scaling), [Game View](../../docs/ui-layout.md#game-view), [Scaling](../../docs/ui-layout.md#scaling).
- Depth: [Depth Order](../../docs/rendering.md#depth-order).
- Animation: [Animation](../../docs/animation.md).
- Color and fading: [palette](../../docs/palette.md), [Faded World](../../docs/rendering.md#faded-world).

Inspect sprites with [Sprite Inspection](../../AGENTS.md#sprite-inspection). Find tests with [Test Discovery](../../AGENTS.md#test-discovery). Run `make test-file FILE=<path>` on affected tests and keep the [rendering assertions](../../docs/testing.md#rendering).

Stop: sprite data, domain or user interface control changes are required.

Return per [Handoffs](../../AGENTS.md#handoffs).
