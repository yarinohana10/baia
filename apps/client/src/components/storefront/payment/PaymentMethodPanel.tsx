'use client';

import type { CustomerOrder } from '@/lib/orders';
import type { PaymentConfig, PaymentMethod, PayRequest } from '@/lib/payment';
import { ApplePayForm } from './ApplePayForm';
import { BitForm } from './BitForm';
import { CardForm } from './CardForm';
import { panelId, tabId } from './PaymentMethodTabs';

/** The tab panel with the selected method's form. */
export function PaymentMethodPanel({
  method,
  order,
  total,
  amount,
  config,
  busy,
  attempt,
  onPay,
}: {
  method: PaymentMethod;
  order: CustomerOrder;
  total: number;
  amount: string;
  config: PaymentConfig;
  busy: boolean;
  /** Changes after a decline, so the card form starts clean. */
  attempt: number;
  onPay: (body: PayRequest) => void;
}) {
  return (
    <div role="tabpanel" id={panelId(method)} aria-labelledby={tabId(method)}>
      {method === 'card' && <CardForm key={attempt} total={total} amount={amount} config={config} busy={busy} onPay={onPay} />}
      {method === 'bit' && (
        <BitForm amount={amount} testMode={config.testMode} initialPhone={order.phone ?? ''} busy={busy} onPay={onPay} />
      )}
      {method === 'apple_pay' && <ApplePayForm testMode={config.testMode} busy={busy} onPay={onPay} />}
    </div>
  );
}
