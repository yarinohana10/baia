'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProductForm } from '@/hooks/admin/useProductForm';
import { skuPrefixOf } from '@/hooks/admin/product-form';
import ProductImagesManager from './ProductImagesManager';
import ProductStockEditor from './ProductStockEditor';
import { ProductContentFields } from './ProductContentFields';
import { ProductBasicsCard } from './product-form/ProductBasicsCard';
import { ProductFormErrorBanner } from './product-form/ProductFormErrorBanner';
import { CollapsibleCard } from './product-form/CollapsibleCard';
import { activeColors, stockSummary } from './product-form/stock-variants';
import type { ServerProduct } from './product-form/types';
import { adminSelectClassName } from './common/select-class';

const selectClassName = (hasError?: boolean) =>
  adminSelectClassName('font-body', hasError && 'border-destructive ring-3 ring-destructive/20');

/** Create / edit product: details, page content, gallery and sizes & stock. */
export default function ProductForm({ product }: { product?: ServerProduct }) {
  const t = useTranslations('admin.productForm');
  const locale = useLocale();
  const {
    form,
    dispatch,
    formRef,
    categories,
    sizeSets,
    fieldErrors,
    bannerErrors,
    error,
    saving,
    isEdit,
    save,
    removeImage,
    clearServerError,
    cancel,
  } = useProductForm(product);
  const colors = useMemo(() => activeColors(form.variants), [form.variants]);

  return (
    <div ref={formRef} className="max-w-4xl space-y-6 font-body">
      {error && <ProductFormErrorBanner error={error} fieldErrors={bannerErrors} />}

      <ProductBasicsCard
        form={form}
        dispatch={dispatch}
        errors={fieldErrors}
        categories={categories}
        selectClassName={selectClassName}
        onFieldEdited={clearServerError}
      />

      {/* Product-page content: fabric, care, fit */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">{t('content.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductContentFields
            value={form.content}
            onChange={(content) => dispatch({ type: 'content', content })}
            errors={fieldErrors}
            onFieldEdited={clearServerError}
          />
        </CardContent>
      </Card>

      <CollapsibleCard title={`${t('images')} (${form.images.length})`} contentClassName="space-y-2 pt-4">
        <p className="text-xs text-muted-foreground">{t('imagesHint')}</p>
        <ProductImagesManager
          images={form.images}
          onChange={(images) => dispatch({ type: 'images', images })}
          onRemove={removeImage}
          colors={colors}
          errors={fieldErrors}
          disabled={saving}
        />
      </CollapsibleCard>

      <CollapsibleCard
        title={
          <>
            {t('stock.title')} <span className="text-sm font-normal text-muted-foreground">({stockSummary(form.variants).sizes})</span>
          </>
        }
        contentClassName="pt-4"
      >
        <ProductStockEditor
          variants={form.variants}
          onChange={(variants) => dispatch({ type: 'variants', variants })}
          sizeSets={sizeSets}
          sizeSetId={form.sizeSetId}
          onSizeSetChange={(sizeSetId) => dispatch({ type: 'sizeSet', sizeSetId })}
          locale={locale}
          skuPrefix={skuPrefixOf(form)}
          basePrice={form.basePrice}
          errors={fieldErrors}
          onFieldEdited={clearServerError}
          selectClassName={selectClassName}
        />
      </CollapsibleCard>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving} className="gap-2 bg-ocean-700 px-6 text-white hover:bg-ocean-800">
          <Save size={14} /> {saving ? t('saving') : isEdit ? t('updateProduct') : t('createProduct')}
        </Button>
        <Button type="button" variant="outline" onClick={cancel} className="px-6">
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
