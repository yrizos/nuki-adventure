import { Area, type LevelView } from '../../level';
import { Picture } from '../graphics/picture';
import { heroArt } from '../graphics/sprite-library';
import { WorldPainter } from '../world/painting/world-painter';
import { tileSize } from '../world/world-geometry';

// The map fills the window of a level picker card, two of which share a row.
export const mapSize = 60;
// The camera keeps two tiles above the map for the heads-up display, so a picture that tall shows the whole map
// below that band.
const band = 2 * tileSize;

// The longer side of the level fills the map, so a tile may cover a fraction of a pixel. Each block of the painted
// world becomes one map pixel in its most common color, so paths, water, trees and the
// door keep their real colors and the layout of the whole level reads at a glance. Orbs land on different
// spots every time a level is built, so the map leaves them out and shows only what stays put.
export function levelMap(view: LevelView, colored: boolean, random: () => number): Picture {
  const level = { ...view, orbs: [] };
  const { columns, rows } = view.scenery.size;
  const world = new Picture(columns * tileSize, rows * tileSize + band);
  const restored = colored ? [Area.whole(view.scenery.size)] : [];
  // An arrival that has not begun yet draws no hero, no shadow and no motes. The card draws its own small Nuki
  // instead, because at map size she would shrink to a speck.
  new WorldPainter(level, random).paint(world, { level, frame: 0, hero: heroArt.down.stand, arrival: -1 }, restored);
  const longest = Math.max(columns, rows);
  const map = new Picture(Math.round((columns * mapSize) / longest), Math.round((rows * mapSize) / longest));
  const scale = (longest * tileSize) / mapSize;
  const counts = new Map<number, number>();
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      counts.clear();
      let common = 0;
      let most = 0;
      for (let down = Math.floor(y * scale); down < Math.floor((y + 1) * scale); down++)
        for (let across = Math.floor(x * scale); across < Math.floor((x + 1) * scale); across++) {
          const color = world.packedPixels[(band + down) * world.width + across]!;
          const seen = (counts.get(color) ?? 0) + 1;
          counts.set(color, seen);
          if (seen > most) [common, most] = [color, seen];
        }
      map.packedPixels[y * map.width + x] = common;
    }
  return map;
}
