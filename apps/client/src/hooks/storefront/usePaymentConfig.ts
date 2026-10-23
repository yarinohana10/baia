'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { normalizePaymentConfig, type PaymentConfig } from '@/lib/payment';

/** Used when /payment/config is unreachable: no test UI, no installments (the server still enforces the real flag). */
export const FALLBACK_PAYMENT_CONFIG: PaymentConfig = {
  enabled: true,
  provider: 'unknown',
  testMode: false,
  methods: ['card', 'bit', 'apple_pay'],
  installments: { max: 1, minTotal: 0 },
};

/** GET /payment/config (null while loading). */
export function usePaymentConfig(): PaymentConfig | null {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .get<PaymentConfig>('/payment/config')
      .then((res) => {
        if (!cancelled) setConfig(normalizePaymentConfig(res.data));
      })
      .catch(() => {
        if (!cancelled) setConfig(FALLBACK_PAYMENT_CONFIG);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return config;
}
