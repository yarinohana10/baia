'use client';

import { useCallback, useMemo, useReducer, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import type { ImageItem } from '@/components/admin/ProductImagesManager';
import { responseOf, serverFieldErrors, translateFieldErrors, type FieldErrors } from '@/components/admin/product-form-errors';
import { createProduct, ReportedError, updateProduct } from '@/components/admin/product-form/persist-product';
import { withLoadedStock } from '@/components/admin/product-form/stock-variants';
import { validateProduct } from '@/components/admin/product-form/validate-product';
import type { ProductCategory, ServerProduct } from '@/components/admin/product-form/types';
import { initialProductForm, productFormReducer } from './product-form';
import { INITIAL_SUBMISSION, productSubmissionReducer } from './product-submission';
import { useFocusFirstInvalid } from './useFocusFirstInvalid';
import { useProductOptions } from './useProductOptions';
import { useRevokeBlobUrlsOnUnmount } from './useRevokeBlobUrlsOnUnmount';

/** Field paths rendered next to their inputs; anything else goes in the top banner. */
const INLINE_FIELD =
  /^(nameHe|nameEn|slug|(fabric|care|fit)(He|En)|basePrice|categoryId|images|variants|variants\.\d+\.(color|size|sku|stockQuantity|trackInventory|priceOverride|salePrice|saleStart|saleEnd)|images\.\d+\.(altTextHe|altTextEn))$/;

const imageOrderOf = (product?: ServerProduct) => (product?.images ?? []).map((img) => img.id).join(',');

/** State, validation and saving of the create / edit product form. */
export function useProductForm(product?: ServerProduct) {
  const t = useTranslations('admin.productForm');
  const router = useRouter();
  const [form, dispatch] = useReducer(productFormReducer, product, initialProductForm);
  const [submission, dispatchSubmission] = useReducer(productSubmissionReducer, INITIAL_SUBMISSION);
  const formRef = useRef<HTMLDivElement>(null);
  const focusFirstError = useFocusFirstInvalid(formRef);
  const removedImageIds = useRef<string[]>([]);
  const savedImageOrder = useRef<string | null>(null);

  const onCategories = useCallback((categories: ProductCategory[]) => dispatch({ type: 'categoriesLoaded', categories }), []);
  const { categories, sizeSets } = useProductOptions(onCategories);
  useRevokeBlobUrlsOnUnmount(form.images);

  const clientErrors = useMemo(
    () => (submission.submitted ? validateProduct(form, t) : {}),
    [submission.submitted, form, t],
  );
  // Client errors win; a server error is cleared once the admin edits that field
  const fieldErrors: FieldErrors = { ...submission.serverErrors, ...clientErrors };
  const bannerErrors = Object.entries(submission.serverErrors).filter(([field]) => !INLINE_FIELD.test(field));

  const clearServerError = useCallback((...fields: string[]) => dispatchSubmission({ type: 'fieldsEdited', fields }), []);

  const handleRequestError = (err: unknown, prefix = '') => {
    const { status, data } = responseOf(err);
    const fields = serverFieldErrors(data);
    if ((status === 400 || status === 409) && fields.length > 0) {
      dispatchSubmission({
        type: 'failed',
        error: status === 409 ? t('conflictBanner') : t('fixErrors'),
        serverErrors: translateFieldErrors(fields, t, prefix),
      });
      focusFirstError();
    } else {
      dispatchSubmission({ type: 'failed', error: t('saveFailed') });
    }
  };

  const persist = () => {
    if (!product) return createProduct(form);
    savedImageOrder.current ??= imageOrderOf(product);
    return updateProduct({
      productId: product.id,
      form,
      removedImageIds,
      savedImageOrder,
      onVariantsSaved: (variants) => dispatch({ type: 'variants', variants: variants.map(withLoadedStock) }),
      onImagesSaved: (images) => dispatch({ type: 'images', images }),
      onImageError: (err, index) => handleRequestError(err, `images.${index}`),
    });
  };

  const save = async () => {
    dispatchSubmission({ type: 'attempt' });
    if (Object.keys(validateProduct(form, t)).length > 0) {
      dispatchSubmission({ type: 'invalid', error: t('fixErrors') });
      focusFirstError();
      return;
    }
    dispatchSubmission({ type: 'start' });
    try {
      await persist();
      await revalidateCatalog();
      router.push('/admin/products');
    } catch (err) {
      if (!(err instanceof ReportedError)) handleRequestError(err);
    } finally {
      dispatchSubmission({ type: 'settled' });
    }
  };

  const removeImage = (img: ImageItem) => {
    if (img.id && !confirm(t('deleteImageConfirm'))) return;
    if (img.id) removedImageIds.current = [...removedImageIds.current, img.id];
    if (img.file) URL.revokeObjectURL(img.url);
    dispatch({ type: 'images', images: form.images.filter((x) => x.key !== img.key) });
    dispatchSubmission({ type: 'imagesChanged' });
  };

  return {
    form,
    dispatch,
    formRef,
    categories,
    sizeSets,
    fieldErrors,
    bannerErrors,
    error: submission.error,
    saving: submission.saving,
    isEdit: !!product,
    save,
    removeImage,
    clearServerError,
    cancel: () => router.push('/admin/products'),
  };
}
