'use client';

import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useCheckout } from '@/hooks/storefront/useCheckout';
import { usePaymentConfig } from '@/hooks/storefront/usePaymentConfig';
import type { CheckoutFields } from '@/hooks/storefront/checkoutFormState';
import { CheckoutErrorBanner } from './CheckoutErrorBanner';
import { CheckoutSkeleton } from './CheckoutSkeleton';
import { CheckoutSummary } from './CheckoutSummary';
import { ContactSection } from './ContactSection';
import { CouponSection } from './CouponSection';
import { DeliverySection } from './DeliverySection';
import { PaymentsComingSoon } from './PaymentsComingSoon';
import { ShippingAddressSection } from './ShippingAddressSection';

/** Checkout page: contact, delivery, address and coupon on one side, the order summary on the other. */
export function CheckoutView() {
  const t = useTranslations('cart');
  const tCheckout = useTranslations('checkout');
  const checkout = useCheckout();
  const paymentConfig = usePaymentConfig();
  const { form, dispatch, coupon, locked } = checkout;

  if (!checkout.loaded || !paymentConfig) return <CheckoutSkeleton />;
  // Payments are off on the server: there is no way to place an order, so don't offer the form.
  if (!paymentConfig.enabled) return <PaymentsComingSoon />;

  if (checkout.items.length === 0 && !locked) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4 text-center text-gray-400">
        <CheckoutErrorBanner error={form.error} />
        <p>{tCheckout('empty')}</p>
      </div>
    );
  }

  const edit = (field: keyof CheckoutFields, value: string) => dispatch({ type: 'edit', field, value });
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void checkout.submit();
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
      <h1 className="text-2xl font-bold tracking-normal mb-8">{t('checkout')}</h1>

      <CheckoutErrorBanner error={form.error} />

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <ContactSection fields={form.fields} issues={form.issues} locked={locked} onEdit={edit} />

          <DeliverySection
            method={form.deliveryMethod}
            pickupPoint={form.pickupPoint}
            pickupMissing={form.pickupMissing}
            locked={locked}
            subtotal={checkout.subtotal}
            shipping={checkout.shipping}
            onMethodChange={(method) => dispatch({ type: 'chooseDelivery', method })}
            onPickupPointChange={(point) => dispatch({ type: 'choosePickupPoint', point })}
          />

          {!checkout.isPickup && (
            <ShippingAddressSection
              fields={form.fields}
              issues={form.issues}
              locked={locked}
              savedAddresses={checkout.savedAddresses}
              matchedAddressId={checkout.matchedAddress?.id ?? null}
              offerSave={checkout.offerSaveAddress}
              save={form.saveAddress}
              onEdit={edit}
              onChooseSaved={checkout.chooseSavedAddress}
              onSaveChange={(value) => dispatch({ type: 'setSaveAddress', value })}
            />
          )}

          <CouponSection
            coupon={coupon.state}
            locked={locked}
            onEdit={coupon.edit}
            onApply={coupon.apply}
            onRemove={coupon.remove}
          />
        </div>

        <CheckoutSummary checkout={checkout} />
      </form>
    </div>
  );
}
