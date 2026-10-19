import { describe, expect, it } from 'vitest';
import { couponReducer, initialCouponState, needsRevalidation } from '../couponState';

const applied = { code: 'SALE', discount: 20, subtotal: 200 };

describe('couponReducer', () => {
  it('upper-cases typed codes and drops the applied coupon and error', () => {
    const state = { ...initialCouponState, applied, error: { key: 'couponInvalid' } };
    expect(couponReducer(state, { type: 'edit', input: 'sale10' })).toEqual({ input: 'SALE10', applied: null, error: null, checking: false });
  });

  it('checks, then applies or rejects', () => {
    const checking = couponReducer({ ...initialCouponState, input: 'SALE', applied }, { type: 'checking' });
    expect(checking).toMatchObject({ checking: true, applied: null, error: null });
    expect(couponReducer(checking, { type: 'applied', coupon: applied })).toMatchObject({ applied, checking: false });
    expect(couponReducer(checking, { type: 'rejected', error: { key: 'couponExpired' } })).toMatchObject({
      applied: null,
      error: { key: 'couponExpired' },
      checking: false,
    });
  });

  it('removing clears the code too; clearing keeps it', () => {
    const state = { ...initialCouponState, input: 'SALE', applied };
    expect(couponReducer(state, { type: 'removed' })).toEqual(initialCouponState);
    expect(couponReducer(state, { type: 'cleared' })).toMatchObject({ input: 'SALE', applied: null });
  });
});

describe('needsRevalidation', () => {
  it('re-checks only an applied coupon whose subtotal changed, before the order exists', () => {
    expect(needsRevalidation(applied, 250, false)).toBe(true);
    expect(needsRevalidation(applied, 200, false)).toBe(false);
    expect(needsRevalidation(applied, 250, true)).toBe(false);
    expect(needsRevalidation(applied, 0, false)).toBe(false);
    expect(needsRevalidation(null, 250, false)).toBe(false);
  });
});
