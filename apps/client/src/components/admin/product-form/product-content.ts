/** Product-page content (fabric / care / fit), per language. Max lengths match the API DTO. */
export type ProductContent = {
  fabricHe: string;
  fabricEn: string;
  careHe: string;
  careEn: string;
  fitHe: string;
  fitEn: string;
};

export const CONTENT_FIELDS = ['fabric', 'care', 'fit'] as const;
export const CONTENT_MAX: Record<(typeof CONTENT_FIELDS)[number], number> = { fabric: 1000, care: 2000, fit: 1000 };

export const emptyContent = (p?: Partial<Record<keyof ProductContent, string | null>>): ProductContent => ({
  fabricHe: p?.fabricHe ?? '',
  fabricEn: p?.fabricEn ?? '',
  careHe: p?.careHe ?? '',
  careEn: p?.careEn ?? '',
  fitHe: p?.fitHe ?? '',
  fitEn: p?.fitEn ?? '',
});

/** API payload: trimmed, empty -> null. */
export function contentPayload(c: ProductContent): Record<keyof ProductContent, string | null> {
  return Object.fromEntries(
    Object.entries(c).map(([k, v]) => [k, v.trim() || null]),
  ) as Record<keyof ProductContent, string | null>;
}
