'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { StockStatus, StockSummary } from './stock-summary';

const BADGE_CLASS: Record<StockStatus, string> = {
  no_sizes: 'bg-[#f3f3f4] text-[#3f484c]',
  out_of_stock: 'bg-red-50 text-red-600',
  low_stock: 'bg-amber-50 text-amber-700',
  in_stock: 'bg-emerald-50 text-emerald-700',
};

const BADGE_LABEL = {
  no_sizes: 'noSizes',
  out_of_stock: 'outOfStockBadge',
  low_stock: 'lowStockBadge',
  in_stock: 'inStock',
} as const satisfies Record<StockStatus, string>;

/** Stock badge plus the tracked-units count (or "unlimited"). */
export function ProductStockCell({ stock }: { stock: StockSummary }) {
  const t = useTranslations('admin.products');
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-body text-xs font-medium', BADGE_CLASS[stock.status])}
      >
        {t(BADGE_LABEL[stock.status])}
      </span>
      {stock.sizes > 0 && (
        <span className="whitespace-nowrap font-body text-xs text-[#3f484c]">
          {stock.trackedCount === 0 ? (
            t('unlimited')
          ) : (
            <>
              {stock.tracked}
              {stock.unlimitedCount > 0 && <span className="ms-1 text-[11px] text-[#3f484c]/70">{t('plusUnlimited')}</span>}
            </>
          )}
        </span>
      )}
    </div>
  );
}
