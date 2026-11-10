import { describe, expect, it } from 'vitest';
import { isAxiosError } from 'axios';
import {
  EMPTY_BULK_DRAFT,
  bulkChanges,
  bulkIssues,
  bulkScopeIds,
  rejectedProducts,
  type BulkDraft,
} from './bulk-edit';

const draft = (changes: Partial<BulkDraft['values']>, enabled: (keyof BulkDraft['values'])[] = [], flags: Partial<BulkDraft['flags']> = {}): BulkDraft => ({
  values: { ...EMPTY_BULK_DRAFT.values, ...changes },
  enabled: Object.fromEntries(enabled.map((k) => [k, true])),
  flags: { ...EMPTY_BULK_DRAFT.flags, ...flags },
});

describe('bulk product edit', () => {
  it('sends only the fields marked to change (text trimmed, empty clears)', () => {
    const d = draft({ descriptionHe: '  תיאור ', careEn: '', fabricEn: 'ignored', basePrice: '249.9' }, ['descriptionHe', 'careEn', 'basePrice']);
    expect(bulkChanges(d)).toEqual({ descriptionHe: 'תיאור', careEn: '', basePrice: 249.9 });
  });

  it('turns the three-way switches into true / false, leaving "keep" out', () => {
    const d = draft({}, [], { isActive: 'yes', backSoon: 'no', isFeatured: 'keep' });
    expect(bulkChanges(d)).toEqual({ isActive: true, backSoon: false });
  });

  it('includes the category only when one is picked to move to', () => {
    expect(bulkChanges(draft({ categoryId: 'c2' }, ['categoryId']))).toEqual({ categoryId: 'c2' });
    expect(bulkChanges(draft({ categoryId: '' }, ['categoryId']))).toEqual({});
  });

  it('reports what blocks applying', () => {
    expect(bulkIssues(draft({}), 0).sort()).toEqual(['noChanges', 'noProducts']);
    expect(bulkIssues(draft({ basePrice: '0' }, ['basePrice']), 2)).toEqual(['price']);
    expect(bulkIssues(draft({ categoryId: '' }, ['categoryId']), 2)).toEqual(['category', 'noChanges']);
    expect(bulkIssues(draft({ fitEn: '' }, ['fitEn']), 2)).toEqual([]);
  });

  it('covers a category and its subcategories', () => {
    expect(bulkScopeIds({ id: 'men', children: [{ id: 'shorts' }, { id: 'boards' }] })).toEqual(['men', 'shorts', 'boards']);
    expect(bulkScopeIds({ id: 'shorts', children: [] })).toEqual(['shorts']);
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
