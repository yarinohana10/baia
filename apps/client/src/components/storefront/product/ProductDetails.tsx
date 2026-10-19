'use client';

import { useMemo, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { SHOPPER_LOW_STOCK_THRESHOLD, lowStockCount } from '@/lib/catalog/pricing';
import { effectiveSizeSetKey, sizeChartFor } from '@/lib/catalog/size-charts';
import { localizedName } from '@/lib/catalog/names';
import { activeVariants, displayPrice, distinctValues, galleryImagesFor } from '@/lib/catalog/variant-selection';
import { whatsappHref } from '@/lib/site';
import type { Product, Variant } from '@/lib/catalog/types';
import { useAddToBag } from '@/hooks/catalog/useAddToBag';
import { useLiveProduct } from '@/hooks/catalog/useLiveProduct';
import { useScrolledPast } from '@/hooks/catalog/useScrolledPast';
import { useVariantSelection } from '@/hooks/catalog/useVariantSelection';
import { WishlistButton } from '@/components/storefront/WishlistButton';
import ProductGallery from '@/components/storefront/ProductGallery';
import { AddToBagButton } from './AddToBagButton';
import { ColorPicker } from './ColorPicker';
import { ProductInfoSections, type ShippingSummary } from './ProductInfoSections';
import { ProductPrice } from './ProductPrice';
import { QuantityStepper } from './QuantityStepper';
import { SizeGuide } from './SizeGuide';
import { SizePicker } from './SizePicker';
import { StickyAddToBag } from './StickyAddToBag';
import { TrustRow } from './TrustRow';

type Props = {
  product: Product;
  shipping: ShippingSummary;
  whatsappNumber: string | null;
};

type ButtonState = { variant: Variant | undefined; purchasable: boolean; adding: boolean };

function addToBagLabelKey({ variant, purchasable, adding }: ButtonState) {
  if (!variant) return 'selectSize';
  if (!purchasable) return 'soldOut';
  return adding ? 'adding' : 'addToCart';
}

/**
 * Interactive product page body: gallery, price, colour/size pickers, quantity,
 * add to bag (+ sticky bar on phones), trust row and info sections.
 * Server-rendered from the cached catalogue, then stock is refreshed live so
 * sold-out sizes are accurate.
 */
export function ProductDetails({ product: initial, shipping, whatsappNumber }: Props) {
  const locale = useLocale();
  const t = useTranslations('pdp');
  const tErrors = useTranslations('checkout.errors');

  const product = useLiveProduct(initial);
  const variants = useMemo(() => activeVariants(product), [product]);
  const selection = useVariantSelection(variants);
  const { variant, maxQuantity, addError } = selection;
  const purchasable = !!variant && maxQuantity > 0;
  const { adding, added, addToBag } = useAddToBag({
    variant,
    quantity: selection.quantity,
    purchasable,
    onError: selection.setAddError,
  });

  const colors = useMemo(() => distinctValues(variants, 'color'), [variants]);
  const allSizes = useMemo(() => distinctValues(variants, 'size'), [variants]);
  const galleryImages = useMemo(() => galleryImagesFor(product.images, selection.color), [product.images, selection.color]);
  const price = displayPrice(variant, variants, product.basePrice);
  const name = localizedName(product, locale);

  const chart = sizeChartFor({
    sizeSetKey: effectiveSizeSetKey(product.sizeSet?.key, allSizes),
    topCategorySlug: product.category?.parent?.slug ?? product.category?.slug,
    sizes: allSizes,
  });
  const whatsappLink = whatsappHref(whatsappNumber, t('sizeGuide.whatsappMessage', { name }));
  const buttonLabel = t(addToBagLabelKey({ variant, purchasable, adding }));

  // Sticky bar (phones) appears once the main button scrolls out of view.
  const buyRef = useRef<HTMLDivElement>(null);
  const showSticky = useScrolledPast(buyRef);

  return (
    <>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 lg:gap-14">
        <div className="md:col-span-7">
          <ProductGallery images={galleryImages} productName={name} />
        </div>

        <div className="md:col-span-5">
          <div className="md:sticky md:top-24">
            <h1 className="mb-3 text-2xl font-semibold leading-tight tracking-normal text-charcoal md:text-3xl">{name}</h1>

            <div className="mb-1">
              <ProductPrice price={price} size="lg" />
            </div>
            <p className="mb-6 text-xs text-gray-500">{t('vatIncluded')}</p>

            {colors.length > 0 && (
              <ColorPicker colors={colors} selected={selection.color} variants={variants} onSelect={selection.selectColor} />
            )}

            {selection.sizeOptions.length > 0 && (
              <SizePicker
                options={selection.sizeOptions}
                selected={selection.size}
                onSelect={selection.selectSize}
                lowStock={variant ? lowStockCount(variant, SHOPPER_LOW_STOCK_THRESHOLD) : null}
                guide={<SizeGuide chart={chart} sizes={allSizes} whatsappLink={whatsappLink} />}
              />
            )}

            {/* Quantity + add to bag + wishlist */}
            <div ref={buyRef} className="mb-3 flex items-stretch gap-3">
              <QuantityStepper
                quantity={selection.quantity}
                max={maxQuantity}
                onDecrement={selection.decrement}
                onIncrement={selection.increment}
              />
              <AddToBagButton label={buttonLabel} purchasable={purchasable} adding={adding} added={added} onAdd={addToBag} />
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

            {variant?.sku && <p className="mb-5 text-xs text-gray-400">{t('sku', { sku: variant.sku })}</p>}

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

      <StickyAddToBag
        visible={showSticky}
        name={name}
        image={galleryImages[0]}
        selectionLabel={[selection.color, selection.size].filter(Boolean).join(' · ')}
        price={price}
        buttonLabel={buttonLabel}
        purchasable={purchasable}
        adding={adding}
        onAdd={addToBag}
      />
    </>
  );
}
