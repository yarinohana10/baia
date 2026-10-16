'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Minus, Plus, ChevronRight, AlertTriangle } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { availableQty, formatPrice, isInStock, isSaleActive, lowStockCount } from '@/lib/catalog/pricing';
import { shopErrorMessage, type ErrorMessage } from '@/lib/shop-errors';
import { WishlistButton } from '@/components/storefront/WishlistButton';
import ProductGallery, { type GalleryImage } from '@/components/storefront/ProductGallery';

type Variant = {
  id: string;
  color: string;
  size: string;
  sku: string;
  stockQuantity: number;
  trackInventory?: boolean;
  priceOverride: string | null;
  salePrice: string | null;
  saleStart: string | null;
  saleEnd: string | null;
  isActive: boolean;
};

type ProductImage = GalleryImage;

type Product = {
  id: string;
  nameHe: string;
  nameEn: string;
  descriptionHe: string | null;
  descriptionEn: string | null;
  slug: string;
  basePrice: string;
  category: { nameHe: string; nameEn: string; slug: string; parent?: { nameHe: string; nameEn: string; slug: string } };
  variants: Variant[];
  images: ProductImage[];
};

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const locale = useLocale();
  const t = useTranslations('product');
  const tCart = useTranslations('cart');
  const tCommon = useTranslations('common');
  const tProduct = useTranslations('storefront.product');
  const tErrors = useTranslations('checkout.errors');

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<ErrorMessage | null>(null);

  useEffect(() => {
    api
      .get(`/products/${slug}`)
      .then((res) => {
        const data = res.data as Product;
        setProduct(data);
        // Prefer a colour that still has something in stock.
        const firstInStock = data.variants.find((v) => v.isActive && isInStock(v)) ?? data.variants[0];
        if (firstInStock) setSelectedColor(firstInStock.color);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const colors = useMemo(() => {
    if (!product) return [];
    return [...new Set(product.variants.map((v) => v.color))];
  }, [product]);

  const availableSizes = useMemo(() => {
    if (!product) return [];
    // The API returns variants already ordered by the product's size set
    return product.variants.filter((v) => v.color === selectedColor && v.isActive);
  }, [product, selectedColor]);

  // When the colour changes (or on load), preselect the first size that is in stock.
  useEffect(() => {
    if (availableSizes.length > 0 && !availableSizes.find((v) => v.size === selectedSize)) {
      setSelectedSize((availableSizes.find(isInStock) ?? availableSizes[0]).size);
    }
  }, [availableSizes, selectedSize]);

  const selectedVariant = useMemo(() => {
    return product?.variants.find((v) => v.color === selectedColor && v.size === selectedSize && v.isActive);
  }, [product, selectedColor, selectedSize]);

  const maxQuantity = selectedVariant ? availableQty(selectedVariant) : 0;
  const purchasable = !!selectedVariant && maxQuantity > 0;
  const lowStock = selectedVariant ? lowStockCount(selectedVariant) : null;

  // Keep the quantity within what the selected size can supply.
  useEffect(() => {
    setQuantity((q) => Math.max(1, Math.min(q, maxQuantity || 1)));
    setAddError(null);
  }, [selectedVariant?.id, maxQuantity]);

  const displayPrice = useMemo(() => {
    if (!product || !selectedVariant) return { current: 0, original: null };
    const base = parseFloat(selectedVariant.priceOverride || product.basePrice);

    if (isSaleActive(selectedVariant)) {
      return { current: parseFloat(selectedVariant.salePrice!), original: base };
    }
    return { current: base, original: null };
  }, [product, selectedVariant]);

  const filteredImages = useMemo(() => {
    if (!product) return [];
    const colorImages = product.images.filter(
      (img) => !img.color || img.color === selectedColor,
    );
    return colorImages.length > 0 ? colorImages : product.images;
  }, [product, selectedColor]);

  const { addItem, openDrawer, closeDrawer } = useCartStore();

  const handleAddToCart = async () => {
    if (!selectedVariant || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      await addItem(selectedVariant.id, quantity);
    } catch (err) {
      setAddError(shopErrorMessage(err, locale));
      return;
    } finally {
      setAdding(false);
    }
    closeDrawer();
    setTimeout(() => openDrawer(), 50);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="aspect-square bg-gray-200 rounded-xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 w-3/4" />
            <div className="h-6 bg-gray-200 w-1/4" />
            <div className="h-20 bg-gray-200 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto py-20 px-4 text-center text-gray-400">
        {tProduct('notFound')}
      </div>
    );
  }

  const name = locale === 'he' ? product.nameHe : product.nameEn;
  const description = locale === 'he' ? product.descriptionHe : product.descriptionEn;
  const catName = locale === 'he' ? product.category.nameHe : product.category.nameEn;
  const parentCatName = product.category.parent
    ? locale === 'he'
      ? product.category.parent.nameHe
      : product.category.parent.nameEn
    : null;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Breadcrumbs */}
      <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-400 mb-8">
        <Link href="/" className="hover:text-ocean-600 transition-colors">{tCommon('home')}</Link>
        <ChevronRight size={10} className="rtl:rotate-180" />
        {parentCatName && product.category.parent && (
          <>
            <Link href={`/category/${product.category.parent.slug}`} className="hover:text-ocean-600 transition-colors">
              {parentCatName}
            </Link>
            <ChevronRight size={10} className="rtl:rotate-180" />
          </>
        )}
        <Link href={`/category/${product.category.slug}`} className="hover:text-ocean-600 transition-colors">
          {catName}
        </Link>
        <ChevronRight size={10} className="rtl:rotate-180" />
        <span aria-current="page" className="text-gray-600">{name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
        {/* Images */}
        <ProductGallery images={filteredImages} productName={name} />

        {/* Details */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-normal mb-3">{name}</h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-6">
            <span
              className={`text-2xl font-medium ${
                displayPrice.original ? 'text-red-500' : 'text-charcoal'
              }`}
            >
              {formatPrice(displayPrice.current)}
            </span>
            {displayPrice.original && (
              <span className="text-lg text-gray-400 line-through">
                {formatPrice(displayPrice.original)}
              </span>
            )}
          </div>

          {/* Color */}
          {colors.length > 1 && (
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                {t('color')}: {selectedColor}
              </label>
              <div className="flex gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    aria-pressed={selectedColor === color}
                    className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                      selectedColor === color
                        ? 'border-ocean-700 bg-ocean-700 text-white'
                        : 'border-gray-300 hover:border-ocean-500'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size */}
          <div className="mb-6">
            <span
              id="size-label"
              className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider"
            >
              {t('size')}
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="size-label">
              {availableSizes.map((v) => (
                <button
                  key={v.size}
                  onClick={() => setSelectedSize(v.size)}
                  disabled={!isInStock(v)}
                  aria-label={`${t('size')} ${v.size}`}
                  aria-pressed={selectedSize === v.size}
                  className={`w-11 h-11 text-sm border rounded-lg transition-colors ${
                    selectedSize === v.size
                      ? 'border-ocean-700 bg-ocean-700 text-white'
                      : !isInStock(v)
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                      : 'border-gray-300 hover:border-ocean-500'
                  }`}
                >
                  {v.size}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                aria-label={tCart('decreaseQuantity')}
                className="px-3 py-2.5 text-gray-500 hover:text-ocean-600 transition-colors disabled:text-gray-300"
              >
                <Minus size={14} />
              </button>
              <span className="px-4 py-2.5 text-sm min-w-[3rem] text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(Math.max(1, maxQuantity), quantity + 1))}
                disabled={quantity >= maxQuantity}
                aria-label={tCart('increaseQuantity')}
                className="px-3 py-2.5 text-gray-500 hover:text-ocean-600 transition-colors disabled:text-gray-300"
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!purchasable || adding}
              aria-busy={adding}
              className={`flex-1 py-3 text-sm font-medium tracking-wider uppercase rounded-lg transition-colors ${
                !purchasable
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-ocean-700 text-white hover:bg-ocean-800 disabled:opacity-70'
              }`}
            >
              {!purchasable ? t('outOfStock') : adding ? tProduct('adding') : t('addToCart')}
            </button>

            <WishlistButton
              product={product}
              iconSize={18}
              className="p-3 border rounded-lg transition-colors"
              activeClassName="border-red-300 text-red-500"
              inactiveClassName="border-gray-300 text-gray-400 hover:text-red-500 hover:border-red-300"
            />
          </div>

          {(lowStock !== null || addError) && (
            <div className="-mt-3 mb-6 space-y-1">
              {lowStock !== null && (
                <p className="text-xs text-amber-600">{tProduct('lowStock', { count: lowStock })}</p>
              )}
              {addError && (
                <p role="alert" className="text-xs text-red-500 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="shrink-0" /> {tErrors(addError.key, addError.values)}
                </p>
              )}
            </div>
          )}

          {/* SKU */}
          {selectedVariant && (
            <p className="text-xs text-gray-400 mb-6">{tProduct('sku', { sku: selectedVariant.sku })}</p>
          )}

          {/* Description */}
          {description && (
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">
                {t('description')}
              </h2>
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {description}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
