import { describe, expect, it } from 'vitest';
import { isAxiosError } from 'axios';
import {
  ALL_SELECTED,
  EMPTY_BULK_DRAFT,
  NONE_SELECTED,
  bulkChanges,
  bulkIssues,
  excludeFromSelection,
  isSelected,
  rejectedProducts,
  selectedCount,
  toggleSelected,
  type BulkDraft,
  type BulkField,
} from './bulk-edit';

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

  describe('selection (scales to thousands: a rule, not a list)', () => {
    it('starts with everything selected and counts against the total', () => {
      expect(selectedCount(ALL_SELECTED, 10_000)).toBe(10_000);
      expect(isSelected(ALL_SELECTED, 'any')).toBe(true);
    });

    it('unticking from "all" keeps a short exclude list; ticking from "none" a short include list', () => {
      const allButOne = toggleSelected(ALL_SELECTED, 'p1');
      expect(allButOne).toEqual({ all: true, ids: ['p1'] });
      expect(selectedCount(allButOne, 10_000)).toBe(9_999);
      expect(isSelected(allButOne, 'p1')).toBe(false);
      expect(toggleSelected(allButOne, 'p1')).toEqual(ALL_SELECTED);

      const two = toggleSelected(toggleSelected(NONE_SELECTED, 'a'), 'b');
      expect(two).toEqual({ all: false, ids: ['a', 'b'] });
      expect(selectedCount(two, 10_000)).toBe(2);
    });

    it('drops refused products from either kind of selection', () => {
      expect(excludeFromSelection({ all: true, ids: ['x'] }, ['y', 'x'])).toEqual({ all: true, ids: ['x', 'y'] });
      expect(excludeFromSelection({ all: false, ids: ['a', 'b'] }, ['b'])).toEqual({ all: false, ids: ['a'] });
    });
  });
});
