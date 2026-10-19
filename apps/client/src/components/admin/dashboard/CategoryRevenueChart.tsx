import { useLocale, useTranslations } from 'next-intl';
import { formatWholeShekels } from '@/lib/admin/format';
import { CATEGORY_REVENUE_COLORS } from './constants';
import type { CategoryRevenue } from './types';

/** Revenue per category, bars scaled to the top category. */
export function CategoryRevenueChart({ data }: { data: CategoryRevenue[] }) {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noRevenueData')}</p>
      ) : (
        data.map((item, idx) => (
          <div key={item.categoryId}>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-body text-sm text-foreground">
                {locale === 'he' ? item.nameHe : item.nameEn}
              </span>
              <span className="font-body text-sm font-semibold text-foreground">
                {formatWholeShekels(item.revenue)}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(item.revenue / maxRevenue) * 100}%`,
                  backgroundColor: CATEGORY_REVENUE_COLORS[idx % CATEGORY_REVENUE_COLORS.length],
                }}
              />
            </div>
            <p className="mt-0.5 font-body text-xs text-muted-foreground">
              {item.orders} {t('orderItems')}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
