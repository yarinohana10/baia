'use client';

import type { KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { formatPrice } from '@/lib/catalog/pricing';
import type { CouponState } from '@/hooks/storefront/couponState';
import { checkoutSectionClass } from './styles';

/** Coupon code field with "apply", its error, and the applied discount (removable until the order exists). */
export function CouponSection({
  coupon,
  locked,
  onEdit,
  onApply,
  onRemove,
}: {
  coupon: CouponState;
  locked: boolean;
  onEdit: (input: string) => void;
  onApply: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('checkout');
  const tErrors = useTranslations('checkout.errors');
  const { input, applied, error, checking } = coupon;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter applies the coupon instead of submitting the whole order.
    if (e.key === 'Enter') {
      e.preventDefault();
      onApply();
    }
  };

  return (
    <section className={`${checkoutSectionClass} space-y-3`}>
      <h2 className="font-medium text-gray-800">{t('coupon')}</h2>
      <div className="flex gap-2">
        <label htmlFor="checkout-coupon" className="sr-only">{t('coupon')}</label>
        <input
          id="checkout-coupon"
          type="text"
          maxLength={50}
          value={input}
          onChange={(e) => onEdit(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={locked}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-ocean-500 focus:outline-none uppercase"
        />
        <button
          type="button"
          onClick={onApply}
          disabled={checking || !input.trim() || locked}
          className="px-4 py-2 text-sm bg-ocean-700 text-white rounded-lg hover:bg-ocean-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('apply')}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-500">{tErrors(error.key, error.values)}</p>
      )}
      {applied && (
        <p className="text-xs text-green-600 flex items-center gap-2">
          {t('discountApplied', { code: applied.code, amount: formatPrice(applied.discount) })}
          {!locked && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={t('removeCoupon')}
              className="p-0.5 text-gray-400 hover:text-red-500 rounded-full transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </p>
      )}
    </section>
  );
}
