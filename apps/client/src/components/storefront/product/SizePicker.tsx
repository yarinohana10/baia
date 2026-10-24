'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { isInStock } from '@/lib/catalog/pricing';
import { BackSoonTip } from './BackSoonTip';
import type { Variant } from '@/lib/catalog/types';

type Props = {
  /** The selected colour's variants, in size-set order. */
  options: Variant[];
  selected: string;
  onSelect: (size: string) => void;
  /** "Only N left" count for the selected size, or null. */
  lowStock: number | null;
  /** Shown next to the legend (the size-guide link). */
  guide: ReactNode;
  /** The whole product is Back Soon: every size is disabled. */
  backSoon?: boolean;
};

/** Size buttons for the selected colour; sold-out sizes (or all, for a Back Soon product) are disabled, struck through and say "Back Soon" on hover, focus or tap. */
export function SizePicker({ options, selected, onSelect, lowStock, guide, backSoon = false }: Props) {
  const t = useTranslations('pdp');
  return (
    <fieldset className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <legend className="text-[13px] text-black">{t('size')}</legend>
        {guide}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((v) => {
          const available = !backSoon && isInStock(v);
          const isSelected = selected === v.size;
          return (
            <BackSoonTip key={v.size} label={t('backSoon')} active={!available}>
              {({ describedBy, onTap }) => (
                <button
                  type="button"
                  onClick={available ? () => onSelect(v.size) : onTap}
                  aria-disabled={!available}
                  aria-describedby={describedBy}
                  aria-pressed={isSelected}
                  aria-label={available ? t('sizeOption', { size: v.size }) : t('sizeBackSoon', { size: v.size })}
                  className={cn(
                    'relative h-10 min-w-[52px] overflow-hidden rounded-[2px] border px-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
                    isSelected && available && 'border-black bg-black text-white',
                    !isSelected && available && 'border-black text-black hover:bg-black/[0.04]',
                    !available &&
                      'cursor-not-allowed border-black/15 bg-[linear-gradient(to_top_right,transparent_calc(50%-0.5px),rgba(0,0,0,0.18)_50%,transparent_calc(50%+0.5px))] text-black/30',
                  )}
                >
                  <span dir="ltr">{v.size}</span>
                </button>
              )}
            </BackSoonTip>
          );
        })}
      </div>
      <p className="mt-2 min-h-5 text-[12px] font-medium text-amber-700" aria-live="polite">
        {lowStock !== null ? t('lowStock', { count: lowStock }) : ''}
      </p>
    </fieldset>
  );
}
