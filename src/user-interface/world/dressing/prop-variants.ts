import type { TilePosition } from '../../../level';

export function propVariants(footprints: readonly (readonly TilePosition[])[], count: number): readonly number[] {
  const choices = new Map<number, number>();
  const ordered = footprints
    .map((footprint, index) => ({ footprint, index }))
    .sort(
      (first, second) =>
        first.footprint[0]!.row - second.footprint[0]!.row || first.footprint[0]!.column - second.footprint[0]!.column,
    );
  for (const { footprint, index } of ordered) {
    const excluded = new Set<number>();
    for (const [neighbor, choice] of choices) {
      if (
        footprint.some((position) =>
          footprints[neighbor]!.some(
            (other) => Math.abs(position.column - other.column) + Math.abs(position.row - other.row) <= 1,
          ),
        )
      )
        excluded.add(choice);
    }
    const start = (footprint[0]!.column * 3 + footprint[0]!.row * 5) % count;
    const selected = Array.from({ length: count }, (_, offset) => (start + offset) % count).find(
      (choice) => !excluded.has(choice),
    );
    if (selected === undefined) throw new RangeError('Touching props need another art variant');
    choices.set(index, selected);
  }
  return footprints.map((_, index) => choices.get(index)!);
}
