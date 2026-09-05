'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCartStore } from '@/store/cart';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

function getEffectivePrice(item: any) {
  const base = parseFloat(item.variant.priceOverride || item.variant.product.basePrice);
  if (item.variant.salePrice) {
    const now = new Date();
    const start = item.variant.saleStart ? new Date(item.variant.saleStart) : null;
    const end = item.variant.saleEnd ? new Date(item.variant.saleEnd) : null;
    if ((!start || now >= start) && (!end || now <= end)) {
      return parseFloat(item.variant.salePrice);
    }
  }
  return base;
}

export function CartDrawer() {
  const locale = useLocale();
  const t = useTranslations('cart');
  const tCommon = useTranslations('common');
  const { items, drawerOpen, closeDrawer, fetchCart, updateQuantity, removeItem, itemCount } = useCartStore();

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const subtotal = items.reduce((sum, item) => {
    return sum + getEffectivePrice(item) * item.quantity;
  }, 0);

  const count = itemCount();

  return (
    <Drawer open={drawerOpen} onOpenChange={(open) => { if (!open) closeDrawer(); }} swipeDirection="right">
      <DrawerContent className="w-[85vw] sm:w-[400px] max-w-[400px]">
        <DrawerHeader className="border-b border-gray-100 pb-4">
          <DrawerTitle className="flex items-center justify-between">
            <span className="text-lg font-bold">{t('title')}</span>
            {count > 0 && (
              <span className="bg-ocean-600 text-white text-xs font-bold min-w-[22px] h-[22px] rounded-full flex items-center justify-center px-1.5">
                {count}
              </span>
            )}
          </DrawerTitle>
        </DrawerHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <ShoppingBag size={48} className="text-gray-200 mb-4" />
            <p className="text-gray-400 text-sm mb-6">{t('empty')}</p>
            <DrawerClose
              render={<Button variant="outline" className="rounded-lg" />}
              onClick={closeDrawer}
            >
              {t('continueShopping')}
            </DrawerClose>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.map((item) => {
                const product = item.variant.product;
                const name = locale === 'he' ? product.nameHe : product.nameEn;
                const imageUrl = product.images[0]?.url;
                const price = getEffectivePrice(item);

                return (
                  <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                    <Link
                      href={`/product/${product.slug}`}
                      onClick={closeDrawer}
                      className="w-[72px] h-[72px] flex-shrink-0 bg-white rounded-lg overflow-hidden border border-gray-100"
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={name}
                          width={72}
                          height={72}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                          BAIA
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/product/${product.slug}`}
                        onClick={closeDrawer}
                        className="text-sm font-medium text-gray-900 line-clamp-1 hover:text-ocean-600 transition-colors"
                      >
                        {name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.variant.color} / {item.variant.size}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label={t('decreaseQuantity')}
                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.variant.stockQuantity}
                            aria-label={t('increaseQuantity')}
                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:text-gray-300"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">₪{(price * item.quantity).toFixed(0)}</span>
                          <button
                            onClick={() => removeItem(item.id)}
                            aria-label={t('removeItem')}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
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

            <DrawerFooter className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{t('subtotal')}</span>
                <span className="font-bold text-base">₪{subtotal.toFixed(0)}</span>
              </div>
              <Link
                href="/cart"
                onClick={closeDrawer}
                className="w-full bg-ocean-700 text-white text-center py-3 text-sm font-medium tracking-wider uppercase rounded-lg hover:bg-ocean-800 transition-colors block"
              >
                {t('checkout')}
              </Link>
              <DrawerClose
                render={
                  <button className="w-full text-center text-sm text-gray-400 hover:text-ocean-600 transition-colors py-1" />
                }
                onClick={closeDrawer}
              >
                {t('continueShopping')}
              </DrawerClose>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
