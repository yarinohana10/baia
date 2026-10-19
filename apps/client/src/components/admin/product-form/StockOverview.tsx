'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { stockSummary, type SizeSet } from './stock-variants';

type Props = {
  sizeSets: SizeSet[];
  sizeSetId: string;
  onSizeSetChange: (id: string) => void;
  locale: string;
  summary: ReturnType<typeof stockSummary>;
  /** Server / validation error for the variants as a whole. */
  variantsError: string | undefined;
  selectClassName: (hasError?: boolean) => string;
};

/** Size set picker, stock totals and the no-sizes / sold-out warnings. */
export function StockOverview({ sizeSets, sizeSetId, onSizeSetChange, locale, summary, variantsError, selectClassName }: Props) {
  const t = useTranslations('admin.productForm');
  const ts = useTranslations('admin.productForm.stock');
  const hasSizeSet = sizeSets.some((s) => s.id === sizeSetId);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="product-size-set" className="mb-1 text-xs font-medium text-muted-foreground">
            {t('sizeSet')}
          </Label>
          <select id="product-size-set" value={sizeSetId} onChange={(e) => onSizeSetChange(e.target.value)} className={selectClassName()}>
            {sizeSets.map((s) => (
              <option key={s.id} value={s.id}>
                {locale === 'he' ? s.nameHe : s.nameEn}
              </option>
            ))}
            <option value="">{t('customSizes')}</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{hasSizeSet ? ts('sizeChartHint') : t('customSizesHint')}</p>
        </div>
        <div className="flex flex-col justify-end text-sm" aria-live="polite">
          <p className="font-medium text-foreground">
            {ts('summary', { sizes: summary.sizes, units: summary.units })}
            {summary.unlimited > 0 && <span className="text-muted-foreground"> · {ts('summaryUnlimited', { count: summary.unlimited })}</span>}
          </p>
        </div>
      </div>

      {summary.sizes === 0 && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {variantsError ?? ts('noSizesWarning')}
        </p>
      )}
      {summary.zero > 0 && (
        <p className="flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {ts('zeroStockWarning', { count: summary.zero })}
        </p>
      )}
    </>
  );
}
