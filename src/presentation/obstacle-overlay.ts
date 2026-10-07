import type { LevelView } from '../application/level-view';
import { feet } from '../domain/level/hero';
import { palette } from './palette';
import { cameraPosition } from './world-geometry';

// ponytail: development aid for tuning obstacle outlines, delete once they feel right in play.
export function drawObstacles(context: CanvasRenderingContext2D, level: LevelView): void {
  const camera = cameraPosition(level, context.canvas.width, context.canvas.height);
  context.save();
  context.lineWidth = 1;
  for (const [outline, color] of [
    ...level.outlines.map((outline) => [outline, palette.P2] as const),
    [feet.at(level.hero.feet), palette.Y2] as const,
  ]) {
    const { center, width, height } = outline;
    const x = center.x - camera.x;
    const y = center.y - camera.y;
    context.strokeStyle = color;
    context.beginPath();
    if (outline.form === 'box') context.rect(x - width / 2 + 0.5, y - height / 2 + 0.5, width - 1, height - 1);
    else context.ellipse(x, y, width / 2 - 0.5, height / 2 - 0.5, 0, 0, 2 * Math.PI);
    context.stroke();
  }
  context.restore();
}
