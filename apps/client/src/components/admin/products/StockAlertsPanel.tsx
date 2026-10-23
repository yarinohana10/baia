'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { StockAlert } from '@/hooks/admin/useStockAlerts';

const MAX_SHOWN = 8;

/** In-panel stock alerts: every size at or under the low-stock threshold, sold-out first. */
export function StockAlertsPanel({ items, threshold }: { items: StockAlert[]; threshold: number }) {
  const t = useTranslations('admin.products');
  const locale = useLocale();
  if (items.length === 0) return null;
  const shown = items.slice(0, MAX_SHOWN);
  return (
    <section aria-label={t('stockAlerts.title')} className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="flex items-center gap-2 font-body text-sm font-semibold text-amber-800">
        <AlertTriangle size={16} aria-hidden="true" />
        {t('stockAlerts.title')} ({items.length})
      </h2>
      <p className="mt-1 font-body text-xs text-amber-800/80">{t('stockAlerts.hint', { threshold })}</p>
      <ul className="mt-3 space-y-1.5">
        {shown.map((item) => (
          <li key={item.variantId} className="flex flex-wrap items-center gap-x-2 font-body text-sm text-[#1a1c1c]">
            <Link href={`/admin/products/${item.productId}`} className="font-medium text-ocean-700 hover:underline">
              {locale === 'he' ? item.productNameHe : item.productNameEn}
            </Link>
            <span className="text-[#3f484c]">
              {item.color} · <span dir="ltr">{item.size}</span>
            </span>
            <span className={item.soldOut ? 'font-semibold text-red-600' : 'font-semibold text-amber-700'}>
              {item.soldOut ? t('stockAlerts.soldOut') : t('stockAlerts.remaining', { count: item.remaining })}
            </span>
          </li>
        ))}
      </ul>
      {items.length > shown.length && (
        <p className="mt-2 font-body text-xs text-amber-800/80">{t('stockAlerts.more', { count: items.length - shown.length })}</p>
      )}
    </section>
  );
}
