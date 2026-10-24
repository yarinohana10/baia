'use client';

import { useTranslations } from 'next-intl';
import { Wallet } from 'lucide-react';
import type { PayRequest } from '@/lib/payment';
import { BusyIcon } from './BusyIcon';

/** Apple Pay: one tap, instant approval in the mock. */
export function ApplePayForm({
  testMode,
  busy,
  onPay,
}: {
  testMode: boolean;
  busy: boolean;
  onPay: (body: PayRequest) => void;
}) {
  const t = useTranslations('payment');
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('applePay.intro')}</p>
      <button
        type="button"
        onClick={() => onPay({ method: 'apple_pay', ...(testMode ? { simulation: 'success' as const } : {}) })}
        disabled={busy}
        aria-busy={busy}
        className="w-full bg-black text-white py-3 text-sm font-medium rounded-none hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <BusyIcon busy={busy} icon={<Wallet size={16} aria-hidden="true" />} />
        {busy ? t('processing') : t('applePay.button')}
      </button>
    </div>
  );
}
