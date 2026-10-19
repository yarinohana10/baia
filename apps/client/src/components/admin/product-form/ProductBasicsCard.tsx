'use client';

import type { ChangeEvent, Dispatch } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProductFormAction, ProductFormValues } from '@/hooks/admin/product-form';
import type { FieldErrors } from '../product-form-errors';
import { RequiredLabel } from './RequiredLabel';
import { ProductFieldError } from './ProductFieldError';
import { ProductCategorySelect } from './ProductCategorySelect';
import type { ProductCategory } from './types';

type Props = {
  form: ProductFormValues;
  dispatch: Dispatch<ProductFormAction>;
  errors: FieldErrors;
  categories: ProductCategory[];
  selectClassName: (hasError?: boolean) => string;
  onFieldEdited: (...fields: string[]) => void;
};

const DESCRIPTION_LABEL = 'mb-1 text-xs font-medium text-muted-foreground font-body';

/** Names, descriptions, slug, price, category and the visible / featured switches. */
export function ProductBasicsCard({ form, dispatch, errors, categories, selectClassName, onFieldEdited }: Props) {
  const t = useTranslations('admin.productForm');

  const edited =
    (field: 'nameEn' | 'nameHe' | 'slug' | 'basePrice', update: (value: string) => void) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      update(e.target.value);
      onFieldEdited(field);
    };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">{t('productDetails')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <RequiredLabel htmlFor="product-name-en">{t('nameEn')}</RequiredLabel>
            <Input
              id="product-name-en"
              type="text"
              dir="ltr"
              value={form.nameEn}
              onChange={edited('nameEn', (value) => dispatch({ type: 'nameEn', value }))}
              aria-invalid={!!errors.nameEn}
            />
            <ProductFieldError message={errors.nameEn} />
          </div>
          <div>
            <RequiredLabel htmlFor="product-name-he">{t('nameHe')}</RequiredLabel>
            <Input
              id="product-name-he"
              type="text"
              dir="rtl"
              value={form.nameHe}
              onChange={edited('nameHe', (value) => dispatch({ type: 'text', field: 'nameHe', value }))}
              aria-invalid={!!errors.nameHe}
            />
            <ProductFieldError message={errors.nameHe} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="product-desc-en" className={DESCRIPTION_LABEL}>
              {t('descriptionEn')}
            </Label>
            <Textarea
              id="product-desc-en"
              dir="ltr"
              value={form.descEn}
              onChange={(e) => dispatch({ type: 'text', field: 'descEn', value: e.target.value })}
              rows={3}
              className="resize-none"
            />
          </div>
          <div>
            <Label htmlFor="product-desc-he" className={DESCRIPTION_LABEL}>
              {t('descriptionHe')}
            </Label>
            <Textarea
              id="product-desc-he"
              value={form.descHe}
              onChange={(e) => dispatch({ type: 'text', field: 'descHe', value: e.target.value })}
              rows={3}
              dir="rtl"
              className="resize-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <RequiredLabel htmlFor="product-slug">{t('slug')}</RequiredLabel>
            <Input
              id="product-slug"
              type="text"
              dir="ltr"
              value={form.slug}
              onChange={edited('slug', (value) => dispatch({ type: 'slug', value }))}
              aria-invalid={!!errors.slug}
            />
            <ProductFieldError message={errors.slug} />
          </div>
          <div>
            <RequiredLabel htmlFor="product-base-price">{t('basePrice')}</RequiredLabel>
            <Input
              id="product-base-price"
              type="number"
              min="0"
              step="0.01"
              value={form.basePrice}
              onChange={edited('basePrice', (value) => dispatch({ type: 'text', field: 'basePrice', value }))}
              aria-invalid={!!errors.basePrice}
            />
            <ProductFieldError message={errors.basePrice} />
          </div>
          <ProductCategorySelect
            value={form.categoryId}
            categories={categories}
            error={errors.categoryId}
            selectClassName={selectClassName}
            onChange={(categoryId) => {
              dispatch({ type: 'category', categoryId, categories });
              onFieldEdited('categoryId');
            }}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
          <Label htmlFor="product-active" className="cursor-pointer items-start text-sm font-body">
            <input
              id="product-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => dispatch({ type: 'flag', field: 'isActive', value: e.target.checked })}
              className="mt-0.5 accent-ocean-700"
            />
            <span>
              {t('visibleInStore')}
              <span className="block text-xs font-normal text-muted-foreground">
                {form.isActive ? t('visibleHint') : t('hiddenHint')}
              </span>
            </span>
          </Label>
          <Label htmlFor="product-featured" className="cursor-pointer items-start text-sm font-body">
            <input
              id="product-featured"
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => dispatch({ type: 'flag', field: 'isFeatured', value: e.target.checked })}
              className="mt-0.5 accent-ocean-700"
            />
            {t('featured')}
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
