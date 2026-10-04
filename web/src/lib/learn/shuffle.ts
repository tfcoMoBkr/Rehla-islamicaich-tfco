function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/**
 * A shuffle that is the same on the server and in the browser (so hydration matches) and
 * never returns the items in their original, already-solved order.
 */
export function stableShuffle<T extends { id: string }>(items: readonly T[], seed: string): T[] {
  const shuffled = [...items].sort((a, b) => hash(seed + a.id) - hash(seed + b.id));
  const unchanged = shuffled.every((item, index) => item.id === items[index]?.id);
  return unchanged && shuffled.length > 1 ? [...shuffled.slice(1), ...shuffled.slice(0, 1)] : shuffled;
}
