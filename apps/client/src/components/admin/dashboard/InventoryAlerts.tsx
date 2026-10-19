import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { InventoryData } from './types';

/** Same output as `Number#toLocaleString()` with the runtime's default locale. */
const STOCK_FORMAT = new Intl.NumberFormat();

/** Stock summary badges plus the variants that are out of or low on stock. */
export function InventoryAlerts({ data }: { data: InventoryData }) {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();

  return (
    <div className="space-y-3">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
          <span className="font-body text-xs text-muted-foreground">{t('totalStock')}</span>
          <span className="font-body text-sm font-semibold text-foreground">{STOCK_FORMAT.format(data.totalStock)} {t('stockUnits')}</span>
        </div>
        {(data.unlimitedVariants ?? 0) > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <span className="font-body text-xs text-muted-foreground">{t('unlimitedStock')}</span>
            <span className="font-body text-sm font-semibold text-foreground">{t('sizesCount', { count: data.unlimitedVariants ?? 0 })}</span>
          </div>
        )}
        {data.outOfStockCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2">
            <span className="font-body text-xs text-destructive">{t('outOfStock')}</span>
            <span className="font-body text-sm font-semibold text-destructive">{data.outOfStockCount}</span>
          </div>
        )}
        {data.lowStockCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
            <span className="font-body text-xs text-amber-700">{t('lowStock')}</span>
            <span className="font-body text-sm font-semibold text-amber-700">{data.lowStockCount}</span>
          </div>
        )}
      </div>

      {/* Items list */}
      {data.lowStockItems.length === 0 ? (
        <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noAlerts')}</p>
      ) : (
        data.lowStockItems.map((item) => {
          const name = locale === 'he' ? item.productNameHe : item.productNameEn;
          const isOut = item.stockQuantity === 0;

          return (
            <Link
              key={item.variantId}
              href={`/admin/products/${item.productId}`}
              className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
            >
              {item.image ? (
                <Image
                  src={item.image}
                  alt={name}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-medium text-foreground">{name}</p>
                <p className="font-body text-xs text-muted-foreground">
                  {t('variantLabel', { color: item.color, size: item.size })}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-xs font-medium ${
                  isOut
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {isOut ? t('outOfStockLabel') : t('unitsLeft', { count: item.stockQuantity })}
              </span>
            </Link>
          );
        })
      )}
    </div>
  );
}
