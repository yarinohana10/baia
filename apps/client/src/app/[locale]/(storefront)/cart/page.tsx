'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCartStore } from '@/store/cart';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';

function getEffectivePrice(item: any) {
  const base = parseFloat(item.variant.priceOverride || item.variant.product.basePrice);
  if (item.variant.salePrice) {
    const now = new Date();
    const start = item.variant.saleStart ? new Date(item.variant.saleStart) : null;
    const end = item.variant.saleEnd ? new Date(item.variant.saleEnd) : null;
    if ((!start || now >= start) && (!end || now <= end)) {
      return { price: parseFloat(item.variant.salePrice), original: base, onSale: true };
    }
  }
  return { price: base, original: null, onSale: false };
}

export default function CartPage() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { items, loading, fetchCart, updateQuantity, removeItem } = useCartStore();

  useEffect(() => { fetchCart(); }, []);

  const subtotal = items.reduce((sum, item) => {
    const { price } = getEffectivePrice(item);
    return sum + price * item.quantity;
  }, 0);

  const freeShippingThreshold = 249;
  const shippingCost = subtotal >= freeShippingThreshold ? 0 : 29.9;
  const total = subtotal + shippingCost;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
        <h1 className="text-2xl font-light tracking-[0.2em] uppercase mb-8">{t('title')}</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
      <h1 className="text-2xl font-light tracking-[0.2em] uppercase mb-8">{t('title')}</h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-400 mb-6">{t('empty')}</p>
          <Link
            href="/"
            className="inline-block bg-ocean-700 text-white px-8 py-3 text-sm tracking-wider hover:bg-ocean-800 transition-colors"
          >
            {t('continueShopping')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const { price, original, onSale } = getEffectivePrice(item);
              const product = item.variant.product;
              const name = locale === 'he' ? product.nameHe : product.nameEn;
              const imageUrl = product.images[0]?.url;

              return (
                <div key={item.id} className="flex gap-4 p-4 bg-white border border-gray-200">
                  <Link
                    href={`/product/${product.slug}`}
                    className="w-24 h-24 flex-shrink-0 bg-gray-100 overflow-hidden"
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-100" />
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
                      <div className="flex items-center border border-gray-300">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2 py-1 text-gray-500 hover:text-ocean-600"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-3 py-1 text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.variant.stockQuantity}
                          className="px-2 py-1 text-gray-500 hover:text-ocean-600 disabled:text-gray-300"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-end">
                          <span className={`text-sm font-medium ${onSale ? 'text-red-500' : ''}`}>
                            ₪{(price * item.quantity).toFixed(2)}
                          </span>
                          {onSale && original && (
                            <span className="block text-xs text-gray-400 line-through">
                              ₪{(original * item.quantity).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="bg-white border border-gray-200 p-6 h-fit space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('subtotal')}</span>
              <span>₪{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('shipping')}</span>
              <span className={shippingCost === 0 ? 'text-green-600' : ''}>
                {shippingCost === 0 ? t('freeShipping') : `₪${shippingCost.toFixed(2)}`}
              </span>
            </div>
            {shippingCost > 0 && (
              <p className="text-xs text-gray-400">
                Free shipping on orders over ₪{freeShippingThreshold}
              </p>
            )}
            <div className="border-t border-gray-200 pt-4 flex justify-between font-medium">
              <span>{t('total')}</span>
              <span>₪{total.toFixed(2)}</span>
            </div>
            <Link
              href="/checkout"
              className="block w-full bg-ocean-700 text-white text-center py-3 text-sm tracking-[0.15em] uppercase hover:bg-ocean-800 transition-colors"
            >
              {t('checkout')}
            </Link>
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
