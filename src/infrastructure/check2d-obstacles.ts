import { type Body, type Response, System } from 'check2d';
import type { Obstacles, Outline, PlaceObstacles } from '../domain/level/obstacles';
import { WorldPosition } from '../domain/level/position';

const attempts = 4;
const touching = 1e-6;

function body(system: System, outline: Outline, isStatic: boolean): Body {
  const { center, width, height } = outline;
  return outline.form === 'oval'
    ? system.createEllipse(center, width / 2, height / 2, undefined, { isStatic })
    : system.createBox(center, width, height, { isStatic, isCentered: true });
}

export const check2dObstacles: PlaceObstacles = (outlines): Obstacles => {
  const system = new System();
  for (const outline of outlines) body(system, outline, true);
  return {
    // check2d's own separation adds every overlap at once, so two obstacles pushing opposite ways cancel out and let her
    // squeeze through. Pushing out of one overlap at a time, and staying put when she cannot settle, keeps her outside.
    walk(feet, to) {
      const walker = body(system, feet.at(to), false);
      try {
        for (let attempt = 0; attempt < attempts; attempt++) {
          const pushed = system.checkOne(walker, ({ overlap, overlapV }: Response) => {
            if (overlap < touching) return false;
            walker.setPosition(walker.x - overlapV.x, walker.y - overlapV.y);
            return true;
          });
          if (!pushed) return WorldPosition.at(walker.x, walker.y);
        }
        return feet.center;
      } finally {
        system.remove(walker);
      }
    },
  };
};
