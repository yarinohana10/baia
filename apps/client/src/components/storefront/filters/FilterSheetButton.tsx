'use client';

import { useTranslations } from 'next-intl';
import { SlidersHorizontal } from 'lucide-react';

type Props = { activeCount: number; onClick: () => void };

/** Phones: the "Filter" button (with the active-filter count) that opens the sheet. */
export function FilterSheetButton({ activeCount, onClick }: Props) {
  const t = useTranslations('filters');
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-charcoal md:hidden"
      aria-haspopup="dialog"
    >
      <SlidersHorizontal size={15} aria-hidden="true" />
      {t('open')}
      {activeCount > 0 && (
        <span className="flex size-5 items-center justify-center rounded-full bg-ocean-700 text-[11px] text-white">
          {activeCount}
        </span>
      )}
    </button>
  );
}
