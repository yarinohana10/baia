'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Minus, Plus, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { WishlistButton } from '@/components/storefront/WishlistButton';
import ProductGallery, { type GalleryImage } from '@/components/storefront/ProductGallery';

type Variant = {
  id: string;
  color: string;
  size: string;
  sku: string;
  stockQuantity: number;
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

function isSaleActive(v: Variant) {
  if (!v.salePrice) return false;
  const now = new Date();
  if (v.saleStart && now < new Date(v.saleStart)) return false;
  if (v.saleEnd && now > new Date(v.saleEnd)) return false;
  return true;
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const locale = useLocale();
  const t = useTranslations('product');
  const tCart = useTranslations('cart');
  const tCommon = useTranslations('common');

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    api
      .get(`/products/${slug}`)
      .then((res) => {
        setProduct(res.data);
        const colors = [...new Set(res.data.variants.map((v: Variant) => v.color))];
        if (colors.length > 0) setSelectedColor(colors[0] as string);
      })
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

  useEffect(() => {
    if (availableSizes.length > 0 && !availableSizes.find((v) => v.size === selectedSize)) {
      setSelectedSize(availableSizes[0].size);
    }
  }, [availableSizes, selectedSize]);

  const selectedVariant = useMemo(() => {
    return product?.variants.find((v) => v.color === selectedColor && v.size === selectedSize);
  }, [product, selectedColor, selectedSize]);

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
    if (!selectedVariant) return;
    try {
      await addItem(selectedVariant.id, quantity);
    } catch {
      // silently fail
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
        Product not found.
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
      <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-stone mb-8">
        <Link href="/" className="hover:text-ink hover:underline underline-offset-4">{tCommon('home')}</Link>
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
        <span aria-current="page" className="text-ink">{name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
        {/* Images */}
        <ProductGallery images={filteredImages} productName={name} />

        {/* Details */}
        <div>
          <h1 className="font-display text-3xl md:text-[42px] leading-tight text-ink mb-3">{name}</h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-6">
            <span
              className={`text-2xl font-semibold ${
                displayPrice.original ? 'text-coral' : 'text-ink'
              }`}
            >
              ₪{displayPrice.current.toFixed(2)}
            </span>
            {displayPrice.original && (
              <span className="text-lg text-stone line-through">
                ₪{displayPrice.original.toFixed(2)}
              </span>
            )}
          </div>

          {/* Color */}
          {colors.length > 1 && (
            <div className="mb-5">
              <p className="eyebrow text-stone mb-2">
                {t('color')}: <span className="text-ink">{selectedColor}</span>
              </p>
              <div className="flex gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    aria-pressed={selectedColor === color}
                    className={`px-4 py-2 text-sm font-semibold border rounded-full transition-colors ${
                      selectedColor === color
                        ? 'border-ink bg-ink text-white'
                        : 'border-sand-300 text-ink hover:border-ink'
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
              className="eyebrow block text-stone mb-2"
            >
              {t('size')}
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="size-label">
              {availableSizes.map((v) => (
                <button
                  key={v.size}
                  onClick={() => setSelectedSize(v.size)}
                  disabled={v.stockQuantity === 0}
                  aria-label={`${t('size')} ${v.size}`}
                  aria-pressed={selectedSize === v.size}
                  className={`min-w-12 h-12 px-3 text-sm font-semibold border rounded-[2px] transition-colors ${
                    selectedSize === v.size
                      ? 'border-ink bg-ink text-white'
                      : v.stockQuantity === 0
                      ? 'border-sand-200 text-sand-400 cursor-not-allowed line-through'
                      : 'border-sand-300 text-ink bg-white hover:border-ink'
                  }`}
                >
                  {v.size}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border border-sand-300 bg-white rounded-[2px] overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label={tCart('decreaseQuantity')}
                className="px-3 py-2.5 text-gray-500 hover:text-ocean-600 transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="px-4 py-2.5 text-sm min-w-[3rem] text-center">{quantity}</span>
              <button
                onClick={() =>
                  setQuantity(Math.min(selectedVariant?.stockQuantity || 1, quantity + 1))
                }
                aria-label={tCart('increaseQuantity')}
                className="px-3 py-2.5 text-gray-500 hover:text-ocean-600 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!selectedVariant || selectedVariant.stockQuantity === 0}
              className={`flex-1 py-3.5 text-[15px] font-semibold rounded-[2px] transition-colors ${
                !selectedVariant || selectedVariant.stockQuantity === 0
                  ? 'bg-sand-200 text-stone cursor-not-allowed'
                  : 'bg-ink text-white hover:bg-coral'
              }`}
            >
              {!selectedVariant || selectedVariant.stockQuantity === 0
                ? t('outOfStock')
                : t('addToCart')}
            </button>

            <WishlistButton
              product={product}
              iconSize={18}
              className="p-3 border rounded-lg transition-colors"
              activeClassName="border-red-300 text-red-500"
              inactiveClassName="border-gray-300 text-gray-400 hover:text-red-500 hover:border-red-300"
            />
          </div>

          {/* SKU */}
          {selectedVariant && (
            <p className="text-xs text-stone mb-6">SKU: {selectedVariant.sku}</p>
          )}

          {/* Description */}
          {description && (
            <div className="border-t border-sand-200 pt-6">
              <h2 className="eyebrow text-ocean-700 mb-3">
                {t('description')}
              </h2>
              <div className="text-[15px] text-stone leading-relaxed whitespace-pre-line">
                {description}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
