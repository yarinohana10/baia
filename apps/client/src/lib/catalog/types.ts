/** Computed by the API: what a shopper can do with a variant / product. */
export type Availability = 'in_stock' | 'low_stock' | 'sold_out' | 'back_soon' | 'hidden';

export type Variant = {
  id: string;
  color: string;
  size: string;
  sku?: string;
  stockQuantity: number;
  /** false = unlimited stock (stockQuantity is ignored). */
  trackInventory?: boolean;
  isActive?: boolean;
  availability?: Availability;
  priceOverride: string | null;
  salePrice: string | null;
  saleStart: string | null;
  saleEnd: string | null;
};

export type ProductImage = {
  id?: string;
  url: string;
  color?: string | null;
  altText?: string | null;
  altTextHe?: string | null;
  altTextEn?: string | null;
};

export type SizeSetRef = { id: string; key: string; nameHe: string; nameEn: string; sizes: string[] };

export type CategoryRef = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  parentId?: string | null;
  parent?: CategoryRef | null;
  /** Size guide linked to the category (null = inherit the parent's). */
  sizeGuideId?: string | null;
};

export type Product = {
  id: string;
  nameHe: string;
  nameEn: string;
  descriptionHe?: string | null;
  descriptionEn?: string | null;
  /** Product-page content (optional, bilingual). */
  fabricHe?: string | null;
  fabricEn?: string | null;
  careHe?: string | null;
  careEn?: string | null;
  fitHe?: string | null;
  fitEn?: string | null;
  slug: string;
  basePrice: string;
  isFeatured?: boolean;
  isActive?: boolean;
  /** Back Soon: visible but not purchasable (set by an Admin). */
  backSoon?: boolean;
  availability?: Availability;
  categoryId?: string;
  sizeSetId?: string | null;
  sizeSet?: SizeSetRef | null;
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
  /** Delivery: shippingCost is the courier price. */
  pickupPointCost: string | null;
  courierEtaDays: string;
  pickupEtaDays: string;
  /** Business details for the footer and legal pages (placeholders until registered). */
  businessName: string;
  companyId: string;
  businessAddress: string;
  businessPhone: string;
  contactEmail: string;
  /** Digits in international format; null hides the WhatsApp button. */
  whatsappNumber: string | null;
  accessibilityCoordinatorName: string;
  accessibilityCoordinatorPhone: string;
  accessibilityCoordinatorEmail: string;
  /** "Only N left" shows at or under this many units; the same threshold drives admin stock alerts. */
  lowStockThreshold?: number;
};

/** Filter options for a listing scope (`GET /products/facets`). */
export type Facets = {
  /** Sizes that are in stock right now, in size-set order. */
  sizes: { value: string; count: number }[];
  colors: { value: string; count: number }[];
  price: { min: number | null; max: number | null };
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
  /** Back Soon: shown disabled, not purchasable. */
  backSoon?: boolean;
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
