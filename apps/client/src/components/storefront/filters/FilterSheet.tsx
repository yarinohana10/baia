'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { FilterAvailability } from '@/lib/catalog/filter-options';
import { FilterSheetSection } from './FilterSheetSection';
import type { FilterControls } from './types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  controls: FilterControls;
  available: FilterAvailability;
  activeCount: number;
  pending: boolean;
  total: number;
  onClearAll: () => void;
};

/** Phones: the filter controls in a side sheet, with "Clear all" and "Show N results". */
export function FilterSheet({ open, onOpenChange, locale, controls, available, activeCount, pending, total, onClearAll }: Props) {
  const t = useTranslations('filters');
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={locale === 'he' ? 'right' : 'left'}
        showCloseButton={false}
        className="w-[88%] gap-0 bg-white p-0 sm:max-w-sm"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <SheetTitle className="text-base font-semibold text-charcoal">{t('title')}</SheetTitle>
          <SheetClose
            aria-label={t('close')}
            className="flex size-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <X size={18} aria-hidden="true" />
          </SheetClose>
        </div>
        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
          {available.sizes && <FilterSheetSection title={t('size')}>{controls.sizes}</FilterSheetSection>}
          {available.colors && <FilterSheetSection title={t('color')}>{controls.colors}</FilterSheetSection>}
          {available.price && <FilterSheetSection title={t('price')}>{controls.price}</FilterSheetSection>}
          <FilterSheetSection title={t('availability')}>{controls.inStock}</FilterSheetSection>
        </div>
        <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="h-11 rounded-none border border-gray-300 px-4 text-sm font-medium text-charcoal"
            >
              {t('clearAll')}
            </button>
          )}
          <SheetClose className="h-11 flex-1 rounded-none bg-black text-sm font-semibold text-white disabled:opacity-70" disabled={pending}>
            {pending ? t('updating') : t('showResults', { count: total })}
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
