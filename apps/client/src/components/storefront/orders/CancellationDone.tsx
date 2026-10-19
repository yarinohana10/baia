'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import type { CancellationMode } from '@/hooks/storefront/useCancellationSubmit';

/** Green confirmation after the shopper cancelled or sent a request. */
export function CancellationDone({ mode, unpaid }: { mode: CancellationMode; unpaid: boolean }) {
  const t = useTranslations('cancellation');
  let text = t('requestDone');
  if (mode === 'cancel') text = unpaid ? t('cancelledUnpaid') : t('cancelledDone');
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
      <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
