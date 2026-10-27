'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useColorName } from '@/hooks/catalog/useColorName';
import { lineIssue, type CartItem } from '@/store/cart';

/** The cart lines in the summary, each with its stock problem if it has one. */
export function CheckoutItems({ items }: { items: CartItem[] }) {
  const t = useTranslations('cart');
  const colorName = useColorName();
  const locale = useLocale();
  return (
    <div className="space-y-3 max-h-60 overflow-y-auto">
      {items.map((item) => {
        const product = item.variant.product;
        const issue = lineIssue(item);
        return (
          <div key={item.id} className="flex justify-between text-sm">
            <div>
              <p className="text-gray-700 line-clamp-1">{locale === 'he' ? product.nameHe : product.nameEn}</p>
              <p className="text-xs text-gray-400">
                {colorName(item.variant.color)} / {item.variant.size} x{item.quantity}
              </p>
              {issue && (
                <p className="text-xs text-red-500">
                  {issue.kind === 'insufficient'
                    ? t('issues.insufficient', { available: issue.available })
                    : t(`issues.${issue.kind}`)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
