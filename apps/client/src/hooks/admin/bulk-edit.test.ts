import { describe, expect, it } from 'vitest';
import { isAxiosError } from 'axios';
import { EMPTY_BULK_DRAFT, bulkChanges, bulkIssues, rejectedProducts, type BulkDraft, type BulkField } from './bulk-edit';

const draft = (
  values: Partial<BulkDraft['values']>,
  enabled: BulkField[] = [],
  flags: Partial<BulkDraft['flags']> = {},
): BulkDraft => ({
  values: { ...EMPTY_BULK_DRAFT.values, ...values },
  flags: { ...EMPTY_BULK_DRAFT.flags, ...flags },
  enabled: Object.fromEntries(enabled.map((k) => [k, true])),
});

describe('bulk product edit', () => {
  it('sends only the fields marked to change (text trimmed, empty clears)', () => {
    const d = draft({ descriptionHe: '  תיאור ', careEn: '', fabricEn: 'ignored', basePrice: '249.9' }, ['descriptionHe', 'careEn', 'basePrice']);
    expect(bulkChanges(d)).toEqual({ descriptionHe: 'תיאור', careEn: '', basePrice: 249.9 });
  });

  it('sends a yes/no setting only when it is ticked', () => {
    const d = draft({}, ['isActive', 'backSoon'], { isActive: true, backSoon: false, isFeatured: true });
    expect(bulkChanges(d)).toEqual({ isActive: true, backSoon: false });
  });

  it('never sends the category (products stay in the subcategory being edited)', () => {
    expect(Object.keys(bulkChanges(draft({ descriptionEn: 'x' }, ['descriptionEn'])))).toEqual(['descriptionEn']);
    expect(EMPTY_BULK_DRAFT.values).not.toHaveProperty('categoryId');
  });

  it('reports what blocks applying', () => {
    expect(bulkIssues(draft({}), 0).sort()).toEqual(['noChanges', 'noProducts']);
    expect(bulkIssues(draft({ basePrice: '0' }, ['basePrice']), 2)).toEqual(['price']);
    expect(bulkIssues(draft({ fitEn: '' }, ['fitEn']), 2)).toEqual([]);
    expect(bulkIssues(draft({}, ['isFeatured']), 2)).toEqual([]);
  });

  it('reads which products the server refused and why', () => {
    const err = Object.assign(new Error('x'), {
      isAxiosError: true,
      response: { status: 400, data: { errors: [{ field: 'changes.isActive', code: 'noActiveSizes', productIds: ['p2'] }, { field: 'x', code: 'y' }] } },
    });
    expect(isAxiosError(err)).toBe(true);
    expect(rejectedProducts(err)).toEqual([{ code: 'noActiveSizes', productIds: ['p2'] }]);
    expect(rejectedProducts(new Error('network'))).toEqual([]);
  });
});
