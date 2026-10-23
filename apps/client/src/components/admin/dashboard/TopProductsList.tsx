'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatCount } from '@/lib/admin/analytics-format';
import { formatWholeShekels } from '@/lib/admin/format';
import { SegmentedToggle } from './SegmentedToggle';
import type { TopProducts } from './types';

type Sort = 'units' | 'revenue';

/** Best sellers of the range, ranked by units or by revenue. */
export function TopProductsList({ data }: { data: TopProducts }) {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();
  const [sort, setSort] = useState<Sort>('units');
  const products = sort === 'units' ? data.byUnits : data.byRevenue;

  return (
    <div className="space-y-3">
      <SegmentedToggle
        label={t('top.rankBy')}
        value={sort}
        onChange={setSort}
        options={[
          { value: 'units', label: t('top.byUnits') },
          { value: 'revenue', label: t('top.byRevenue') },
        ]}
      />
      {products.length === 0 ? (
        <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noSalesDataYet')}</p>
      ) : (
        <ol className="space-y-3">
          {products.map((item, idx) => {
            const name = locale === 'he' ? item.nameHe : item.nameEn;
            return (
              <li key={item.productId}>
                <Link
                  href={`/admin/products/${item.productId}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-body text-xs font-bold text-ocean-700">
                    {idx + 1}
                  </span>
                  {item.image && <Image src={item.image} alt="" width={48} height={48} className="h-12 w-12 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-medium text-foreground">{name}</p>
                    <p className="font-body text-xs text-muted-foreground">
                      {formatCount(item.units, locale)} {t('units')} · {formatCount(item.orders, locale)} {t('top.orders')}
                    </p>
                  </div>
                  <span className="shrink-0 font-body text-sm font-semibold text-foreground">{formatWholeShekels(item.revenue)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
