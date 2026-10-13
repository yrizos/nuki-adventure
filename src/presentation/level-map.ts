import type { LevelView } from '../application/level-view';
import { Picture } from './picture';
import { heroArt } from './sprite-library';
import { WorldPainter } from './world-painter';
import { tileSize } from './world-geometry';

export const mapTileSize = 4;
const mapScale = tileSize / mapTileSize;
// The camera keeps two tiles above the map for the heads-up display, so a picture that tall shows the whole map
// below that band.
const band = 2 * tileSize;

// Each block of the painted world becomes one map pixel in its most common color, so paths, water, trees and the
// door keep their real colors and the layout of the whole level reads at a glance. The stars land on different
// spots every time a level is built, so the map leaves them out and shows only what stays put.
export function levelMap(view: LevelView, colored: boolean, random: () => number): Picture {
  const level = { ...view, stars: [] };
  const { columns, rows } = view.scenery.size;
  const world = new Picture(columns * tileSize, rows * tileSize + band);
  const restored = colored ? view.keys.map((key) => key.restores) : [];
  // An arrival that has not begun yet draws no hero, no shadow and no motes. The card draws Nuki at full size
  // instead, because at map size she would shrink to a speck.
  new WorldPainter(level, random).paint(world, { level, frame: 0, hero: heroArt.down.stand, arrival: -1 }, restored);
  const map = new Picture(columns * mapTileSize, rows * mapTileSize);
  const counts = new Map<number, number>();
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      counts.clear();
      let common = 0;
      let most = 0;
      for (let down = 0; down < mapScale; down++)
        for (let across = 0; across < mapScale; across++) {
          const color = world.packedPixels[(band + y * mapScale + down) * world.width + x * mapScale + across]!;
          const seen = (counts.get(color) ?? 0) + 1;
          counts.set(color, seen);
          if (seen > most) [common, most] = [color, seen];
        }
      map.packedPixels[y * map.width + x] = common;
    }
  return map;
}
