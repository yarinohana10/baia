import type { CardProduct } from './types';

type V = CardProduct['variants'][number];

export function isSaleActive(v: V, now = new Date()): boolean {
  if (!v.salePrice) return false;
  if (v.saleStart && now < new Date(v.saleStart)) return false;
  if (v.saleEnd && now > new Date(v.saleEnd)) return false;
  return true;
}

/** Lowest active sale price across variants, or null. */
export function activeSalePrice(variants: V[], now = new Date()): number | null {
  let best: number | null = null;
  for (const v of variants) {
    if (!isSaleActive(v, now)) continue;
    const price = parseFloat(v.salePrice!);
    if (best === null || price < best) best = price;
  }
  return best;
}

/** Per-line cart maximum enforced by the API (MAX_LINE_QUANTITY). */
export const MAX_LINE_QUANTITY = 99;

type StockLike = { stockQuantity?: number; trackInventory?: boolean };

/** Untracked variants (trackInventory: false) have unlimited stock. */
export function isUnlimited(v: StockLike): boolean {
  return v.trackInventory === false;
}

/** Units a shopper can add to one cart line (unlimited stock is capped at MAX_LINE_QUANTITY). */
export function availableQty(v: StockLike): number {
  if (isUnlimited(v)) return MAX_LINE_QUANTITY;
  return Math.min(MAX_LINE_QUANTITY, Math.max(0, v.stockQuantity ?? 0));
}

export function isInStock(v: StockLike): boolean {
  return isUnlimited(v) || (v.stockQuantity ?? 0) > 0;
}

/** Total units in stock; Infinity when any variant has unlimited stock. */
export function totalStock(variants: StockLike[]): number {
  return variants.reduce(
    (sum, v) => sum + (isUnlimited(v) ? Number.POSITIVE_INFINITY : Math.max(0, v.stockQuantity ?? 0)),
    0,
  );
}

export const LOW_STOCK_THRESHOLD = 5;

/** Remaining units to show in an "only N left" hint, or null (never for unlimited stock). */
export function lowStockCount(v: StockLike): number | null {
  if (isUnlimited(v)) return null;
  const qty = v.stockQuantity ?? 0;
  return qty > 0 && qty <= LOW_STOCK_THRESHOLD ? qty : null;
}
export const NEW_PRODUCT_DAYS = 30;

export function isNewProduct(createdAt: string | undefined, now = new Date()): boolean {
  if (!createdAt) return false;
  const age = now.getTime() - new Date(createdAt).getTime();
  return age >= 0 && age < NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000;
}

export function uniqueColors(variants: V[]): string[] {
  return [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))];
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/** Distinct sizes that still have stock, in a natural order. */
export function sizesInStock(variants: V[]): string[] {
  const sizes = [...new Set(variants.filter(isInStock).map((v) => v.size).filter((s): s is string => !!s))];
  return sizes.sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, undefined, { numeric: true });
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Best-effort CSS colour for a variant colour name (admin enters free text). */
const SWATCHES: Record<string, string> = {
  black: '#1C1C1C', white: '#FFFFFF', cream: '#F3E9D2', ivory: '#F6F0E1', beige: '#D9C6A5', taupe: '#8B7D6B',
  brown: '#6B4A33', tan: '#C49A6C', red: '#B83A2E', wine: '#6E1E2B', burgundy: '#7A2232', pink: '#E8A2B4',
  coral: '#E56B5A', orange: '#E07B2E', yellow: '#E8C33F', gold: '#C9A23E', green: '#3F6E4E', olive: '#6B6B3A',
  mint: '#A7D8C3', teal: '#1E7F7A', turquoise: '#3BB5B0', blue: '#2B5C9E', navy: '#1D2C4C', 'light blue': '#9CC7E4',
  sky: '#8EC5E8', purple: '#6A4A8C', lilac: '#BFA6D6', grey: '#8A8F93', gray: '#8A8F93', charcoal: '#3A3F44',
  silver: '#C0C4C8',
  'שחור': '#1C1C1C', 'לבן': '#FFFFFF', 'אדום': '#B83A2E', 'כחול': '#2B5C9E', 'ירוק': '#3F6E4E', 'צהוב': '#E8C33F',
  'ורוד': '#E8A2B4', 'כתום': '#E07B2E', 'חום': '#6B4A33', 'אפור': '#8A8F93', 'בז׳': '#D9C6A5', 'סגול': '#6A4A8C',
};

export function swatchColor(name: string): string | null {
  return SWATCHES[name.trim().toLowerCase()] ?? null;
}

export function formatPrice(value: number): string {
  return `₪${Number.isInteger(value) ? value : value.toFixed(2).replace(/\.00$/, '')}`;
}
