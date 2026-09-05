'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Save,
  Plus,
  Trash2,
  Upload,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type Category = {
  id: string;
  nameEn: string;
  children: { id: string; nameEn: string }[];
};

type Variant = {
  id?: string;
  tempId?: string;
  color: string;
  size: string;
  sku: string;
  stockQuantity: number;
  priceOverride: number | null;
  salePrice: number | null;
  saleStart: string | null;
  saleEnd: string | null;
  isActive: boolean;
  isNew?: boolean;
};

type ProductImage = {
  id: string;
  url: string;
  color?: string;
  sortOrder: number;
};

type Props = {
  product?: {
    id: string;
    nameHe: string;
    nameEn: string;
    descriptionHe?: string;
    descriptionEn?: string;
    slug: string;
    basePrice: string;
    categoryId: string;
    isFeatured: boolean;
    isActive: boolean;
    variants: Variant[];
    images: ProductImage[];
  };
};

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const LOW_STOCK_THRESHOLD = 5;

function selectClassName(hasError?: boolean) {
  return cn(
    'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm font-body transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    hasError && 'border-destructive ring-3 ring-destructive/20',
  );
}

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="mb-1 text-xs font-medium text-muted-foreground font-body">
      {children} <span className="text-destructive">*</span>
    </Label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive font-body">{message}</p>;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function ProductForm({ product }: Props) {
  const t = useTranslations('admin.productForm');
  const locale = useLocale();
  const router = useRouter();
  const isEdit = !!product;

  const [nameHe, setNameHe] = useState(product?.nameHe || '');
  const [nameEn, setNameEn] = useState(product?.nameEn || '');
  const [descHe, setDescHe] = useState(product?.descriptionHe || '');
  const [descEn, setDescEn] = useState(product?.descriptionEn || '');
  const [slug, setSlug] = useState(product?.slug || '');
  const [basePrice, setBasePrice] = useState(product ? parseFloat(product.basePrice).toString() : '');
  const [categoryId, setCategoryId] = useState(product?.categoryId || '');
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured || false);
  const [autoSlug, setAutoSlug] = useState(!isEdit);

  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>(product?.variants || []);
  const [images, setImages] = useState<ProductImage[]>(product?.images || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showVariants, setShowVariants] = useState(true);
  const [showImages, setShowImages] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!nameEn.trim()) errors.nameEn = t('validation.nameEnRequired');
    if (!nameHe.trim()) errors.nameHe = t('validation.nameHeRequired');
    if (!slug.trim()) errors.slug = t('validation.slugRequired');
    if (!basePrice) errors.basePrice = t('validation.priceRequired');
    else if (parseFloat(basePrice) <= 0) errors.basePrice = t('validation.pricePositive');
    if (!categoryId) errors.categoryId = t('validation.categoryRequired');
    return errors;
  };

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data));
  }, []);

  useEffect(() => {
    if (autoSlug && nameEn) {
      setSlug(slugify(nameEn));
    }
  }, [nameEn, autoSlug]);

  useEffect(() => {
    if (submitted) {
      setFieldErrors(validate());
    }
  }, [nameEn, nameHe, slug, basePrice, categoryId, submitted]);

  const handleSave = async () => {
    setSubmitted(true);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setError('');
    setSaving(true);

    try {
      const payload = {
        nameHe,
        nameEn,
        descriptionHe: descHe || undefined,
        descriptionEn: descEn || undefined,
        slug,
        basePrice: parseFloat(basePrice),
        categoryId,
        isFeatured,
      };

      let productId = product?.id;

      if (isEdit) {
        await api.put(`/admin/products/${productId}`, payload);
      } else {
        const res = await api.post('/admin/products', payload);
        productId = res.data.id;
      }

      // Save new variants
      const newVariants = variants.filter((v) => v.isNew);
      for (const v of newVariants) {
        await api.post(`/admin/products/${productId}/variants`, {
          color: v.color,
          size: v.size,
          sku: v.sku,
          stockQuantity: v.stockQuantity,
          priceOverride: v.priceOverride,
          salePrice: v.salePrice,
          saleStart: v.saleStart,
          saleEnd: v.saleEnd,
        });
      }

      const existingVariants = variants.filter((v) => v.id && !v.isNew);
      for (const v of existingVariants) {
        await api.put(`/admin/variants/${v.id}`, {
          color: v.color,
          size: v.size,
          sku: v.sku,
          stockQuantity: v.stockQuantity,
          priceOverride: v.priceOverride,
          salePrice: v.salePrice,
          saleStart: v.saleStart,
          saleEnd: v.saleEnd,
          isActive: v.isActive,
        });
      }

      router.push('/admin/products');
    } catch (err: any) {
      setError(err.response?.data?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        tempId: crypto.randomUUID(),
        color: '',
        size: 'M',
        sku: '',
        stockQuantity: 0,
        priceOverride: null,
        salePrice: null,
        saleStart: null,
        saleEnd: null,
        isActive: true,
        isNew: true,
      },
    ]);
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const updated = [...variants];
    (updated[index] as any)[field] = value;
    setVariants(updated);
  };

  const removeVariant = async (index: number) => {
    const v = variants[index];
    if (v.id) {
      if (!confirm(t('deleteVariant'))) return;
      await api.delete(`/admin/variants/${v.id}`);
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!product?.id || !e.target.files) return;

    for (const file of Array.from(e.target.files)) {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post(`/admin/products/${product.id}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImages((prev) => [...prev, res.data]);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm(t('deleteImageConfirm'))) return;
    await api.delete(`/admin/images/${imageId}`);
    setImages(images.filter((img) => img.id !== imageId));
  };

  return (
    <div className="max-w-4xl space-y-6 font-body">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">{t('productDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <RequiredLabel htmlFor="product-name-en">{t('nameEn')}</RequiredLabel>
              <Input
                id="product-name-en"
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                aria-invalid={!!fieldErrors.nameEn}
                aria-label={t('nameEn')}
              />
              <FieldError message={fieldErrors.nameEn} />
            </div>
            <div>
              <RequiredLabel htmlFor="product-name-he">{t('nameHe')}</RequiredLabel>
              <Input
                id="product-name-he"
                type="text"
                value={nameHe}
                onChange={(e) => setNameHe(e.target.value)}
                aria-invalid={!!fieldErrors.nameHe}
                dir="rtl"
                aria-label={t('nameHe')}
              />
              <FieldError message={fieldErrors.nameHe} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="product-desc-en" className="mb-1 text-xs font-medium text-muted-foreground font-body">
                {t('descriptionEn')}
              </Label>
              <Textarea
                id="product-desc-en"
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <div>
              <Label htmlFor="product-desc-he" className="mb-1 text-xs font-medium text-muted-foreground font-body">
                {t('descriptionHe')}
              </Label>
              <Textarea
                id="product-desc-he"
                value={descHe}
                onChange={(e) => setDescHe(e.target.value)}
                rows={3}
                dir="rtl"
                className="resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <RequiredLabel htmlFor="product-slug">{t('slug')}</RequiredLabel>
              <Input
                id="product-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setAutoSlug(false);
                }}
                aria-invalid={!!fieldErrors.slug}
              />
              <FieldError message={fieldErrors.slug} />
            </div>
            <div>
              <RequiredLabel htmlFor="product-base-price">{t('basePrice')}</RequiredLabel>
              <Input
                id="product-base-price"
                type="number"
                min="0"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                aria-invalid={!!fieldErrors.basePrice}
                aria-label={t('basePrice')}
              />
              <FieldError message={fieldErrors.basePrice} />
            </div>
            <div>
              <RequiredLabel htmlFor="product-category">{t('category')}</RequiredLabel>
              <select
                id="product-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={selectClassName(!!fieldErrors.categoryId)}
                aria-invalid={!!fieldErrors.categoryId}
              >
                <option value="">{t('selectCategory')}</option>
                {categories.map((cat) => (
                  <optgroup key={cat.id} label={cat.nameEn}>
                    <option value={cat.id}>{cat.nameEn}</option>
                    {cat.children?.map((child) => (
                      <option key={child.id} value={child.id}>
                        &nbsp;&nbsp;{child.nameEn}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <FieldError message={fieldErrors.categoryId} />
            </div>
          </div>

          <Label htmlFor="product-featured" className="cursor-pointer text-sm font-body">
            <input
              id="product-featured"
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="accent-ocean-700"
            />
            {t('featured')}
          </Label>
        </CardContent>
      </Card>

      {/* Variants */}
      <Card>
        <CardHeader className="pb-0">
          <button
            type="button"
            onClick={() => setShowVariants(!showVariants)}
            className="flex w-full items-center justify-between"
          >
            <CardTitle className="font-serif text-lg">{`${t('variants')} (${variants.length})`}</CardTitle>
            {showVariants ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
          </button>
        </CardHeader>

        {showVariants && (
          <CardContent className="space-y-3 pt-4">
            {variants.map((v, i) => {
              const variantKey = v.id ?? v.tempId!;
              return (
                <div
                  key={variantKey}
                  className={cn(
                    'space-y-2 rounded-lg border p-3',
                    v.stockQuantity > 0 && v.stockQuantity <= LOW_STOCK_THRESHOLD
                      ? 'border-amber-300 bg-amber-50'
                      : v.stockQuantity === 0
                        ? 'border-destructive/20 bg-destructive/5'
                        : 'border-border',
                  )}
                >
                  <div className="grid grid-cols-[1fr_80px_1fr_100px_100px_40px] items-end gap-3">
                    <div>
                      <Label htmlFor={`${variantKey}-color`} className="mb-0.5 text-xs text-muted-foreground font-body">
                        {t('color')}
                      </Label>
                      <Input
                        id={`${variantKey}-color`}
                        type="text"
                        value={v.color}
                        onChange={(e) => updateVariant(i, 'color', e.target.value)}
                        aria-label={t('color')}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-size`} className="mb-0.5 text-xs text-muted-foreground font-body">
                        {t('size')}
                      </Label>
                      <select
                        id={`${variantKey}-size`}
                        value={v.size}
                        onChange={(e) => updateVariant(i, 'size', e.target.value)}
                        className={selectClassName()}
                      >
                        {SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-sku`} className="mb-0.5 text-xs text-muted-foreground font-body">
                        {t('sku')}
                      </Label>
                      <Input
                        id={`${variantKey}-sku`}
                        type="text"
                        value={v.sku}
                        onChange={(e) => updateVariant(i, 'sku', e.target.value)}
                        aria-label={t('sku')}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-stock`} className="mb-0.5 text-xs text-muted-foreground font-body">
                        {t('stock')}
                      </Label>
                      <div className="relative">
                        <Input
                          id={`${variantKey}-stock`}
                          type="number"
                          min="0"
                          value={v.stockQuantity}
                          onChange={(e) => updateVariant(i, 'stockQuantity', parseInt(e.target.value) || 0)}
                        />
                        {v.stockQuantity > 0 && v.stockQuantity <= LOW_STOCK_THRESHOLD && (
                          <AlertTriangle
                            size={12}
                            className="absolute end-2 top-1/2 -translate-y-1/2 text-amber-500"
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-price`} className="mb-0.5 text-xs text-muted-foreground font-body">
                        {t('price')}
                      </Label>
                      <Input
                        id={`${variantKey}-price`}
                        type="number"
                        step="0.01"
                        value={v.priceOverride ?? ''}
                        onChange={(e) =>
                          updateVariant(
                            i,
                            'priceOverride',
                            e.target.value ? parseFloat(e.target.value) : null,
                          )
                        }
                        aria-label={t('priceOverride')}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeVariant(i)}
                      aria-label={t('removeVariant')}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  {/* Sale price row */}
                  <div className="grid grid-cols-3 gap-3 border-t border-dashed border-border pt-1">
                    <div>
                      <Label htmlFor={`${variantKey}-sale-price`} className="mb-0.5 text-xs text-destructive font-body">
                        {t('salePrice')}
                      </Label>
                      <Input
                        id={`${variantKey}-sale-price`}
                        type="number"
                        step="0.01"
                        value={v.salePrice ?? ''}
                        onChange={(e) =>
                          updateVariant(
                            i,
                            'salePrice',
                            e.target.value ? parseFloat(e.target.value) : null,
                          )
                        }
                        aria-label={t('salePrice')}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-sale-start`} className="mb-0.5 text-xs text-destructive font-body">
                        {t('saleStart')}
                      </Label>
                      <Input
                        id={`${variantKey}-sale-start`}
                        type="date"
                        value={v.saleStart ? v.saleStart.split('T')[0] : ''}
                        onChange={(e) =>
                          updateVariant(i, 'saleStart', e.target.value || null)
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-sale-end`} className="mb-0.5 text-xs text-destructive font-body">
                        {t('saleEnd')}
                      </Label>
                      <Input
                        id={`${variantKey}-sale-end`}
                        type="date"
                        value={v.saleEnd ? v.saleEnd.split('T')[0] : ''}
                        onChange={(e) =>
                          updateVariant(i, 'saleEnd', e.target.value || null)
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addVariant}
              className="mt-2 text-ocean-600 hover:text-ocean-700"
            >
              <Plus size={14} /> {t('addVariant')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Images (only for existing products) */}
      {isEdit && (
        <Card>
          <CardHeader className="pb-0">
            <button
              type="button"
              onClick={() => setShowImages(!showImages)}
              className="flex w-full items-center justify-between"
            >
              <CardTitle className="font-serif text-lg">{`${t('images')} (${images.length})`}</CardTitle>
              {showImages ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
            </button>
          </CardHeader>

          {showImages && (
            <CardContent className="pt-4">
              <div className="mb-4 grid grid-cols-4 gap-4">
                {images.map((img) => (
                  <div key={img.id} className="group relative">
                    <Image
                      src={img.url}
                      alt={t('images')}
                      width={200}
                      height={200}
                      className="aspect-square w-full rounded-lg bg-muted object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDeleteImage(img.id)}
                      aria-label={t('deleteImage')}
                      className="absolute end-1 top-1 bg-background/80 text-destructive opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>

              <Label
                htmlFor="product-image-upload"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'w-fit cursor-pointer text-ocean-600 hover:text-ocean-700',
                )}
              >
                <Upload size={14} />
                {t('uploadImages')}
              </Label>
              <input
                id="product-image-upload"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                aria-label={t('uploadImages')}
              />
            </CardContent>
          )}
        </Card>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-ocean-700 px-6 text-white hover:bg-ocean-800"
        >
          <Save size={14} /> {saving ? t('saving') : isEdit ? t('updateProduct') : t('createProduct')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/products')}
          className="px-6"
        >
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
