/** Product variants (one per color + size) as edited in the stock editor, and pure helpers over them. */

export type Variant = {
  id?: string;
  tempId?: string;
  color: string;
  size: string;
  sku: string;
  /** SKU is generated from slug/color/size until the admin edits it. */
  autoSku?: boolean;
  stockQuantity: number;
  /** Quantity the server had when this form loaded (or last saved); sent so the API applies the edit as a difference. */
  loadedStock?: number;
  /** false = unlimited stock. */
  trackInventory?: boolean;
  priceOverride: number | string | null;
  salePrice: number | string | null;
  saleStart: string | null;
  saleEnd: string | null;
  isActive: boolean;
};

export type SizeSet = { id: string; key: string; nameHe: string; nameEn: string; sizes: string[] };

/** A color section of the stock editor. */
export type ColorBlock = { key: string; name: string };

export const LOW_STOCK_THRESHOLD = 5;

/** Remembers a saved variant's stock as loaded, so a later save can't overwrite sales made since. */
export const withLoadedStock = (v: Variant): Variant => (v.id ? { ...v, loadedStock: v.stockQuantity } : v);

export const isUnlimited = (v: Variant) => v.trackInventory === false;
export const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** Stable identity of a variant row: its id once saved, a temp id before. */
export const variantKey = (v: Variant) => v.id ?? v.tempId!;

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Short stable code for names that don't slugify (e.g. Hebrew colors). */
function shortHash(text: string) {
  let h = 5381;
  for (const ch of text) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  return h.toString(36).slice(0, 4);
}

export function autoSku(prefix: string, color: string, size: string) {
  const c = slugify(color) || shortHash(color.trim().toLowerCase());
  const s = slugify(size) || shortHash(size.trim().toLowerCase());
  return [slugify(prefix) || 'sku', c, s].join('-');
}

/** Payload-ready stats for the summary line and validation. */
export function stockSummary(variants: Variant[]) {
  const summary = { sizes: 0, units: 0, unlimited: 0, zero: 0 };
  for (const v of variants) {
    if (!v.isActive) continue;
    summary.sizes += 1;
    if (isUnlimited(v)) {
      summary.unlimited += 1;
    } else {
      summary.units += v.stockQuantity || 0;
      if (v.stockQuantity === 0) summary.zero += 1;
    }
  }
  return summary;
}

/**
 * One block per distinct color (or a single empty one). Keys are deterministic:
 * the form is server-rendered, so random ids would mismatch on hydration.
 */
export function initialColorBlocks(variants: Variant[]): ColorBlock[] {
  const names: string[] = [];
  for (const v of variants) if (!names.some((n) => sameColor(n, v.color))) names.push(v.color);
  return (names.length ? names : ['']).map((name, i) => ({ key: `c${i}`, name }));
}

export const variantsOfColor = (variants: Variant[], color: string) => variants.filter((v) => sameColor(v.color, color));

export const activeVariantsOfColor = (variants: Variant[], color: string) =>
  variants.filter((v) => v.isActive && sameColor(v.color, color));

export const findVariant = (variants: Variant[], color: string, size: string) =>
  variants.find((v) => sameColor(v.color, color) && v.size === size);

/** The size set's sizes, then any other sizes this color already has. */
export function sizesForColor(variants: Variant[], color: string, setSizes: string[]): string[] {
  const sizes = [...setSizes];
  const seen = new Set(setSizes);
  for (const v of variants) {
    if (!sameColor(v.color, color) || seen.has(v.size)) continue;
    seen.add(v.size);
    sizes.push(v.size);
  }
  return sizes;
}

export function newVariant(skuPrefix: string, color: string, size: string): Variant {
  return {
    tempId: crypto.randomUUID(),
    color,
    size,
    sku: autoSku(skuPrefix, color, size),
    autoSku: true,
    stockQuantity: 0,
    trackInventory: true,
    priceOverride: null,
    salePrice: null,
    saleStart: null,
    saleEnd: null,
    isActive: true,
  };
}

/** Ticks a size on (creating it) or off (new rows are dropped, saved rows deactivated). */
export function setSizeAvailable(
  variants: Variant[],
  color: string,
  size: string,
  available: boolean,
  skuPrefix: string,
): Variant[] {
  const existing = findVariant(variants, color, size);
  if (available) {
    if (existing) return variants.map((v) => (v === existing ? { ...v, isActive: true } : v));
    return [...variants, newVariant(skuPrefix, color.trim(), size)];
  }
  if (!existing) return variants;
  if (existing.id) return variants.map((v) => (v === existing ? { ...v, isActive: false } : v));
  return variants.filter((v) => v !== existing);
}

/** Applies `changes` to the active variants of a color. */
export function patchActiveOfColor(variants: Variant[], color: string, changes: Partial<Variant>): Variant[] {
  const targets = new Set(activeVariantsOfColor(variants, color).map(variantKey));
  return variants.map((v) => (targets.has(variantKey(v)) ? { ...v, ...changes } : v));
}

/**
 * Renames a color. Saved rows of an unnamed block keep their (empty) color so
 * they aren't silently merged; generated SKUs follow the new name.
 */
export function renameColor(variants: Variant[], from: string, to: string, skuPrefix: string): Variant[] {
  return variants.map((v) =>
    sameColor(v.color, from) && (from.trim() !== '' || !v.id)
      ? { ...v, color: to, ...(v.autoSku ? { sku: autoSku(skuPrefix, to, v.size) } : {}) }
      : v,
  );
}

/** Removes a color: unsaved rows are dropped, saved ones deactivated. */
export function removeColor(variants: Variant[], color: string): Variant[] {
  const next: Variant[] = [];
  for (const v of variants) {
    if (!sameColor(v.color, color)) next.push(v);
    else if (v.id) next.push({ ...v, isActive: false });
  }
  return next;
}

/** Regenerates auto SKUs for a new prefix; returns null when nothing changes. */
export function resyncAutoSkus(variants: Variant[], skuPrefix: string): Variant[] | null {
  let changed = false;
  const next = variants.map((v) => {
    if (!v.autoSku) return v;
    const sku = autoSku(skuPrefix, v.color, v.size);
    if (sku === v.sku) return v;
    changed = true;
    return { ...v, sku };
  });
  return changed ? next : null;
}

/** Distinct trimmed colors of the active variants (offered as image color tags). */
export function activeColors(variants: Variant[]): string[] {
  const colors = new Set<string>();
  for (const v of variants) {
    const color = v.color.trim();
    if (v.isActive && color) colors.add(color);
  }
  return [...colors];
}

export type StockLevel = 'off' | 'unlimited' | 'soldOut' | 'low' | 'ok';

/** How a size's stock reads in the editor ('off' = not available in this color). */
export function stockLevel(v: Variant | undefined): StockLevel {
  if (!v?.isActive) return 'off';
  if (isUnlimited(v)) return 'unlimited';
  if (v.stockQuantity === 0) return 'soldOut';
  return v.stockQuantity <= LOW_STOCK_THRESHOLD ? 'low' : 'ok';
}
