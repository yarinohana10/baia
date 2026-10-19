import type { Variant } from './stock-variants';

export type CategoryOption = {
  id: string;
  nameEn: string;
  nameHe: string;
  sizeSetId?: string | null;
};

export type ProductCategory = CategoryOption & { children: CategoryOption[] };

export type ServerImage = {
  id: string;
  url: string;
  color?: string | null;
  altText?: string | null;
  altTextHe?: string | null;
  altTextEn?: string | null;
  sortOrder: number;
};

/** A product as GET /admin/products/:id returns it. */
export type ServerProduct = {
  id: string;
  nameHe: string;
  nameEn: string;
  descriptionHe?: string | null;
  descriptionEn?: string | null;
  fabricHe?: string | null;
  fabricEn?: string | null;
  careHe?: string | null;
  careEn?: string | null;
  fitHe?: string | null;
  fitEn?: string | null;
  slug: string;
  basePrice: string;
  categoryId: string;
  sizeSetId?: string | null;
  isFeatured: boolean;
  isActive: boolean;
  variants: Variant[];
  images: ServerImage[];
};

/**
 * The size set a category implies: its own, else its parent's ('' = custom
 * sizes). Undefined when the category isn't in the list.
 */
export function categorySizeSet(categories: ProductCategory[], categoryId: string): string | undefined {
  for (const parent of categories) {
    const match = parent.id === categoryId ? parent : parent.children?.find((c) => c.id === categoryId);
    if (match) return match.sizeSetId ?? parent.sizeSetId ?? '';
  }
  return undefined;
}
