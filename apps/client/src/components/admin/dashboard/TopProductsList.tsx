import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import type { TopProduct } from './types';

/** Best sellers, ranked; falls back to the order line's name when the product is gone. */
export function TopProductsList({ products }: { products: TopProduct[] }) {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();

  return (
    <div className="space-y-3">
      {products.length === 0 ? (
        <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noSalesDataYet')}</p>
      ) : (
        products.map((item, idx) => {
          const productName =
            locale === 'he'
              ? item.product?.nameHe ?? item.productName
              : item.product?.nameEn ?? item.productName;

          return (
            <div key={item.product?.id ?? item.productName} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-body text-xs font-bold text-ocean-700">
                {idx + 1}
              </div>
              {item.product?.image && (
                <Image
                  src={item.product.image}
                  alt={productName}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-medium text-foreground">{productName}</p>
                <p className="font-body text-xs text-muted-foreground">
                  {item.totalQuantity} {t('units')} · {item.orderCount} {t('orderItems')}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
