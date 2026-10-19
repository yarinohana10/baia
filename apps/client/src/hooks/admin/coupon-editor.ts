import { toStoreDay } from '@/lib/admin/format';
import type { Coupon, DiscountType } from '@/components/admin/coupons/types';

/** The coupon form's text fields, as typed. */
export type CouponDraft = {
  code: string;
  discountType: DiscountType;
  value: string;
  minCartValue: string;
  maxUses: string;
  /** `YYYY-MM-DD` (Israel calendar day) or ''. */
  expiresAt: string;
};

export type CouponEditor = {
  open: boolean;
  /** The coupon being edited; null while creating. */
  editing: Coupon | null;
  draft: CouponDraft;
};

export type CouponEditorAction =
  | { type: 'create' }
  | { type: 'edit'; coupon: Coupon }
  | { type: 'close' }
  | { type: 'change'; changes: Partial<CouponDraft> };

export const EMPTY_COUPON_DRAFT: CouponDraft = {
  code: '',
  discountType: 'PERCENTAGE',
  value: '',
  minCartValue: '',
  maxUses: '',
  expiresAt: '',
};

export const CLOSED_COUPON_EDITOR: CouponEditor = { open: false, editing: null, draft: EMPTY_COUPON_DRAFT };

export function couponToDraft(c: Coupon): CouponDraft {
  return {
    code: c.code,
    discountType: c.discountType,
    value: parseFloat(c.value).toString(),
    minCartValue: c.minCartValue ? parseFloat(c.minCartValue).toString() : '',
    maxUses: c.maxUses?.toString() || '',
    expiresAt: c.expiresAt ? toStoreDay(c.expiresAt) : '',
  };
}

/** API body; cleared optional fields are sent as null so they are removed on update. */
export function couponPayload(d: CouponDraft) {
  return {
    code: d.code.trim(),
    discountType: d.discountType,
    value: parseFloat(d.value),
    minCartValue: d.minCartValue.trim() ? parseFloat(d.minCartValue) : null,
    maxUses: d.maxUses.trim() ? parseInt(d.maxUses, 10) : null,
    // A calendar day: the API keeps the coupon valid until the end of it (Israel time).
    expiresAt: d.expiresAt || null,
  };
}

export function couponEditorReducer(state: CouponEditor, action: CouponEditorAction): CouponEditor {
  switch (action.type) {
    case 'create':
      return { open: true, editing: null, draft: EMPTY_COUPON_DRAFT };
    case 'edit':
      return { open: true, editing: action.coupon, draft: couponToDraft(action.coupon) };
    case 'close':
      return CLOSED_COUPON_EDITOR;
    case 'change':
      return { ...state, draft: { ...state.draft, ...action.changes } };
  }
}
