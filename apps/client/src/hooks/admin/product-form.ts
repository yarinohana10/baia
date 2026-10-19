import type { ImageItem } from '@/components/admin/ProductImagesManager';
import { emptyContent, type ProductContent } from '@/components/admin/product-form/product-content';
import { categorySizeSet, type ProductCategory, type ServerProduct } from '@/components/admin/product-form/types';
import { resyncAutoSkus, slugify, type Variant } from '@/components/admin/product-form/stock-variants';
import { toImageItem } from '@/components/admin/product-form/product-payload';

/** Everything the product form edits. */
export type ProductFormValues = {
  nameHe: string;
  nameEn: string;
  descHe: string;
  descEn: string;
  content: ProductContent;
  slug: string;
  basePrice: string;
  categoryId: string;
  isFeatured: boolean;
  isActive: boolean;
  sizeSetId: string;
  /** Once the admin picks a size set it no longer follows the category. */
  sizeSetTouched: boolean;
  /** The slug follows the English name until the admin edits it. */
  autoSlug: boolean;
  variants: Variant[];
  images: ImageItem[];
};

type TextField = 'nameHe' | 'descHe' | 'descEn' | 'basePrice';

export type ProductFormAction =
  | { type: 'text'; field: TextField; value: string }
  | { type: 'nameEn'; value: string }
  | { type: 'slug'; value: string }
  | { type: 'flag'; field: 'isActive' | 'isFeatured'; value: boolean }
  | { type: 'content'; content: ProductContent }
  | { type: 'category'; categoryId: string; categories: ProductCategory[] }
  | { type: 'categoriesLoaded'; categories: ProductCategory[] }
  | { type: 'sizeSet'; sizeSetId: string }
  | { type: 'variants'; variants: Variant[] }
  | { type: 'images'; images: ImageItem[] };

export function initialProductForm(product?: ServerProduct): ProductFormValues {
  return {
    nameHe: product?.nameHe || '',
    nameEn: product?.nameEn || '',
    descHe: product?.descriptionHe || '',
    descEn: product?.descriptionEn || '',
    content: emptyContent(product),
    slug: product?.slug || '',
    basePrice: product ? parseFloat(product.basePrice).toString() : '',
    categoryId: product?.categoryId || '',
    isFeatured: product?.isFeatured || false,
    isActive: product?.isActive ?? true,
    sizeSetId: product?.sizeSetId ?? '',
    sizeSetTouched: !!product,
    autoSlug: !product,
    variants: product?.variants || [],
    images: (product?.images ?? []).map(toImageItem),
  };
}

/** Generated SKUs are built from the slug, or the English name while there is none. */
export const skuPrefixOf = (f: Pick<ProductFormValues, 'slug' | 'nameEn'>) => f.slug || f.nameEn;

/** Re-generates auto SKUs when the prefix changed. */
function withSkuPrefix(prev: ProductFormValues, next: ProductFormValues): ProductFormValues {
  const prefix = skuPrefixOf(next);
  if (prefix === skuPrefixOf(prev)) return next;
  const variants = resyncAutoSkus(next.variants, prefix);
  return variants ? { ...next, variants } : next;
}

/** Until the admin picks a size set, it follows the chosen category (children inherit from the parent). */
function withCategorySizeSet(state: ProductFormValues, categories: ProductCategory[]): ProductFormValues {
  if (state.sizeSetTouched || !state.categoryId || categories.length === 0) return state;
  const sizeSetId = categorySizeSet(categories, state.categoryId);
  return sizeSetId === undefined || sizeSetId === state.sizeSetId ? state : { ...state, sizeSetId };
}

export function productFormReducer(state: ProductFormValues, action: ProductFormAction): ProductFormValues {
  switch (action.type) {
    case 'text':
      return { ...state, [action.field]: action.value };
    case 'nameEn':
      return withSkuPrefix(state, {
        ...state,
        nameEn: action.value,
        slug: state.autoSlug ? slugify(action.value) : state.slug,
      });
    case 'slug':
      return withSkuPrefix(state, { ...state, slug: action.value, autoSlug: false });
    case 'flag':
      return { ...state, [action.field]: action.value };
    case 'content':
      return { ...state, content: action.content };
    case 'category':
      return withCategorySizeSet({ ...state, categoryId: action.categoryId }, action.categories);
    case 'categoriesLoaded':
      return withCategorySizeSet(state, action.categories);
    case 'sizeSet':
      return { ...state, sizeSetId: action.sizeSetId, sizeSetTouched: true };
    case 'variants':
      return { ...state, variants: action.variants };
    case 'images':
      return { ...state, images: action.images };
  }
}
