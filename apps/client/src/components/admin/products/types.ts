export type ProductVariant = {
  id: string;
  stockQuantity: number;
  isActive: boolean;
  /** false = unlimited stock; stockQuantity is ignored. */
  trackInventory?: boolean;
};

export type AdminProduct = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  basePrice: string;
  isActive: boolean;
  isFeatured: boolean;
  category: { nameEn: string; nameHe: string };
  images: { url: string }[];
  variants: ProductVariant[];
  _count: { variants: number };
};

export type ProductsNotice = { kind: 'success' | 'info' | 'error'; text: string };
