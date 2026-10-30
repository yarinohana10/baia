import { describe, expect, it } from 'vitest';
import type { Coupon } from '@/components/admin/coupons/types';
import type { Category } from '@/components/admin/categories/types';
import { CLOSED_COUPON_EDITOR, couponEditorReducer, couponPayload, EMPTY_COUPON_DRAFT } from './coupon-editor';
import { CLOSED_CATEGORY_EDITOR, categoryEditorReducer, categoryPayload } from './category-editor';

const coupon: Coupon = {
  id: 'c1',
  code: 'SUMMER25',
  discountType: 'PERCENTAGE',
  value: '25.00',
  minCartValue: '100.50',
  maxUses: 10,
  currentUses: 2,
  isActive: true,
  // 21:59 UTC on the 31st is already Aug 1st in Israel.
  expiresAt: '2026-07-31T21:59:59.000Z',
  _count: { orders: 2 },
};

describe('couponEditorReducer', () => {
  it('opens an empty form to create', () => {
    expect(couponEditorReducer(CLOSED_COUPON_EDITOR, { type: 'create' })).toEqual({
      open: true,
      editing: null,
      draft: EMPTY_COUPON_DRAFT,
    });
  });

  it('fills the form from the coupon being edited (expiry as the Israel day)', () => {
    const state = couponEditorReducer(CLOSED_COUPON_EDITOR, { type: 'edit', coupon });
    expect(state.editing).toBe(coupon);
    expect(state.draft).toEqual({
      code: 'SUMMER25',
      discountType: 'PERCENTAGE',
      value: '25',
      minCartValue: '100.5',
      maxUses: '10',
      expiresAt: '2026-08-01',
    });
  });

  it('merges field changes and closes back to a blank form', () => {
    const open = couponEditorReducer(CLOSED_COUPON_EDITOR, { type: 'create' });
    const changed = couponEditorReducer(open, { type: 'change', changes: { code: 'X' } });
    expect(changed.draft.code).toBe('X');
    expect(couponEditorReducer(changed, { type: 'close' })).toBe(CLOSED_COUPON_EDITOR);
  });

  it('sends cleared optional fields as null', () => {
    expect(couponPayload({ ...EMPTY_COUPON_DRAFT, code: ' A1 ', value: '10' })).toEqual({
      code: 'A1',
      discountType: 'PERCENTAGE',
      value: 10,
      minCartValue: null,
      maxUses: null,
      expiresAt: null,
    });
  });
});

const category: Category = {
  id: 'cat1',
  nameHe: 'בגדי ים',
  nameEn: 'Swimwear',
  slug: 'swimwear',
  sortOrder: 2,
  parentId: null,
  sizeSetId: null,
  image: 'https://cdn/x.jpg',
  children: [],
};

describe('categoryEditorReducer', () => {
  it('edits a category and forgets its image once removed', () => {
    const editing = categoryEditorReducer(CLOSED_CATEGORY_EDITOR, { type: 'edit', category });
    expect(editing.draft).toEqual({ nameHe: 'בגדי ים', nameEn: 'Swimwear', slug: 'swimwear', parentId: '', sizeSetId: '', sizeGuideId: '', sortOrder: 2 });
    expect(categoryEditorReducer(editing, { type: 'imageRemoved' }).editing?.image).toBeNull();
  });

  it('closes the form only when the edited category is deleted', () => {
    const editing = categoryEditorReducer(CLOSED_CATEGORY_EDITOR, { type: 'edit', category });
    expect(categoryEditorReducer(editing, { type: 'deleted', id: 'other' })).toBe(editing);
    expect(categoryEditorReducer(editing, { type: 'deleted', id: 'cat1' })).toMatchObject({ open: false, editing: null });
  });

  it('sends empty parent and size set as null', () => {
    const draft = categoryEditorReducer(CLOSED_CATEGORY_EDITOR, { type: 'edit', category }).draft;
    expect(categoryPayload(draft)).toMatchObject({ parentId: null, sizeSetId: null });
  });
});
