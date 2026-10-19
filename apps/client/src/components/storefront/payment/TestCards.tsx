'use client';

import { useTranslations } from 'next-intl';
import { FlaskConical } from 'lucide-react';
import { TEST_CARDS, formatCardNumber } from '@/lib/payment';

/** Test mode only: the mock provider's cards, each with a "fill" button. */
export function TestCards({ onUse, disabled }: { onUse: (number: string) => void; disabled: boolean }) {
  const t = useTranslations('payment.testCards');
  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-4 text-sm">
      <p className="font-medium text-amber-900 flex items-center gap-1.5 mb-2">
        <FlaskConical size={14} aria-hidden="true" /> {t('title')}
      </p>
      <ul className="space-y-1.5">
        {TEST_CARDS.map((card) => {
          const formatted = formatCardNumber(card.number);
          return (
            <li key={card.number} className="flex items-center justify-between gap-3">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs" dir="ltr">
                  {formatted}
                </span>
                <span className="text-xs text-gray-600">{t(card.simulation)}</span>
              </span>
              <button
                type="button"
                onClick={() => onUse(card.number)}
                disabled={disabled}
                aria-label={t('useCard', { number: formatted })}
                className="shrink-0 text-xs text-ocean-700 underline underline-offset-2 hover:text-ocean-800 disabled:opacity-50"
              >
                {t('use')}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-gray-500">{t('hint')}</p>
    </div>
  );
}
