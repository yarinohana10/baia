'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import {
  canDecrease,
  canIncrease,
  cartSubtotal,
  decreasedQuantity,
  lineIssue,
  shippingFor,
  unitPrice,
  useCartStore,
} from '@/store/cart';
import { formatPrice } from '@/lib/catalog/pricing';
import { FreeShippingProgress } from '@/components/storefront/FreeShippingProgress';
import { Minus, Plus, Trash2, ShoppingBag, AlertTriangle } from 'lucide-react';

export default function CartPage() {
  const t = useTranslations('cart');
  const tErrors = useTranslations('checkout.errors');
  const tDelivery = useTranslations('delivery');
  const locale = useLocale();
  const { items, loading, loaded, shipping, pending, lineErrors, fetchCart, fetchShipping, updateQuantity, removeItem } =
    useCartStore();

  useEffect(() => {
    fetchCart();
    fetchShipping();
  }, [fetchCart, fetchShipping]);

  const subtotal = cartSubtotal(items);
  // The method is chosen at checkout: show the cheapest option until then.
  const shippingCost = Math.min(shippingFor(subtotal, shipping, 'COURIER'), shippingFor(subtotal, shipping, 'PICKUP_POINT'));
  const total = subtotal + shippingCost;
  const hasIssues = items.some((item) => lineIssue(item));

  if (loading && !loaded) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
        <h1 className="text-2xl font-bold tracking-normal mb-8">{t('title')}</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
      <h1 className="text-2xl font-bold tracking-normal mb-8">{t('title')}</h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-400 mb-6">{t('empty')}</p>
          <Link
            href="/"
            className="inline-block bg-ocean-700 text-white px-8 py-3 text-sm tracking-wider rounded-lg hover:bg-ocean-800 transition-colors"
          >
            {t('continueShopping')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const { price, original } = unitPrice(item);
              const onSale = original !== null;
              const product = item.variant.product;
              const name = locale === 'he' ? product.nameHe : product.nameEn;
              const imageUrl = product.images[0]?.url;
              const issue = lineIssue(item);
              const busy = !!pending[item.id];
              const error = lineErrors[item.id];

              return (
                <div
                  key={item.id}
                  aria-busy={busy}
                  className={`flex gap-4 p-4 bg-white border rounded-xl ${issue ? 'border-red-200' : 'border-gray-200'} ${busy ? 'opacity-60' : ''}`}
                >
                  <Link
                    href={`/product/${product.slug}`}
                    className="w-24 h-24 flex-shrink-0 bg-gray-50 overflow-hidden rounded-lg"
                  >
                    {imageUrl ? (
                      <Image src={imageUrl} alt={name} width={96} height={96} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-gray-100 rounded-lg" />
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${product.slug}`}
                      className="text-sm font-medium text-charcoal hover:text-ocean-600 transition-colors line-clamp-1"
                    >
                      {name}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.variant.color} / {item.variant.size}
                    </p>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, decreasedQuantity(item))}
                          disabled={busy || !canDecrease(item)}
                          aria-label={t('decreaseQuantity')}
                          className="px-2 py-1 text-gray-500 hover:text-ocean-600 disabled:text-gray-300"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-3 py-1 text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={busy || !canIncrease(item)}
                          aria-label={t('increaseQuantity')}
                          className="px-2 py-1 text-gray-500 hover:text-ocean-600 disabled:text-gray-300"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-end">
                          <span className={`text-sm font-medium ${onSale ? 'text-red-500' : ''}`}>
                            {formatPrice(price * item.quantity)}
                          </span>
                          {onSale && (
                            <span className="block text-xs text-gray-400 line-through">
                              {formatPrice(original * item.quantity)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={busy}
                          aria-label={t('removeItem')}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {issue && (
                      <p className="text-xs text-red-500 mt-2 flex items-start gap-1.5">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        {issue.kind === 'insufficient'
                          ? t('issues.insufficient', { available: issue.available })
                          : t(`issues.${issue.kind}`)}
                      </p>
                    )}
                    {error && (
                      <p role="alert" className="text-xs text-red-500 mt-2">
                        {tErrors(error.key, error.values)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 h-fit space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('subtotal')}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('shipping')}</span>
              <span className={shippingCost === 0 ? 'text-green-600' : ''}>
                {shippingCost === 0 ? t('freeShipping') : tDelivery('fromPrice', { amount: formatPrice(shippingCost) })}
              </span>
            </div>
            {shippingCost > 0 && <p className="text-xs text-gray-400">{tDelivery('chooseAtCheckout')}</p>}
            <FreeShippingProgress subtotal={subtotal} threshold={shipping.freeThreshold} />
            <div className="border-t border-gray-200 pt-4 flex justify-between font-medium">
              <span>{t('total')}</span>
              <span>{formatPrice(total)}</span>
            </div>
            <p className="text-xs text-gray-400 -mt-2">{tDelivery('vatIncluded')}</p>
            {hasIssues ? (
              <>
                <p role="status" className="text-xs text-red-500 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {t('issues.blocked')}
                </p>
                <span
                  aria-disabled="true"
                  className="block w-full bg-ocean-700 text-white text-center py-3 text-sm tracking-wider uppercase rounded-lg opacity-40 cursor-not-allowed"
                >
                  {t('checkout')}
                </span>
              </>
            ) : (
              <Link
                href="/checkout"
                className="block w-full bg-ocean-700 text-white text-center py-3 text-sm tracking-wider uppercase rounded-lg hover:bg-ocean-800 transition-colors"
              >
                {t('checkout')}
              </Link>
            )}
            <Link
              href="/"
              className="block text-center text-sm text-gray-400 hover:text-ocean-600 transition-colors"
            >
              {t('continueShopping')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
