import { isAxiosError } from 'axios';

/**
 * Admin "Edit all products" (bulk edit) of one subcategory. Each field is
 * changed only when the admin ticks it; everything else keeps every product's
 * own value. Names, web addresses, images, sizes and the category are never
 * part of a bulk edit.
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
export type BulkValueField = BulkTextField | 'basePrice';
export type BulkFlag = 'isActive' | 'backSoon' | 'isFeatured';
/** Anything the admin can tick to change. */
export type BulkField = BulkValueField | BulkFlag;

export type BulkDraft = {
  values: Record<BulkValueField, string>;
  /** Yes / no settings (applied only when ticked). */
  flags: Record<BulkFlag, boolean>;
  /** Fields the admin chose to change. */
  enabled: Partial<Record<BulkField, boolean>>;
};

export const BULK_FLAGS: BulkFlag[] = ['isActive', 'backSoon', 'isFeatured'];

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
  },
  flags: { isActive: true, backSoon: false, isFeatured: false },
  enabled: {},
};

export type BulkChanges = Partial<Record<BulkTextField, string> & Record<BulkFlag, boolean>> & { basePrice?: number };

/** API `changes`: only the ticked fields. An empty text clears it on every product. */
export function bulkChanges(d: BulkDraft): BulkChanges {
  const changes: BulkChanges = {};
  for (const field of BULK_TEXT_FIELDS) {
    if (d.enabled[field]) changes[field] = d.values[field].trim();
  }
  if (d.enabled.basePrice) changes.basePrice = parseFloat(d.values.basePrice);
  for (const flag of BULK_FLAGS) {
    if (d.enabled[flag]) changes[flag] = d.flags[flag];
  }
  return changes;
}

export type BulkIssue = 'noProducts' | 'noChanges' | 'price';

/** What stops the admin from applying (shown on the review step). */
export function bulkIssues(d: BulkDraft, selectedCount: number): BulkIssue[] {
  const issues: BulkIssue[] = [];
  if (selectedCount === 0) issues.push('noProducts');
  if (d.enabled.basePrice && !(parseFloat(d.values.basePrice) > 0)) issues.push('price');
  if (Object.keys(bulkChanges(d)).length === 0) issues.push('noChanges');
  return issues;
}

export type RejectedProducts = { code: string; productIds: string[] };

/** Products the API refused (e.g. no active sizes to show, a sale price above the new price). */
export function rejectedProducts(err: unknown): RejectedProducts[] {
  if (!isAxiosError(err)) return [];
  const errors: { code: string; productIds?: string[] }[] = err.response?.data?.errors ?? [];
  return errors.filter((e) => e.productIds?.length).map((e) => ({ code: e.code, productIds: e.productIds! }));
}
