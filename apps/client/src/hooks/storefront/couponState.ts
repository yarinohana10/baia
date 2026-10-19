import type { ErrorMessage } from '@/lib/shop-errors';

/** A validated coupon; the discount holds for the cart subtotal it was checked against. */
export type AppliedCoupon = { code: string; discount: number; subtotal: number };

export type CouponState = {
  input: string;
  applied: AppliedCoupon | null;
  error: ErrorMessage | null;
  checking: boolean;
};

export type CouponAction =
  /** Typing a code (upper-cased) drops the applied coupon and its error. */
  | { type: 'edit'; input: string }
  | { type: 'checking' }
  | { type: 'applied'; coupon: AppliedCoupon }
  | { type: 'rejected'; error: ErrorMessage }
  /** Clicking "apply" with an empty code. */
  | { type: 'cleared' }
  | { type: 'removed' };

export const initialCouponState: CouponState = { input: '', applied: null, error: null, checking: false };

export function couponReducer(state: CouponState, action: CouponAction): CouponState {
  switch (action.type) {
    case 'edit':
      return { ...state, input: action.input.toUpperCase(), applied: null, error: null };
    case 'checking':
      return { ...state, applied: null, error: null, checking: true };
    case 'applied':
      return { ...state, applied: action.coupon, error: null, checking: false };
    case 'rejected':
      return { ...state, applied: null, error: action.error, checking: false };
    case 'cleared':
      return { ...state, applied: null, error: null };
    case 'removed':
      return { ...state, input: '', applied: null, error: null };
  }
}

/** The discount needs re-checking: the cart changed since it was validated (and the order isn't placed yet). */
export function needsRevalidation(applied: AppliedCoupon | null, subtotal: number, locked: boolean): applied is AppliedCoupon {
  return !!applied && applied.subtotal !== subtotal && !locked && subtotal > 0;
}
