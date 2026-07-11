'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Heart, Minus, Plus, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/store/cart';

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

type ProductImage = {
  id: string;
  url: string;
  color: string | null;
};

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

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

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
    return product.variants
      .filter((v) => v.color === selectedColor && v.isActive)
      .sort((a, b) => {
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
        return sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size);
      });
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

  const { addItem } = useCartStore();

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    try {
      await addItem(selectedVariant.id, quantity);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="aspect-square bg-gray-200" />
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
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-8">
        <Link href="/" className="hover:text-ocean-600 transition-colors">Home</Link>
        <ChevronRight size={10} />
        {parentCatName && product.category.parent && (
          <>
            <Link href={`/category/${product.category.parent.slug}`} className="hover:text-ocean-600 transition-colors">
              {parentCatName}
            </Link>
            <ChevronRight size={10} />
          </>
        )}
        <Link href={`/category/${product.category.slug}`} className="hover:text-ocean-600 transition-colors">
          {catName}
        </Link>
        <ChevronRight size={10} />
        <span className="text-gray-600">{name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square bg-gray-100 overflow-hidden">
            {filteredImages[selectedImageIdx] ? (
              <img
                src={filteredImages[selectedImageIdx].url}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100" />
            )}
          </div>
          {filteredImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {filteredImages.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImageIdx(i)}
                  className={`w-16 h-16 flex-shrink-0 overflow-hidden border-2 transition-colors ${
                    selectedImageIdx === i ? 'border-ocean-700' : 'border-transparent'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-2xl md:text-3xl font-light tracking-wider mb-3">{name}</h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-6">
            <span
              className={`text-2xl font-medium ${
                displayPrice.original ? 'text-red-500' : 'text-charcoal'
              }`}
            >
              ₪{displayPrice.current.toFixed(2)}
            </span>
            {displayPrice.original && (
              <span className="text-lg text-gray-400 line-through">
                ₪{displayPrice.original.toFixed(2)}
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
                    onClick={() => { setSelectedColor(color); setSelectedImageIdx(0); }}
                    className={`px-3 py-1.5 text-sm border transition-colors ${
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
            <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
              {t('size')}
            </label>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((v) => (
                <button
                  key={v.size}
                  onClick={() => setSelectedSize(v.size)}
                  disabled={v.stockQuantity === 0}
                  className={`w-11 h-11 text-sm border transition-colors ${
                    selectedSize === v.size
                      ? 'border-ocean-700 bg-ocean-700 text-white'
                      : v.stockQuantity === 0
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
            <div className="flex items-center border border-gray-300">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2.5 text-gray-500 hover:text-ocean-600 transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="px-4 py-2.5 text-sm min-w-[3rem] text-center">{quantity}</span>
              <button
                onClick={() =>
                  setQuantity(Math.min(selectedVariant?.stockQuantity || 1, quantity + 1))
                }
                className="px-3 py-2.5 text-gray-500 hover:text-ocean-600 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!selectedVariant || selectedVariant.stockQuantity === 0}
              className={`flex-1 py-3 text-sm font-medium tracking-[0.15em] uppercase transition-colors ${
                addedToCart
                  ? 'bg-green-600 text-white'
                  : !selectedVariant || selectedVariant.stockQuantity === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-ocean-700 text-white hover:bg-ocean-800'
              }`}
            >
              {addedToCart
                ? 'Added!'
                : !selectedVariant || selectedVariant.stockQuantity === 0
                ? t('outOfStock')
                : t('addToCart')}
            </button>

            <button
              className="p-3 border border-gray-300 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
              aria-label="Add to wishlist"
            >
              <Heart size={18} />
            </button>
          </div>

          {/* SKU */}
          {selectedVariant && (
            <p className="text-xs text-gray-400 mb-6">SKU: {selectedVariant.sku}</p>
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
