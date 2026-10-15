/**
 * Built-in size sets. These are seeded into the `size_sets` table, which is the
 * source of truth at runtime — new size systems can be added as rows without
 * code changes. Products reference a set via `sizeSetId`; `null` means the
 * admin enters custom (free-text) sizes.
 */
export type SizeSetDefinition = {
  key: string;
  nameHe: string;
  nameEn: string;
  sizes: string[];
  sortOrder: number;
};

export const ADULT_LETTER_SIZE_SET: SizeSetDefinition = {
  key: 'adult-letter',
  nameHe: 'מבוגרים (XS–XXL)',
  nameEn: 'Adult (XS–XXL)',
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  sortOrder: 1,
};

export const KIDS_AGE_SIZE_SET: SizeSetDefinition = {
  key: 'kids-age',
  nameHe: 'ילדים (גילאי 2–14)',
  nameEn: 'Kids (ages 2–14)',
  sizes: ['2Y', '4Y', '6Y', '8Y', '10Y', '12Y', '14Y'],
  sortOrder: 2,
};

export const DEFAULT_SIZE_SETS: SizeSetDefinition[] = [ADULT_LETTER_SIZE_SET, KIDS_AGE_SIZE_SET];

/** Default size set for each top-level category slug (children inherit). */
export const TOP_LEVEL_CATEGORY_SIZE_SET: Record<string, string> = {
  men: ADULT_LETTER_SIZE_SET.key,
  women: ADULT_LETTER_SIZE_SET.key,
  children: KIDS_AGE_SIZE_SET.key,
};

/**
 * Orders sizes according to a size set; sizes not in the set keep their
 * relative order after the known ones (numeric-aware natural ordering).
 */
export function compareSizes(a: string, b: string, order: string[] = []): number {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Picks the first size set that contains every given size, or null. */
export function matchSizeSet<T extends { sizes: string[] }>(
  sizes: string[],
  sets: T[],
): T | null {
  if (sizes.length === 0) return null;
  return sets.find((set) => sizes.every((s) => set.sizes.includes(s))) ?? null;
}
