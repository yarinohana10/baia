'use client';

import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';
import { paymentSummary, type OrderPaymentFields } from '@/lib/payment';

/** "ויזה •••• 4242 · 3 תשלומים" / "Bit" / "Apple Pay"; nothing when no method was recorded. */
export function PaymentMethodLine({
  order,
  className,
  compact = false,
}: {
  order: OrderPaymentFields;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations('payment');
  const summary = paymentSummary(order);
  if (!summary) return null;
  const text = t(`summary.${summary.key}`, summary.values);
  if (compact) {
    return (
      <span className={className ?? 'flex items-center gap-1'}>
        <CreditCard size={12} aria-hidden="true" />
        <span className="sr-only">{t('summaryLabel')}: </span>
        {text}
      </span>
    );
  }
  return (
    <div className={className}>
      <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
        <CreditCard size={12} aria-hidden="true" /> {t('summaryLabel')}
      </p>
      <p>{text}</p>
    </div>
  );
}
