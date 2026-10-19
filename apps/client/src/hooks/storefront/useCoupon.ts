'use client';

import { useEffect, useReducer } from 'react';
import { useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { shopErrorMessage } from '@/lib/shop-errors';
import { couponReducer, initialCouponState, needsRevalidation, type AppliedCoupon } from './couponState';

async function validateCoupon(code: string, subtotal: number): Promise<AppliedCoupon> {
  const res = await api.post('/coupons/validate', { code, cartTotal: subtotal });
  return { code, discount: Number(res.data.discount) || 0, subtotal };
}

/**
 * Checkout coupon: validated against the cart subtotal (POST /coupons/validate),
 * and re-validated whenever the subtotal changes until the order is placed.
 */
export function useCoupon(subtotal: number, locked: boolean) {
  const locale = useLocale();
  const [state, dispatch] = useReducer(couponReducer, initialCouponState);
  const { applied } = state;

  // The discount depends on the subtotal: re-check the coupon whenever the cart changes.
  useEffect(() => {
    if (!needsRevalidation(applied, subtotal, locked)) return;
    let cancelled = false;
    validateCoupon(applied.code, subtotal)
      .then((coupon) => {
        if (!cancelled) dispatch({ type: 'applied', coupon });
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: 'rejected', error: shopErrorMessage(err, locale) });
      });
    return () => {
      cancelled = true;
    };
  }, [applied, subtotal, locked, locale]);

  const apply = async () => {
    const code = state.input.trim();
    if (!code) {
      dispatch({ type: 'cleared' });
      return;
    }
    dispatch({ type: 'checking' });
    try {
      dispatch({ type: 'applied', coupon: await validateCoupon(code, subtotal) });
    } catch (err) {
      dispatch({ type: 'rejected', error: shopErrorMessage(err, locale) });
    }
  };

  return {
    state,
    apply,
    edit: (input: string) => dispatch({ type: 'edit', input }),
    remove: () => dispatch({ type: 'removed' }),
    /** The order was refused over the coupon: drop it and show why. */
    reject: (err: unknown) => dispatch({ type: 'rejected', error: shopErrorMessage(err, locale) }),
  };
}
