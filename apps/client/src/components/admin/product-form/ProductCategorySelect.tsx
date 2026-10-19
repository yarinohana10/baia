'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { ProductFieldError } from './ProductFieldError';
import type { CategoryOption, ProductCategory } from './types';

type Props = {
  value: string;
  categories: ProductCategory[];
  error: string | undefined;
  selectClassName: (hasError?: boolean) => string;
  onChange: (categoryId: string) => void;
};

/** Category picker; products go in a leaf category, so a parent with subcategories is only a group heading. */
export function ProductCategorySelect({ value, categories, error, selectClassName, onChange }: Props) {
  const t = useTranslations('admin.productForm');
  const locale = useLocale();
  const catName = (c: CategoryOption) => (locale === 'he' ? c.nameHe : c.nameEn) || c.nameEn;

  return (
    <div>
      <Label htmlFor="product-category" className="mb-1 text-xs font-medium text-muted-foreground font-body">
        {t('category')} <span className="text-destructive">*</span>
      </Label>
      <select
        id="product-category"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName(!!error)}
        aria-invalid={!!error}
      >
        <option value="">{t('selectCategory')}</option>
        {categories.map((cat) =>
          cat.children && cat.children.length > 0 ? (
            <optgroup key={cat.id} label={catName(cat)}>
              {cat.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {catName(cat)} › {catName(child)}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={cat.id} value={cat.id}>
              {catName(cat)}
            </option>
          ),
        )}
      </select>
      <ProductFieldError message={error} />
    </div>
  );
}
