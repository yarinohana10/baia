'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** Product-page content (fabric / care / fit), per language. Max lengths match the API DTO. */
export type ProductContent = {
  fabricHe: string;
  fabricEn: string;
  careHe: string;
  careEn: string;
  fitHe: string;
  fitEn: string;
};

export const CONTENT_FIELDS = ['fabric', 'care', 'fit'] as const;
export const CONTENT_MAX: Record<(typeof CONTENT_FIELDS)[number], number> = { fabric: 1000, care: 2000, fit: 1000 };

export const emptyContent = (p?: Partial<Record<keyof ProductContent, string | null>>): ProductContent => ({
  fabricHe: p?.fabricHe ?? '',
  fabricEn: p?.fabricEn ?? '',
  careHe: p?.careHe ?? '',
  careEn: p?.careEn ?? '',
  fitHe: p?.fitHe ?? '',
  fitEn: p?.fitEn ?? '',
});

/** API payload: trimmed, empty -> null. */
export function contentPayload(c: ProductContent): Record<keyof ProductContent, string | null> {
  return Object.fromEntries(
    Object.entries(c).map(([k, v]) => [k, v.trim() || null]),
  ) as Record<keyof ProductContent, string | null>;
}

type Lang = 'He' | 'En';

/**
 * "Product details" card body: Hebrew / English tabs, each with fabric, care
 * and fit textareas plus character counters.
 */
export function ProductContentFields({
  value,
  onChange,
  errors,
  onFieldEdited,
}: {
  value: ProductContent;
  onChange: (next: ProductContent) => void;
  errors: Record<string, string>;
  onFieldEdited: (field: string) => void;
}) {
  const t = useTranslations('admin.productForm.content');
  const [lang, setLang] = useState<Lang>('He');
  const hasError = (l: Lang) => CONTENT_FIELDS.some((f) => errors[`${f}${l}`]);
  const missingEn = CONTENT_FIELDS.some((f) => value[`${f}He`].trim() && !value[`${f}En`].trim());

  // Show the tab that holds a server error, so the invalid field can get focus.
  const heError = hasError('He');
  const enError = hasError('En');
  useEffect(() => {
    if (heError) setLang('He');
    else if (enError) setLang('En');
  }, [heError, enError]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('hint')}</p>
      <div role="tablist" aria-label={t('language')} className="inline-flex rounded-lg border border-input p-0.5">
        {(['He', 'En'] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            id={`content-tab-${l}`}
            aria-selected={lang === l}
            aria-controls={`content-panel-${l}`}
            onClick={() => setLang(l)}
            className={cn(
              'relative rounded-md px-3 py-1 text-xs font-medium transition-colors',
              lang === l ? 'bg-ocean-700 text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(l === 'He' ? 'he' : 'en')}
            {(hasError(l) || (l === 'En' && missingEn)) && (
              <span
                aria-hidden="true"
                className={cn('absolute -top-0.5 -end-0.5 size-2 rounded-full', hasError(l) ? 'bg-destructive' : 'bg-amber-500')}
              />
            )}
          </button>
        ))}
      </div>
      {lang === 'En' && missingEn && <p className="text-xs text-amber-700">{t('missingEn')}</p>}

      {(['He', 'En'] as const).map((l) => (
        <div
          key={l}
          role="tabpanel"
          id={`content-panel-${l}`}
          aria-labelledby={`content-tab-${l}`}
          hidden={lang !== l}
          className="space-y-4"
        >
          {CONTENT_FIELDS.map((field) => {
            const key = `${field}${l}` as keyof ProductContent;
            const id = `product-${field}-${l.toLowerCase()}`;
            const max = CONTENT_MAX[field];
            const text = value[key];
            return (
              <div key={key}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <Label htmlFor={id} className="text-xs font-medium text-muted-foreground font-body">
                    {t(field)}
                  </Label>
                  <span className={cn('text-[11px] tabular-nums', text.length > max ? 'text-destructive' : 'text-muted-foreground')}>
                    {t('chars', { count: text.length, max })}
                  </span>
                </div>
                <Textarea
                  id={id}
                  dir={l === 'He' ? 'rtl' : 'ltr'}
                  value={text}
                  maxLength={max}
                  rows={field === 'care' ? 3 : 2}
                  placeholder={t(`${field}Placeholder`)}
                  onChange={(e) => {
                    onChange({ ...value, [key]: e.target.value });
                    onFieldEdited(key);
                  }}
                  aria-invalid={!!errors[key]}
                  className="resize-y"
                />
                {errors[key] && <p className="mt-1 text-xs text-destructive font-body">{errors[key]}</p>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
