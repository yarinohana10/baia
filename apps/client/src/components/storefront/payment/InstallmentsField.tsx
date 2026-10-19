'use client';

import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/catalog/pricing';
import { installmentOptions, type PaymentConfig } from '@/lib/payment';
import { paymentInputClasses, paymentLabelClass } from './styles';

/** Installments select, or "single payment" (with the minimum total for installments, when there is one). */
export function InstallmentsField({
  id,
  total,
  config,
  value,
  busy,
  onChange,
}: {
  id: string;
  total: number;
  config: PaymentConfig;
  value: number;
  busy: boolean;
  onChange: (count: number) => void;
}) {
  const t = useTranslations('payment');
  const options = installmentOptions(total, config.installments);
  const { max, minTotal } = config.installments;
  return (
    <div>
      <label htmlFor={id} className={paymentLabelClass}>
        {t('card.installments')}
      </label>
      {options.length > 1 ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={busy}
          className={paymentInputClasses(false, 'bg-white')}
        >
          {options.map((n) => (
            <option key={n} value={n}>
              {t('card.installmentOption', { count: n, amount: formatPrice(Math.round((total / n) * 100) / 100) })}
            </option>
          ))}
        </select>
      ) : (
        <>
          <p id={id} className="text-sm text-gray-700">
            {t('card.singlePayment')}
          </p>
          {max > 1 && minTotal > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{t('card.installmentsFrom', { min: formatPrice(minTotal) })}</p>
          )}
        </>
      )}
    </div>
  );
}
