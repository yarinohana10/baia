'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, Lock } from 'lucide-react';
import { formatPrice } from '@/lib/catalog/pricing';
import { orderPageHref, type CustomerOrder } from '@/lib/orders';
import type { PaymentConfig } from '@/lib/payment';
import { usePayment } from '@/hooks/storefront/usePayment';
import { PaymentErrorAlert } from './PaymentErrorAlert';
import { PaymentMethodPanel } from './PaymentMethodPanel';
import { PaymentMethodTabs } from './PaymentMethodTabs';
import { PaymentOrderSummary } from './PaymentOrderSummary';
import { PaymentUnavailable } from './PaymentUnavailable';
import { TestModeBanner } from './TestModeBanner';
import { isPaid } from './payment-status';

/** The loaded order: the payment form while it awaits payment, otherwise where to go next. */
export function PaymentStep({
  order,
  config,
  guestToken,
  onNotPayable,
}: {
  order: CustomerOrder;
  config: PaymentConfig;
  guestToken: string | null;
  onNotPayable: () => void;
}) {
  const t = useTranslations('payment');
  const { state, dispatch, pay } = usePayment({ orderId: order.id, guestToken, onNotPayable });
  const total = Number(order.total);
  const amount = formatPrice(total);
  const busy = state.paying || state.succeeded;

  if (order.status !== 'PENDING_PAYMENT') {
    return (
      <PaymentUnavailable
        alreadyPaid={isPaid(order)}
        error={state.error}
        orderHref={orderPageHref(order.id, guestToken)}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6">
      {config.testMode && <TestModeBanner />}

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-normal flex items-center gap-2">
          <Lock size={20} className="text-ocean-700" aria-hidden="true" /> {t('title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('orderLabel')}{' '}
          <span className="font-mono" dir="ltr">
            {order.orderNumber}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <section className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5 sm:p-6" aria-labelledby="pay-methods">
          <h2 id="pay-methods" className="sr-only">
            {t('methodsLabel')}
          </h2>
          <PaymentMethodTabs
            methods={config.methods}
            selected={state.method}
            disabled={busy}
            onSelect={(method) => dispatch({ type: 'selectMethod', method })}
            onMove={(method) => dispatch({ type: 'moveToMethod', method })}
          />

          {state.error && <PaymentErrorAlert error={state.error} />}

          {state.succeeded && (
            <p role="status" className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 size={16} aria-hidden="true" /> {t('success')}
            </p>
          )}

          <PaymentMethodPanel
            method={state.method}
            order={order}
            total={total}
            amount={amount}
            config={config}
            busy={busy}
            attempt={state.attempt}
            onPay={pay}
          />

          <p className="mt-6 text-xs text-gray-400 flex items-center gap-1.5">
            <Lock size={12} aria-hidden="true" /> {t('secureNote')}
          </p>
        </section>

        <PaymentOrderSummary order={order} amount={amount} />
      </div>
    </div>
  );
}
