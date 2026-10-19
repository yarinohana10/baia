'use client';

import { useTranslations } from 'next-intl';
import type { Checkout } from '@/hooks/storefront/useCheckout';
import { CartIssuesNotice } from './CartIssuesNotice';
import { CheckoutConsents } from './CheckoutConsents';
import { CheckoutItems } from './CheckoutItems';
import { CheckoutTotals } from './CheckoutTotals';
import { PlaceOrderButton } from './PlaceOrderButton';

/** The order summary column: lines, totals, consents and the submit button. */
export function CheckoutSummary({ checkout }: { checkout: Checkout }) {
  const tCheckout = useTranslations('checkout');
  const tDelivery = useTranslations('delivery');
  const { form, dispatch, shipping, locked } = checkout;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 h-fit space-y-4">
      <h2 className="font-medium text-gray-800">{tCheckout('orderSummary')}</h2>

      <CheckoutItems items={checkout.items} />

      <CheckoutTotals
        subtotal={checkout.subtotal}
        shippingCost={checkout.shippingCost}
        isPickup={checkout.isPickup}
        freeThreshold={shipping.freeThreshold}
        discount={checkout.discount}
        total={checkout.total}
      />

      <CheckoutConsents
        marketingConsent={form.marketingConsent}
        termsAccepted={form.termsAccepted}
        termsIssue={form.issues.acceptTerms}
        locked={locked}
        onMarketingChange={(value) => dispatch({ type: 'setMarketingConsent', value })}
        onTermsChange={(value) => dispatch({ type: 'setTermsAccepted', value })}
      />

      {checkout.hasIssues && !locked && <CartIssuesNotice />}

      <PlaceOrderButton disabled={!checkout.canSubmit} submitting={checkout.submitting} orderExists={locked} />

      <p className="text-xs text-center text-gray-400">{tCheckout('secureNote')}</p>
      <p className="text-xs text-center text-gray-400">
        {tDelivery('cancelPolicy', { hours: shipping.selfCancelWindowHours ?? 48 })}
      </p>
    </div>
  );
}
