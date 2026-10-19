'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Check, Minus, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import {
  SHOPPER_LOW_STOCK_THRESHOLD,
  availableQty,
  discountPercent,
  formatPrice,
  isInStock,
  lowStockCount,
  swatchColor,
  variantPrice,
} from '@/lib/catalog/pricing';
import { effectiveSizeSetKey, sizeChartFor } from '@/lib/catalog/size-charts';
import { whatsappHref } from '@/lib/site';
import { shopErrorMessage, type ErrorMessage } from '@/lib/shop-errors';
import type { Product, Variant } from '@/lib/catalog/types';
import { WishlistButton } from '@/components/storefront/WishlistButton';
import ProductGallery, { type GalleryImage } from '@/components/storefront/ProductGallery';
import { SizeGuide } from './SizeGuide';
import { ProductInfoSections, type ShippingSummary } from './ProductInfoSections';
import { TrustRow } from './TrustRow';

type Props = {
  product: Product;
  shipping: ShippingSummary;
  whatsappNumber: string | null;
};

const activeVariants = (p: Product) => p.variants.filter((v) => v.isActive !== false);

/**
 * Interactive product page body: gallery, price, colour/size pickers, quantity,
 * add to bag (+ sticky bar on phones), trust row and info sections.
 * Server-rendered from the cached catalogue, then stock is refreshed live so
 * sold-out sizes are accurate.
 */
export function ProductDetails({ product: initial, shipping, whatsappNumber }: Props) {
  const locale = useLocale();
  const isHe = locale === 'he';
  const t = useTranslations('pdp');
  const tErrors = useTranslations('checkout.errors');

  const [product, setProduct] = useState(initial);
  const variants = useMemo(() => activeVariants(product), [product]);

  // Live stock: the page itself is cached for a few minutes.
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/products/${encodeURIComponent(initial.slug)}`)
      .then((res) => {
        if (!cancelled && res.data?.id === initial.id) setProduct(res.data as Product);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initial.slug, initial.id]);

  const colors = useMemo(() => [...new Set(variants.map((v) => v.color))], [variants]);
  const [selectedColor, setSelectedColor] = useState(
    () => (activeVariants(initial).find(isInStock) ?? activeVariants(initial)[0])?.color ?? '',
  );
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<ErrorMessage | null>(null);

  // The API returns variants ordered by the product's size set.
  const sizeOptions = useMemo(() => variants.filter((v) => v.color === selectedColor), [variants, selectedColor]);
  const colorInStock = (color: string) => variants.some((v) => v.color === color && isInStock(v));

  // Keep a valid size selected: the current one if this colour has it, else the first in stock.
  useEffect(() => {
    if (sizeOptions.length === 0) return;
    const current = sizeOptions.find((v) => v.size === selectedSize);
    if (!current || (!isInStock(current) && sizeOptions.some(isInStock))) {
      setSelectedSize((sizeOptions.find(isInStock) ?? sizeOptions[0]).size);
    }
  }, [sizeOptions, selectedSize]);

  const selectedVariant: Variant | undefined = sizeOptions.find((v) => v.size === selectedSize);
  const maxQuantity = selectedVariant ? availableQty(selectedVariant) : 0;
  const purchasable = !!selectedVariant && maxQuantity > 0;
  const lowStock = selectedVariant ? lowStockCount(selectedVariant, SHOPPER_LOW_STOCK_THRESHOLD) : null;

  useEffect(() => {
    setQuantity((q) => Math.max(1, Math.min(q, maxQuantity || 1)));
    setAddError(null);
  }, [selectedVariant?.id, maxQuantity]);

  const price = useMemo(() => {
    if (selectedVariant) return variantPrice(selectedVariant, product.basePrice);
    // No variant yet: the lowest price on offer.
    const prices = variants.map((v) => variantPrice(v, product.basePrice));
    return prices.sort((a, b) => a.current - b.current)[0] ?? { current: parseFloat(product.basePrice), original: null };
  }, [selectedVariant, variants, product.basePrice]);
  const pct = discountPercent(price.current, price.original);

  const galleryImages: GalleryImage[] = useMemo(() => {
    const all = product.images.map((img, i) => ({ ...img, id: img.id ?? `img-${i}` }));
    const forColor = all.filter((img) => !img.color || img.color === selectedColor);
    return forColor.length > 0 ? forColor : all;
  }, [product.images, selectedColor]);

  const name = isHe ? product.nameHe : product.nameEn;
  const allSizes = useMemo(() => [...new Set(variants.map((v) => v.size))], [variants]);
  const topCategorySlug = product.category?.parent?.slug ?? product.category?.slug;
  const chart = sizeChartFor({
    sizeSetKey: effectiveSizeSetKey(product.sizeSet?.key, allSizes),
    topCategorySlug,
    sizes: allSizes,
  });
  const whatsappLink = whatsappHref(whatsappNumber, t('sizeGuide.whatsappMessage', { name }));

  const { addItem, openDrawer, closeDrawer } = useCartStore();
  const handleAddToCart = async () => {
    if (!selectedVariant || adding || !purchasable) return;
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
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    closeDrawer();
    setTimeout(() => openDrawer(), 50);
  };

  // Sticky bar (phones) appears once the main button scrolls out of view.
  const buyRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const el = buyRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const buttonLabel = !selectedVariant
    ? t('selectSize')
    : !purchasable
      ? t('soldOut')
      : adding
        ? t('adding')
        : t('addToCart');

  const priceBlock = (size: 'lg' | 'sm') => (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span
        className={cn(
          'font-semibold tabular-nums',
          size === 'lg' ? 'text-2xl' : 'text-base',
          price.original ? 'text-coral' : 'text-charcoal',
        )}
      >
        <span className="sr-only">{price.original ? t('salePrice', { price: formatPrice(price.current) }) : ''}</span>
        <span aria-hidden={price.original ? true : undefined}>{formatPrice(price.current)}</span>
      </span>
      {price.original && (
        <>
          <s className={cn('text-gray-400 tabular-nums', size === 'lg' ? 'text-lg' : 'text-sm')}>
            <span className="sr-only">{t('originalPrice', { price: formatPrice(price.original) })}</span>
            <span aria-hidden="true">{formatPrice(price.original)}</span>
          </s>
          {size === 'lg' && pct > 0 && (
            <span className="rounded-full bg-coral/10 px-2 py-0.5 text-xs font-semibold text-coral" dir="ltr">
              {t('savePercent', { pct })}
            </span>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 lg:gap-14">
        <div className="md:col-span-7">
          <ProductGallery images={galleryImages} productName={name} />
        </div>

        <div className="md:col-span-5">
          <div className="md:sticky md:top-24">
            <h1 className="mb-3 text-2xl font-semibold leading-tight tracking-normal text-charcoal md:text-3xl">{name}</h1>

            <div className="mb-1">{priceBlock('lg')}</div>
            <p className="mb-6 text-xs text-gray-500">{t('vatIncluded')}</p>

            {/* Colour */}
            {colors.length > 0 && (
              <fieldset className="mb-6">
                <legend className="mb-2.5 text-sm text-gray-600">
                  <span className="font-medium text-charcoal">{t('color')}:</span> {selectedColor}
                </legend>
                <div className="flex flex-wrap gap-2.5">
                  {colors.map((color) => {
                    const swatch = swatchColor(color);
                    const selected = selectedColor === color;
                    const soldOut = !colorInStock(color);
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        aria-pressed={selected}
                        aria-label={soldOut ? `${t('colorOption', { color })} – ${t('soldOut')}` : t('colorOption', { color })}
                        title={color}
                        className={cn(
                          'relative rounded-full transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600',
                          swatch
                            ? 'size-9 ring-1 ring-gray-300 ring-offset-2'
                            : 'border px-3.5 py-1.5 text-sm',
                          swatch && selected && 'ring-2 ring-ocean-700',
                          !swatch && (selected ? 'border-ocean-700 bg-ocean-700 text-white' : 'border-gray-300 hover:border-ocean-500'),
                          soldOut && 'opacity-50',
                        )}
                        style={swatch ? { backgroundColor: swatch } : undefined}
                      >
                        {!swatch && color}
                        {swatch && soldOut && (
                          <span aria-hidden="true" className="absolute inset-0 m-auto h-px w-full rotate-45 bg-gray-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Size */}
            {sizeOptions.length > 0 && (
              <fieldset className="mb-6">
                <div className="mb-2.5 flex items-center justify-between gap-4">
                  <legend className="text-sm font-medium text-charcoal">{t('size')}</legend>
                  <SizeGuide chart={chart} sizes={allSizes} whatsappLink={whatsappLink} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizeOptions.map((v) => {
                    const inStock = isInStock(v);
                    const selected = selectedSize === v.size;
                    return (
                      <button
                        key={v.size}
                        type="button"
                        onClick={() => setSelectedSize(v.size)}
                        disabled={!inStock}
                        aria-pressed={selected}
                        aria-label={inStock ? t('sizeOption', { size: v.size }) : t('sizeSoldOut', { size: v.size })}
                        className={cn(
                          'relative h-11 min-w-12 overflow-hidden rounded-lg border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600',
                          selected && inStock && 'border-ocean-700 bg-ocean-700 text-white',
                          !selected && inStock && 'border-gray-300 text-charcoal hover:border-ocean-600',
                          !inStock &&
                            'cursor-not-allowed border-gray-200 bg-[linear-gradient(to_top_right,transparent_calc(50%-0.5px),#d1d5db_50%,transparent_calc(50%+0.5px))] text-gray-400 line-through',
                        )}
                      >
                        <span dir="ltr">{v.size}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 min-h-5 text-[13px] font-medium text-amber-700" aria-live="polite">
                  {lowStock !== null ? t('lowStock', { count: lowStock }) : ''}
                </p>
              </fieldset>
            )}

            {/* Quantity + add to bag + wishlist */}
            <div ref={buyRef} className="mb-3 flex items-stretch gap-3">
              <div className="flex items-center rounded-lg border border-gray-300" role="group" aria-label={t('quantity')}>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  aria-label={t('decrease')}
                  className="flex h-full w-10 items-center justify-center text-gray-600 hover:text-ocean-700 disabled:text-gray-300"
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
                <output className="min-w-8 text-center text-sm tabular-nums" aria-live="polite">
                  {quantity}
                </output>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(Math.max(1, maxQuantity), quantity + 1))}
                  disabled={quantity >= maxQuantity}
                  aria-label={t('increase')}
                  className="flex h-full w-10 items-center justify-center text-gray-600 hover:text-ocean-700 disabled:text-gray-300"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!purchasable || adding}
                aria-busy={adding}
                className={cn(
                  'flex h-12 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600',
                  purchasable ? 'bg-ocean-700 text-white hover:bg-ocean-800 disabled:opacity-70' : 'cursor-not-allowed bg-gray-200 text-gray-500',
                )}
              >
                {added ? <Check size={16} aria-hidden="true" /> : null}
                {buttonLabel}
              </button>

              <WishlistButton
                product={product}
                iconSize={18}
                className="flex w-12 items-center justify-center rounded-lg border transition-colors"
                activeClassName="border-red-300 text-red-500"
                inactiveClassName="border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-300"
              />
            </div>

            {addError && (
              <p role="alert" className="mb-3 flex items-center gap-1.5 text-xs text-red-600">
                <AlertTriangle size={12} className="shrink-0" aria-hidden="true" /> {tErrors(addError.key, addError.values)}
              </p>
            )}

            {selectedVariant?.sku && <p className="mb-5 text-xs text-gray-400">{t('sku', { sku: selectedVariant.sku })}</p>}

            <TrustRow
              freeShippingThreshold={shipping.freeShippingThreshold}
              cancelHours={shipping.selfCancelWindowHours}
            />

            <ProductInfoSections
              product={product}
              shipping={shipping}
              sizeGuide={<SizeGuide chart={chart} sizes={allSizes} whatsappLink={whatsappLink} variant="text" />}
            />
          </div>
        </div>
      </div>

      {/* Sticky add-to-bag (phones) */}
      <div
        aria-hidden={!showSticky}
        inert={!showSticky}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur transition-transform duration-300 md:hidden',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          showSticky ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="flex items-center gap-3" role="region" aria-label={t('sticky.label')}>
          {galleryImages[0] && (
            <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-gray-100">
              <Image src={galleryImages[0].url} alt="" fill sizes="48px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-charcoal">{name}</p>
            <p className="truncate text-xs text-gray-500">
              {[selectedColor, selectedSize].filter(Boolean).join(' · ')}
            </p>
            {priceBlock('sm')}
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!purchasable || adding}
            className={cn(
              'h-11 shrink-0 rounded-lg px-5 text-sm font-semibold',
              purchasable ? 'bg-ocean-700 text-white disabled:opacity-70' : 'bg-gray-200 text-gray-500',
            )}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </>
  );
}
