import { isAxiosError } from 'axios';

/**
 * Admin "Edit all products" (bulk edit) state. Each field is changed only when
 * the admin marks it; everything else keeps every product's own value. Names,
 * web addresses, images and sizes are never part of a bulk edit.
 */

export const BULK_TEXT_FIELDS = [
  'descriptionHe',
  'descriptionEn',
  'fabricHe',
  'fabricEn',
  'careHe',
  'careEn',
  'fitHe',
  'fitEn',
] as const;

export type BulkTextField = (typeof BULK_TEXT_FIELDS)[number];
export type BulkValueField = BulkTextField | 'basePrice' | 'categoryId';
export type BulkFlag = 'isActive' | 'backSoon' | 'isFeatured';
/** keep = leave each product as it is. */
export type FlagChoice = 'keep' | 'yes' | 'no';

export type BulkDraft = {
  values: Record<BulkValueField, string>;
  /** Fields the admin chose to change. */
  enabled: Partial<Record<BulkValueField, boolean>>;
  flags: Record<BulkFlag, FlagChoice>;
};

export const EMPTY_BULK_DRAFT: BulkDraft = {
  values: {
    descriptionHe: '',
    descriptionEn: '',
    fabricHe: '',
    fabricEn: '',
    careHe: '',
    careEn: '',
    fitHe: '',
    fitEn: '',
    basePrice: '',
    categoryId: '',
  },
  enabled: {},
  flags: { isActive: 'keep', backSoon: 'keep', isFeatured: 'keep' },
};

export type BulkChanges = Partial<Record<BulkTextField, string> & Record<BulkFlag, boolean>> & {
  basePrice?: number;
  categoryId?: string;
};

/** API `changes`: only the marked fields. An empty text clears it on every product. */
export function bulkChanges(d: BulkDraft): BulkChanges {
  const changes: BulkChanges = {};
  for (const field of BULK_TEXT_FIELDS) {
    if (d.enabled[field]) changes[field] = d.values[field].trim();
  }
  if (d.enabled.basePrice) changes.basePrice = parseFloat(d.values.basePrice);
  if (d.enabled.categoryId && d.values.categoryId) changes.categoryId = d.values.categoryId;
  for (const flag of Object.keys(d.flags) as BulkFlag[]) {
    if (d.flags[flag] !== 'keep') changes[flag] = d.flags[flag] === 'yes';
  }
  return changes;
}

export type BulkIssue = 'noProducts' | 'noChanges' | 'price' | 'category';

/** What stops the admin from applying (shown on the review step). */
export function bulkIssues(d: BulkDraft, selectedCount: number): BulkIssue[] {
  const issues: BulkIssue[] = [];
  if (selectedCount === 0) issues.push('noProducts');
  if (d.enabled.basePrice && !(parseFloat(d.values.basePrice) > 0)) issues.push('price');
  if (d.enabled.categoryId && !d.values.categoryId) issues.push('category');
  if (Object.keys(bulkChanges(d)).length === 0) issues.push('noChanges');
  return issues;
}

/** The categories whose products a bulk edit covers: the category and its subcategories. */
export function bulkScopeIds(category: { id: string; children?: { id: string }[] }): string[] {
  return [category.id, ...(category.children ?? []).map((c) => c.id)];
}

export type RejectedProducts = { code: string; productIds: string[] };

/** Products the API refused (e.g. no active sizes to show, a sale price above the new price). */
export function rejectedProducts(err: unknown): RejectedProducts[] {
  if (!isAxiosError(err)) return [];
  const errors: { code: string; productIds?: string[] }[] = err.response?.data?.errors ?? [];
  return errors.filter((e) => e.productIds?.length).map((e) => ({ code: e.code, productIds: e.productIds! }));
}
