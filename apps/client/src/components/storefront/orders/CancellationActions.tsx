'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import type { CancellationInfo, CustomerOrder } from '@/lib/orders';
import type { CancellationMode } from '@/hooks/storefront/useCancellationSubmit';
import { cn } from '@/lib/utils';
import { CancellationDialog } from './CancellationDialog';
import { SelfCancelWindow } from './SelfCancelWindow';

/** The window explanation, the cancel / request buttons and the dialog they open. */
export function CancellationActions({
  order,
  info,
  token,
  compact,
  onDone,
}: {
  order: CustomerOrder;
  info: CancellationInfo;
  token?: string | null;
  compact: boolean;
  onDone: (mode: CancellationMode, order: CustomerOrder) => void;
}) {
  const t = useTranslations('cancellation');
  const [mode, setMode] = useState<CancellationMode | null>(null);
  const { canSelfCancel, canRequest } = info;

  return (
    <div className={cn('space-y-3', !compact && 'rounded-xl border border-gray-200 bg-white p-5 text-start')}>
      {!compact && <h2 className="text-sm font-medium text-gray-900">{t('title')}</h2>}

      {canSelfCancel ? (
        <SelfCancelWindow
          unpaid={order.status === 'PENDING_PAYMENT'}
          deadline={info.selfCancelDeadline}
          className="text-gray-600"
        />
      ) : (
        <p className="flex items-start gap-2 text-sm text-gray-600">
          <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-gray-400" />
          <span>{info.requiresReturn ? t('requestShipped') : t('requestAfterWindow', { hours: info.windowHours })}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {canSelfCancel && (
          <button
            type="button"
            onClick={() => setMode('cancel')}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            {t('cancelButton')}
          </button>
        )}
        {canRequest && (
          <button
            type="button"
            onClick={() => setMode('request')}
            className={cn(
              canSelfCancel
                ? 'text-xs text-gray-500 underline underline-offset-2 hover:text-ocean-700'
                : 'rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50',
            )}
          >
            {canSelfCancel ? t('preferTalk') : t('requestButton')}
          </button>
        )}
      </div>

      {mode && (
        <CancellationDialog
          mode={mode}
          order={order}
          token={token}
          onClose={() => setMode(null)}
          onDone={(updated) => onDone(mode, updated)}
        />
      )}
    </div>
  );
}
