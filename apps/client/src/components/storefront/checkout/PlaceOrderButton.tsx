'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';

/** "Place order", or "continue to payment" for an order that already exists. */
export function PlaceOrderButton({
  disabled,
  submitting,
  orderExists,
}: {
  disabled: boolean;
  submitting: boolean;
  orderExists: boolean;
}) {
  const t = useTranslations('checkout');
  let label = t('placeOrder');
  if (submitting) label = t('processing');
  else if (orderExists) label = t('retryPayment');
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={submitting}
      className="w-full bg-black text-white py-3 text-sm tracking-wider uppercase rounded-none hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      <ShieldCheck size={16} />
      {label}
    </button>
  );
}
