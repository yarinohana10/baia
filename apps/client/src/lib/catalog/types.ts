export type Variant = {
  id: string;
  color: string;
  size: string;
  sku?: string;
  stockQuantity: number;
  /** false = unlimited stock (stockQuantity is ignored). */
  trackInventory?: boolean;
  isActive?: boolean;
  priceOverride: string | null;
  salePrice: string | null;
  saleStart: string | null;
  saleEnd: string | null;
};

export type ProductImage = { id?: string; url: string; color?: string | null };

export type CategoryRef = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  parentId?: string | null;
  parent?: CategoryRef | null;
};

export type Product = {
  id: string;
  nameHe: string;
  nameEn: string;
  descriptionHe?: string | null;
  descriptionEn?: string | null;
  slug: string;
  basePrice: string;
  isFeatured?: boolean;
  createdAt?: string;
  updatedAt?: string;
  category?: CategoryRef;
  images: ProductImage[];
  variants: Variant[];
};

export type Category = CategoryRef & {
  image: string | null;
  sortOrder?: number;
  children?: Category[];
};

export type ProductList = {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type SiteConfig = {
  shippingCost: string | null;
  freeShippingThreshold: string | null;
  heroImageUrl: string | null;
  heroTitleHe: string | null;
  heroTitleEn: string | null;
  heroSubtitleHe: string | null;
  heroSubtitleEn: string | null;
  heroCtaUrl: string | null;
};

export type SortOption = 'newest' | 'price-asc' | 'price-desc';

/** The trimmed shape ProductCard needs — keeps RSC payloads small. */
export type CardProduct = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  basePrice: string;
  createdAt?: string;
  images: { url: string; color?: string | null }[];
  variants: {
    id?: string;
    color?: string;
    size?: string;
    salePrice?: string | null;
    saleStart?: string | null;
    saleEnd?: string | null;
    priceOverride?: string | null;
    stockQuantity?: number;
    trackInventory?: boolean;
  }[];
};
