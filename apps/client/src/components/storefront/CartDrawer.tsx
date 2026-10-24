'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  canDecrease,
  canIncrease,
  cartSubtotal,
  decreasedQuantity,
  lineIssue,
  unitPrice,
  useCartStore,
} from '@/store/cart';
import { formatPrice } from '@/lib/catalog/pricing';
import { FreeShippingProgress } from '@/components/storefront/FreeShippingProgress';
import { Minus, Plus, Trash2, ShoppingBag, AlertTriangle } from 'lucide-react';
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

export function CartDrawer() {
  const locale = useLocale();
  const t = useTranslations('cart');
  const tErrors = useTranslations('checkout.errors');
  const {
    items,
    drawerOpen,
    shipping,
    pending,
    lineErrors,
    closeDrawer,
    fetchCart,
    fetchShipping,
    updateQuantity,
    removeItem,
    itemCount,
  } = useCartStore();

  useEffect(() => {
    fetchCart();
    fetchShipping();
  }, [fetchCart, fetchShipping]);

  const subtotal = cartSubtotal(items);
  const hasIssues = items.some((item) => lineIssue(item));

  const count = itemCount();

  return (
    <Drawer open={drawerOpen} onOpenChange={(open) => { if (!open) closeDrawer(); }} swipeDirection="right">
      <DrawerContent className="w-[85vw] sm:w-[400px] max-w-[400px]">
        <DrawerHeader className="border-b border-gray-100 pb-4">
          <DrawerTitle className="flex items-center justify-between">
            <span className="text-lg font-bold">{t('title')}</span>
            {count > 0 && (
              <span className="bg-neutral-800 text-white text-xs font-bold min-w-[22px] h-[22px] rounded-none flex items-center justify-center px-1.5">
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
              render={<Button variant="outline" className="rounded-none" />}
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
                const { price } = unitPrice(item);
                const issue = lineIssue(item);
                const busy = !!pending[item.id];
                const error = lineErrors[item.id];

                return (
                  <div
                    key={item.id}
                    aria-busy={busy}
                    className={`flex gap-3 p-3 bg-gray-50 rounded-none ${issue ? 'ring-1 ring-red-200' : ''} ${busy ? 'opacity-60' : ''}`}
                  >
                    <Link
                      href={`/product/${product.slug}`}
                      onClick={closeDrawer}
                      className="w-[72px] h-[72px] flex-shrink-0 bg-white rounded-none overflow-hidden border border-gray-100"
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
                        className="text-sm font-medium text-gray-900 line-clamp-1 hover:text-neutral-700 transition-colors"
                      >
                        {name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.variant.color} / {item.variant.size}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-gray-200 rounded-none overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, decreasedQuantity(item))}
                            disabled={busy || !canDecrease(item)}
                            aria-label={t('decreaseQuantity')}
                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:text-gray-300"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={busy || !canIncrease(item)}
                            aria-label={t('increaseQuantity')}
                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:text-gray-300"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{formatPrice(price * item.quantity)}</span>
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
                        <p className="text-xs text-red-500 mt-1.5 flex items-start gap-1">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                          {issue.kind === 'insufficient'
                            ? t('issues.insufficient', { available: issue.available })
                            : t(`issues.${issue.kind}`)}
                        </p>
                      )}
                      {error && (
                        <p role="alert" className="text-xs text-red-500 mt-1.5">
                          {tErrors(error.key, error.values)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <DrawerFooter className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{t('subtotal')}</span>
                <span className="font-bold text-base">{formatPrice(subtotal)}</span>
              </div>
              <FreeShippingProgress subtotal={subtotal} threshold={shipping.freeThreshold} />
              {hasIssues ? (
                <>
                  <p role="status" className="text-xs text-red-500 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {t('issues.blocked')}
                  </p>
                  <span
                    aria-disabled="true"
                    className="w-full bg-black text-white text-center py-3 text-sm font-medium tracking-wider uppercase rounded-none opacity-40 cursor-not-allowed block"
                  >
                    {t('checkout')}
                  </span>
                </>
              ) : (
                <Link
                  href="/checkout"
                  onClick={closeDrawer}
                  className="w-full bg-black text-white text-center py-3 text-sm font-medium tracking-wider uppercase rounded-none hover:bg-neutral-800 transition-colors block"
                >
                  {t('checkout')}
                </Link>
              )}
              <Link
                href="/cart"
                onClick={closeDrawer}
                className="w-full text-center text-sm text-black hover:text-black transition-colors py-1 block"
              >
                {t('viewCart')}
              </Link>
              <DrawerClose
                render={
                  <button className="w-full text-center text-sm text-gray-400 hover:text-neutral-700 transition-colors py-1" />
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
