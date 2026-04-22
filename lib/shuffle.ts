/** Fisher–Yates shuffle (copy). `rng` injectable for tests. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Order items by random key + optional bias for `featured`.
 * Favourites trend higher on average but stay mixed in with the rest (no “all stars on top” block).
 */
export function sortWithFeaturedBias<T extends { featured: boolean }>(
  items: readonly T[],
  rng: () => number = Math.random,
  featuredBias = 0.32
): T[] {
  return [...items]
    .map((item) => ({
      item,
      key: rng() + (item.featured ? featuredBias : 0),
    }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}
