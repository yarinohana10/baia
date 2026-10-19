import type { MutableRefObject } from 'react';
import { api } from '@/lib/api';
import type { ImageItem } from '../ProductImagesManager';
import type { ProductFormValues } from '@/hooks/admin/product-form';
import { imageMeta, productPayload, toImageItem } from './product-payload';
import type { Variant } from './stock-variants';

/** Thrown after an error has already been shown to the admin. */
export class ReportedError extends Error {}

/** Create: one multipart request with the product, the image metadata and the files. */
export async function createProduct(form: ProductFormValues) {
  const body = new FormData();
  body.append('payload', JSON.stringify({ ...productPayload(form), images: form.images.map(imageMeta) }));
  form.images.forEach((img) => img.file && body.append('images', img.file, img.file.name));
  await api.post('/admin/products', body);
}

type UpdateOptions = {
  productId: string;
  form: ProductFormValues;
  /** Saved images the admin removed; ids are dropped as they are deleted. */
  removedImageIds: MutableRefObject<string[]>;
  /** Comma-joined image ids in their saved order. */
  savedImageOrder: MutableRefObject<string | null>;
  onVariantsSaved: (variants: Variant[]) => void;
  onImagesSaved: (images: ImageItem[]) => void;
  /** Shows a failed image request's error (`index` is the image's position). */
  onImageError: (err: unknown, index: number) => void;
};

async function saveImage(productId: string, img: ImageItem): Promise<ImageItem> {
  if (img.file) {
    const body = new FormData();
    body.append('file', img.file, img.file.name);
    Object.entries(imageMeta(img)).forEach(([k, v]) => v && body.append(k, v));
    const uploaded = await api.post(`/admin/products/${productId}/images`, body);
    URL.revokeObjectURL(img.url);
    return { ...toImageItem(uploaded.data), key: img.key };
  }
  if (img.dirty) {
    await api.patch(`/admin/images/${img.id}`, imageMeta(img));
    return { ...img, dirty: false };
  }
  return img;
}

/**
 * Edit: product + variants are saved atomically first; then image changes
 * are applied. Local state is synced after each step so a retry after a
 * partial failure doesn't re-create anything.
 */
export async function updateProduct({
  productId,
  form,
  removedImageIds,
  savedImageOrder,
  onVariantsSaved,
  onImagesSaved,
  onImageError,
}: UpdateOptions) {
  const res = await api.put(`/admin/products/${productId}`, productPayload(form));
  onVariantsSaved(res.data.variants);

  for (const id of [...removedImageIds.current]) {
    await api.delete(`/admin/images/${id}`);
    removedImageIds.current = removedImageIds.current.filter((x) => x !== id);
  }

  let current = form.images;
  for (let i = 0; i < current.length; i++) {
    const img = current[i];
    try {
      const saved = await saveImage(productId, img);
      if (saved !== img) {
        current = current.map((x) => (x.key === img.key ? saved : x));
        onImagesSaved(current);
      }
    } catch (err) {
      onImageError(err, i);
      throw new ReportedError();
    }
  }

  const finalOrder = current.map((img) => img.id!).join(',');
  if (finalOrder !== savedImageOrder.current && current.length > 0) {
    await api.put(`/admin/products/${productId}/images/order`, { imageIds: current.map((img) => img.id!) });
    savedImageOrder.current = finalOrder;
  }
}
