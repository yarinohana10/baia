'use client';

import { useTranslations } from 'next-intl';
import { Minus, Plus } from 'lucide-react';

type Props = {
  quantity: number;
  max: number;
  onDecrement: () => void;
  onIncrement: () => void;
};

/** − quantity + control, limited to 1..max. */
export function QuantityStepper({ quantity, max, onDecrement, onIncrement }: Props) {
  const t = useTranslations('pdp');
  return (
    <div className="flex items-center rounded-lg border border-gray-300" role="group" aria-label={t('quantity')}>
      <button
        type="button"
        onClick={onDecrement}
        disabled={quantity <= 1}
        aria-label={t('decrease')}
        className="flex h-full w-10 items-center justify-center text-gray-600 hover:text-ocean-700 disabled:text-gray-300"
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <output className="min-w-8 text-center text-sm tabular-nums" aria-live="polite">
        {quantity}
      </output>
      <button
        type="button"
        onClick={onIncrement}
        disabled={quantity >= max}
        aria-label={t('increase')}
        className="flex h-full w-10 items-center justify-center text-gray-600 hover:text-ocean-700 disabled:text-gray-300"
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
