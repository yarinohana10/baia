'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, Plus, Trash2, AlertTriangle, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import ProductImagesManager, { type ImageItem } from './ProductImagesManager';
import {
  type FieldErrors,
  responseOf,
  serverFieldErrors,
  translateFieldErrors,
} from './product-form-errors';

type CategoryOption = {
  id: string;
  nameEn: string;
  nameHe: string;
  sizeSetId?: string | null;
};

type Category = CategoryOption & { children: CategoryOption[] };

type SizeSet = {
  id: string;
  key: string;
  nameHe: string;
  nameEn: string;
  sizes: string[];
};

type Variant = {
  id?: string;
  tempId?: string;
  color: string;
  size: string;
  sku: string;
  stockQuantity: number;
  priceOverride: number | string | null;
  salePrice: number | string | null;
  saleStart: string | null;
  saleEnd: string | null;
  isActive: boolean;
};

type ServerImage = {
  id: string;
  url: string;
  color?: string | null;
  altText?: string | null;
  altTextHe?: string | null;
  altTextEn?: string | null;
  sortOrder: number;
};

type ServerProduct = {
  id: string;
  nameHe: string;
  nameEn: string;
  descriptionHe?: string | null;
  descriptionEn?: string | null;
  slug: string;
  basePrice: string;
  categoryId: string;
  sizeSetId?: string | null;
  isFeatured: boolean;
  isActive: boolean;
  variants: Variant[];
  images: ServerImage[];
};

type Props = { product?: ServerProduct };

const LOW_STOCK_THRESHOLD = 5;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CUSTOM_SIZE = '__custom__';
/** Field paths rendered next to their inputs; anything else goes in the top banner. */
const INLINE_FIELD =
  /^(nameHe|nameEn|slug|basePrice|categoryId|images|variants\.\d+\.(color|size|sku|stockQuantity|priceOverride|salePrice|saleStart|saleEnd)|images\.\d+\.(altTextHe|altTextEn))$/;

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

/** Thrown after an error has already been shown to the admin. */
class ReportedError extends Error {}

const toNum = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === '' ? null : Number(value);

function toImageItem(img: ServerImage): ImageItem {
  return {
    key: img.id,
    id: img.id,
    url: img.url,
    color: img.color ?? '',
    altTextHe: img.altTextHe ?? '',
    altTextEn: img.altTextEn ?? img.altText ?? '',
  };
}

const imageMeta = (img: ImageItem) => ({
  color: img.color || null,
  altTextHe: img.altTextHe.trim() || null,
  altTextEn: img.altTextEn.trim() || null,
});

function variantPayload(v: Variant) {
  return {
    ...(v.id ? { id: v.id } : {}),
    color: v.color.trim(),
    size: v.size.trim(),
    sku: v.sku.trim(),
    stockQuantity: v.stockQuantity,
    priceOverride: toNum(v.priceOverride),
    salePrice: toNum(v.salePrice),
    saleStart: v.saleStart || null,
    saleEnd: v.saleEnd || null,
    isActive: v.isActive,
  };
}

export default function ProductForm({ product }: Props) {
  const t = useTranslations('admin.productForm');
  const locale = useLocale();
  const router = useRouter();
  const isEdit = !!product;
  const productId = product?.id;

  const [nameHe, setNameHe] = useState(product?.nameHe || '');
  const [nameEn, setNameEn] = useState(product?.nameEn || '');
  const [descHe, setDescHe] = useState(product?.descriptionHe || '');
  const [descEn, setDescEn] = useState(product?.descriptionEn || '');
  const [slug, setSlug] = useState(product?.slug || '');
  const [basePrice, setBasePrice] = useState(product ? parseFloat(product.basePrice).toString() : '');
  const [categoryId, setCategoryId] = useState(product?.categoryId || '');
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured || false);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [sizeSetId, setSizeSetId] = useState<string>(product?.sizeSetId ?? '');
  const [sizeSetTouched, setSizeSetTouched] = useState(isEdit);
  const [autoSlug, setAutoSlug] = useState(!isEdit);

  const [categories, setCategories] = useState<Category[]>([]);
  const [sizeSets, setSizeSets] = useState<SizeSet[]>([]);
  const [variants, setVariants] = useState<Variant[]>(product?.variants || []);
  const [images, setImages] = useState<ImageItem[]>(() => (product?.images ?? []).map(toImageItem));
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [quickColor, setQuickColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [showVariants, setShowVariants] = useState(true);
  const [showImages, setShowImages] = useState(true);
  const formRef = useRef<HTMLDivElement>(null);

  const initialImageOrder = useRef((product?.images ?? []).map((img) => img.id).join(','));

  const catName = (c: CategoryOption) => (locale === 'he' ? c.nameHe : c.nameEn) || c.nameEn;
  const setName = (s: SizeSet) => (locale === 'he' ? s.nameHe : s.nameEn);

  const currentSizeSet = sizeSets.find((s) => s.id === sizeSetId);
  const setSizes = useMemo(() => currentSizeSet?.sizes ?? [], [currentSizeSet]);
  const colors = useMemo(
    () => [...new Set(variants.map((v) => v.color.trim()).filter(Boolean))],
    [variants],
  );

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data));
    api.get('/size-sets').then((res) => setSizeSets(res.data));
  }, []);

  // Release blob previews when the form goes away
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(
    () => () => {
      imagesRef.current.forEach((img) => img.file && URL.revokeObjectURL(img.url));
    },
    [],
  );

  useEffect(() => {
    if (autoSlug) setSlug(slugify(nameEn));
  }, [nameEn, autoSlug]);

  // Default the size set from the category (children inherit from the parent)
  useEffect(() => {
    if (sizeSetTouched || !categoryId || categories.length === 0) return;
    for (const parent of categories) {
      const match = parent.id === categoryId ? parent : parent.children?.find((c) => c.id === categoryId);
      if (match) {
        setSizeSetId(match.sizeSetId ?? parent.sizeSetId ?? '');
        return;
      }
    }
  }, [categoryId, categories, sizeSetTouched]);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const e = (key: string, values?: Record<string, string | number>) => t(`errors.${key}`, values);
    if (!nameEn.trim()) errors.nameEn = t('validation.nameEnRequired');
    if (!nameHe.trim()) errors.nameHe = t('validation.nameHeRequired');
    if (!slug.trim()) errors.slug = t('validation.slugRequired');
    else if (!SLUG_PATTERN.test(slug.trim())) errors.slug = e('slugInvalid');
    const base = parseFloat(basePrice);
    if (!basePrice) errors.basePrice = t('validation.priceRequired');
    else if (!(base > 0)) errors.basePrice = t('validation.pricePositive');
    if (!categoryId) errors.categoryId = t('validation.categoryRequired');

    const skus = new Set<string>();
    const combos = new Set<string>();
    variants.forEach((v, i) => {
      const at = (field: string) => `variants.${i}.${field}`;
      if (!v.color.trim()) errors[at('color')] = e('required');
      if (!v.size.trim()) errors[at('size')] = e('required');
      if (!v.sku.trim()) errors[at('sku')] = e('required');
      else if (skus.has(v.sku.trim().toLowerCase())) errors[at('sku')] = e('skuDuplicate');
      skus.add(v.sku.trim().toLowerCase());
      const combo = `${v.color.trim().toLowerCase()}|${v.size.trim().toLowerCase()}`;
      if (v.color.trim() && v.size.trim()) {
        if (combos.has(combo)) errors[at('size')] = e('variantDuplicate');
        combos.add(combo);
      }
      if (!Number.isInteger(v.stockQuantity) || v.stockQuantity < 0) errors[at('stockQuantity')] = e('mustBeNonNegative');
      const override = toNum(v.priceOverride);
      if (override !== null && !(override > 0)) errors[at('priceOverride')] = e('mustBePositive');
      const sale = toNum(v.salePrice);
      if (sale !== null) {
        if (!(sale > 0)) errors[at('salePrice')] = e('mustBePositive');
        else if (sale >= (override ?? base)) errors[at('salePrice')] = e('saleBelowPrice');
      }
      if (v.saleStart && v.saleEnd && new Date(v.saleEnd) <= new Date(v.saleStart)) {
        errors[at('saleEnd')] = e('saleDateRange');
      }
    });
    return errors;
  };

  useEffect(() => {
    if (submitted) setClientErrors(validate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameEn, nameHe, slug, basePrice, categoryId, variants, submitted]);

  // Client errors win; a server error is cleared once the admin edits that field
  const fieldErrors: FieldErrors = { ...serverErrors, ...clientErrors };
  const bannerErrors = Object.entries(serverErrors).filter(([field]) => !INLINE_FIELD.test(field));

  const clearServerError = (...fields: string[]) => {
    if (!fields.some((f) => serverErrors[f])) return;
    setServerErrors((prev) => {
      const next = { ...prev };
      fields.forEach((f) => delete next[f]);
      return next;
    });
  };

  // Bumped to move focus to the first invalid field once errors have rendered
  const [focusRequest, setFocusRequest] = useState(0);
  const focusFirstError = () => setFocusRequest((n) => n + 1);
  useEffect(() => {
    if (focusRequest === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  const handleRequestError = (err: unknown, prefix = '') => {
    const { status, data } = responseOf(err);
    const fields = serverFieldErrors(data);
    if ((status === 400 || status === 409) && fields.length > 0) {
      setServerErrors((prev) => ({ ...prev, ...translateFieldErrors(fields, t, prefix) }));
      setError(status === 409 ? t('conflictBanner') : t('fixErrors'));
      focusFirstError();
    } else {
      setError(t('saveFailed'));
    }
  };

  const productPayload = () => ({
    nameHe: nameHe.trim(),
    nameEn: nameEn.trim(),
    descriptionHe: descHe.trim() || null,
    descriptionEn: descEn.trim() || null,
    slug: slug.trim(),
    basePrice: parseFloat(basePrice),
    categoryId,
    sizeSetId: sizeSetId || null,
    isFeatured,
    isActive,
    variants: variants.map(variantPayload),
  });

  const createProduct = async () => {
    const form = new FormData();
    form.append('payload', JSON.stringify({ ...productPayload(), images: images.map(imageMeta) }));
    images.forEach((img) => img.file && form.append('images', img.file, img.file.name));
    await api.post('/admin/products', form);
  };

  /**
   * Edit: product + variants are saved atomically first; then image changes
   * are applied. Local state is synced after each step so a retry after a
   * partial failure doesn't re-create anything.
   */
  const updateProduct = async () => {
    const res = await api.put(`/admin/products/${productId}`, productPayload());
    setVariants(res.data.variants);

    for (const id of removedImageIds) {
      await api.delete(`/admin/images/${id}`);
      setRemovedImageIds((prev) => prev.filter((x) => x !== id));
    }

    const finalIds: string[] = [];
    let current = images;
    for (let i = 0; i < current.length; i++) {
      const img = current[i];
      try {
        if (img.file) {
          const form = new FormData();
          form.append('file', img.file, img.file.name);
          Object.entries(imageMeta(img)).forEach(([k, v]) => v && form.append(k, v));
          const uploaded = await api.post(`/admin/products/${productId}/images`, form);
          URL.revokeObjectURL(img.url);
          const saved = { ...toImageItem(uploaded.data), key: img.key };
          current = current.map((x) => (x.key === img.key ? saved : x));
          setImages(current);
          finalIds.push(saved.id!);
        } else {
          if (img.dirty) {
            await api.patch(`/admin/images/${img.id}`, imageMeta(img));
            current = current.map((x) => (x.key === img.key ? { ...x, dirty: false } : x));
            setImages(current);
          }
          finalIds.push(img.id!);
        }
      } catch (err) {
        handleRequestError(err, `images.${i}`);
        throw new ReportedError();
      }
    }

    if (finalIds.join(',') !== initialImageOrder.current && finalIds.length > 0) {
      await api.put(`/admin/products/${productId}/images/order`, { imageIds: finalIds });
      initialImageOrder.current = finalIds.join(',');
    }
  };

  const handleSave = async () => {
    setSubmitted(true);
    const errors = validate();
    setClientErrors(errors);
    setServerErrors({});
    if (Object.keys(errors).length > 0) {
      setError(t('fixErrors'));
      focusFirstError();
      return;
    }

    setError('');
    setSaving(true);
    try {
      if (isEdit) await updateProduct();
      else await createProduct();
      router.push('/admin/products');
    } catch (err) {
      if (!(err instanceof ReportedError)) handleRequestError(err);
    } finally {
      setSaving(false);
    }
  };

  const newVariant = (patch: Partial<Variant> = {}): Variant => ({
    tempId: crypto.randomUUID(),
    color: '',
    size: setSizes[0] ?? '',
    sku: '',
    stockQuantity: 0,
    priceOverride: null,
    salePrice: null,
    saleStart: null,
    saleEnd: null,
    isActive: true,
    ...patch,
  });

  const addVariant = () => setVariants([...variants, newVariant()]);

  /** Adds one variant per size of the current size set for a color. */
  const addAllSizes = () => {
    const color = quickColor.trim();
    if (!color || setSizes.length === 0) return;
    const existing = new Set(
      variants.filter((v) => v.color.trim().toLowerCase() === color.toLowerCase()).map((v) => v.size),
    );
    const prefix = slugify(slug || nameEn) || 'sku';
    const added = setSizes
      .filter((size) => !existing.has(size))
      .map((size) => newVariant({ color, size, sku: `${prefix}-${slugify(color)}-${size.toLowerCase()}` }));
    setVariants([...variants, ...added]);
    setQuickColor('');
  };

  const updateVariant = <K extends keyof Variant>(index: number, field: K, value: Variant[K]) => {
    setVariants(variants.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
    clearServerError(`variants.${index}.${field}`, ...(field === 'sku' ? ['sku'] : []));
  };

  const removeVariant = async (index: number) => {
    const v = variants[index];
    if (v.id) {
      if (!confirm(t('deleteVariant'))) return;
      try {
        await api.delete(`/admin/variants/${v.id}`);
      } catch {
        setError(t('saveFailed'));
        return;
      }
    }
    setVariants(variants.filter((_, i) => i !== index));
    // Indices shift, so stale server errors for variants no longer line up
    setServerErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('variants.'))));
  };

  const removeImage = (img: ImageItem) => {
    if (img.id && !confirm(t('deleteImageConfirm'))) return;
    if (img.id) setRemovedImageIds((prev) => [...prev, img.id!]);
    if (img.file) URL.revokeObjectURL(img.url);
    setImages(images.filter((x) => x.key !== img.key));
    setServerErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('images.'))));
  };

  const textField = (field: 'nameEn' | 'nameHe' | 'slug' | 'basePrice', setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      clearServerError(field);
    };

  return (
    <div ref={formRef} className="max-w-4xl space-y-6 font-body">
      {error && (
        <div
          role="alert"
          className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </p>
          {bannerErrors.length > 0 && (
            <ul className="list-disc ps-6 text-xs">
              {bannerErrors.map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Basic Info */}
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
                value={nameEn}
                onChange={textField('nameEn', setNameEn)}
                aria-invalid={!!fieldErrors.nameEn}
              />
              <FieldError message={fieldErrors.nameEn} />
            </div>
            <div>
              <RequiredLabel htmlFor="product-name-he">{t('nameHe')}</RequiredLabel>
              <Input
                id="product-name-he"
                type="text"
                dir="rtl"
                value={nameHe}
                onChange={textField('nameHe', setNameHe)}
                aria-invalid={!!fieldErrors.nameHe}
              />
              <FieldError message={fieldErrors.nameHe} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="product-desc-en" className="mb-1 text-xs font-medium text-muted-foreground font-body">
                {t('descriptionEn')}
              </Label>
              <Textarea
                id="product-desc-en"
                dir="ltr"
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <RequiredLabel htmlFor="product-slug">{t('slug')}</RequiredLabel>
              <Input
                id="product-slug"
                type="text"
                dir="ltr"
                value={slug}
                onChange={(e) => {
                  textField('slug', setSlug)(e);
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
                onChange={textField('basePrice', setBasePrice)}
                aria-invalid={!!fieldErrors.basePrice}
              />
              <FieldError message={fieldErrors.basePrice} />
            </div>
            <div>
              <RequiredLabel htmlFor="product-category">{t('category')}</RequiredLabel>
              <select
                id="product-category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  clearServerError('categoryId');
                }}
                className={selectClassName(!!fieldErrors.categoryId)}
                aria-invalid={!!fieldErrors.categoryId}
              >
                <option value="">{t('selectCategory')}</option>
                {categories.map((cat) => (
                  <optgroup key={cat.id} label={catName(cat)}>
                    <option value={cat.id}>{catName(cat)}</option>
                    {cat.children?.map((child) => (
                      <option key={child.id} value={child.id}>
                        &nbsp;&nbsp;{catName(child)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <FieldError message={fieldErrors.categoryId} />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
            <Label htmlFor="product-active" className="cursor-pointer items-start text-sm font-body">
              <input
                id="product-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mt-0.5 accent-ocean-700"
              />
              <span>
                {t('visibleInStore')}
                <span className="block text-xs font-normal text-muted-foreground">
                  {isActive ? t('visibleHint') : t('hiddenHint')}
                </span>
              </span>
            </Label>
            <Label htmlFor="product-featured" className="cursor-pointer items-start text-sm font-body">
              <input
                id="product-featured"
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="mt-0.5 accent-ocean-700"
              />
              {t('featured')}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader className="pb-0">
          <button
            type="button"
            onClick={() => setShowImages(!showImages)}
            className="flex w-full items-center justify-between"
            aria-expanded={showImages}
          >
            <CardTitle className="font-serif text-lg">{`${t('images')} (${images.length})`}</CardTitle>
            {showImages ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
          </button>
        </CardHeader>
        {showImages && (
          <CardContent className="space-y-2 pt-4">
            <p className="text-xs text-muted-foreground">{t('imagesHint')}</p>
            <ProductImagesManager
              images={images}
              onChange={setImages}
              onRemove={removeImage}
              colors={colors}
              errors={fieldErrors}
              disabled={saving}
            />
          </CardContent>
        )}
      </Card>

      {/* Variants */}
      <Card>
        <CardHeader className="pb-0">
          <button
            type="button"
            onClick={() => setShowVariants(!showVariants)}
            className="flex w-full items-center justify-between"
            aria-expanded={showVariants}
          >
            <CardTitle className="font-serif text-lg">{`${t('variants')} (${variants.length})`}</CardTitle>
            {showVariants ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
          </button>
        </CardHeader>

        {showVariants && (
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-1 gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="product-size-set" className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('sizeSet')}
                </Label>
                <select
                  id="product-size-set"
                  value={sizeSetId}
                  onChange={(e) => {
                    setSizeSetId(e.target.value);
                    setSizeSetTouched(true);
                  }}
                  className={selectClassName()}
                >
                  {sizeSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {setName(s)}
                    </option>
                  ))}
                  <option value="">{t('customSizes')}</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currentSizeSet ? currentSizeSet.sizes.join(' · ') : t('customSizesHint')}
                </p>
              </div>
              {setSizes.length > 0 && (
                <div>
                  <Label htmlFor="quick-color" className="mb-1 text-xs font-medium text-muted-foreground">
                    {t('quickAddColor')}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="quick-color"
                      value={quickColor}
                      onChange={(e) => setQuickColor(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAllSizes())}
                      placeholder={t('colorPlaceholder')}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addAllSizes} disabled={!quickColor.trim()} className="shrink-0">
                      <Layers size={14} /> {t('addAllSizes')}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {variants.map((v, i) => {
              const variantKey = v.id ?? v.tempId ?? `v-${i}`;
              const err = (field: string) => fieldErrors[`variants.${i}.${field}`];
              const isCustomSize = setSizes.length === 0 || !setSizes.includes(v.size);
              return (
                <div
                  key={variantKey}
                  data-testid="variant-row"
                  className={cn(
                    'space-y-2 rounded-lg border p-3',
                    v.stockQuantity > 0 && v.stockQuantity <= LOW_STOCK_THRESHOLD
                      ? 'border-amber-300 bg-amber-50'
                      : v.stockQuantity === 0
                        ? 'border-destructive/20 bg-destructive/5'
                        : 'border-border',
                  )}
                >
                  <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_110px_1fr_90px_100px_32px]">
                    <div>
                      <Label htmlFor={`${variantKey}-color`} className="mb-0.5 text-xs text-muted-foreground font-body">
                        {t('color')}
                      </Label>
                      <Input
                        id={`${variantKey}-color`}
                        type="text"
                        value={v.color}
                        onChange={(e) => updateVariant(i, 'color', e.target.value)}
                        aria-invalid={!!err('color')}
                      />
                      <FieldError message={err('color')} />
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-size`} className="mb-0.5 text-xs text-muted-foreground font-body">
                        {t('size')}
                      </Label>
                      {setSizes.length > 0 && (
                        <select
                          id={`${variantKey}-size`}
                          value={isCustomSize ? CUSTOM_SIZE : v.size}
                          onChange={(e) => updateVariant(i, 'size', e.target.value === CUSTOM_SIZE ? '' : e.target.value)}
                          className={selectClassName(!!err('size') && !isCustomSize)}
                          aria-invalid={!!err('size') && !isCustomSize}
                        >
                          {setSizes.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                          <option value={CUSTOM_SIZE}>{t('customSize')}</option>
                        </select>
                      )}
                      {isCustomSize && (
                        <Input
                          id={setSizes.length > 0 ? `${variantKey}-size-custom` : `${variantKey}-size`}
                          type="text"
                          dir="ltr"
                          value={v.size}
                          maxLength={20}
                          placeholder={t('customSizePlaceholder')}
                          aria-label={t('customSize')}
                          onChange={(e) => updateVariant(i, 'size', e.target.value)}
                          aria-invalid={!!err('size')}
                          className={cn(setSizes.length > 0 && 'mt-1')}
                        />
                      )}
                      <FieldError message={err('size')} />
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-sku`} className="mb-0.5 text-xs text-muted-foreground font-body">
                        {t('sku')}
                      </Label>
                      <Input
                        id={`${variantKey}-sku`}
                        type="text"
                        dir="ltr"
                        value={v.sku}
                        onChange={(e) => updateVariant(i, 'sku', e.target.value)}
                        aria-invalid={!!err('sku')}
                      />
                      <FieldError message={err('sku')} />
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
                          step="1"
                          value={v.stockQuantity}
                          onChange={(e) => updateVariant(i, 'stockQuantity', e.target.value === '' ? 0 : Number(e.target.value))}
                          aria-invalid={!!err('stockQuantity')}
                        />
                        {v.stockQuantity > 0 && v.stockQuantity <= LOW_STOCK_THRESHOLD && (
                          <AlertTriangle size={12} className="absolute end-2 top-1/2 -translate-y-1/2 text-amber-500" />
                        )}
                      </div>
                      <FieldError message={err('stockQuantity')} />
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-price`} className="mb-0.5 text-xs text-muted-foreground font-body">
                        {t('price')}
                      </Label>
                      <Input
                        id={`${variantKey}-price`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={v.priceOverride ?? ''}
                        placeholder={basePrice}
                        onChange={(e) => updateVariant(i, 'priceOverride', e.target.value || null)}
                        aria-invalid={!!err('priceOverride')}
                      />
                      <FieldError message={err('priceOverride')} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeVariant(i)}
                      aria-label={t('removeVariant')}
                      className="mt-5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  {/* Sale price row */}
                  <div className="grid grid-cols-1 gap-3 border-t border-dashed border-border pt-1 sm:grid-cols-3">
                    <div>
                      <Label htmlFor={`${variantKey}-sale-price`} className="mb-0.5 text-xs text-destructive font-body">
                        {t('salePrice')}
                      </Label>
                      <Input
                        id={`${variantKey}-sale-price`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={v.salePrice ?? ''}
                        onChange={(e) => updateVariant(i, 'salePrice', e.target.value || null)}
                        aria-invalid={!!err('salePrice')}
                      />
                      <FieldError message={err('salePrice')} />
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-sale-start`} className="mb-0.5 text-xs text-destructive font-body">
                        {t('saleStart')}
                      </Label>
                      <Input
                        id={`${variantKey}-sale-start`}
                        type="date"
                        value={v.saleStart ? v.saleStart.split('T')[0] : ''}
                        onChange={(e) => updateVariant(i, 'saleStart', e.target.value || null)}
                        aria-invalid={!!err('saleStart')}
                      />
                      <FieldError message={err('saleStart')} />
                    </div>
                    <div>
                      <Label htmlFor={`${variantKey}-sale-end`} className="mb-0.5 text-xs text-destructive font-body">
                        {t('saleEnd')}
                      </Label>
                      <Input
                        id={`${variantKey}-sale-end`}
                        type="date"
                        value={v.saleEnd ? v.saleEnd.split('T')[0] : ''}
                        onChange={(e) => updateVariant(i, 'saleEnd', e.target.value || null)}
                        aria-invalid={!!err('saleEnd')}
                      />
                      <FieldError message={err('saleEnd')} />
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
        <Button type="button" variant="outline" onClick={() => router.push('/admin/products')} className="px-6">
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
