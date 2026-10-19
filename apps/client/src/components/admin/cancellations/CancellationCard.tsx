'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { CancellationHeader } from './CancellationHeader';
import { CancellationBadges } from './CancellationBadges';
import { CancellationResolveForm } from './CancellationResolveForm';
import { CancellationOutcome } from './CancellationOutcome';
import type { AdminCancellation } from './types';

/** One cancellation request: order summary, reason, then the resolve form or its outcome. */
export function CancellationCard({
  request,
  windowHours,
  onResolved,
}: {
  request: AdminCancellation;
  windowHours: number;
  onResolved: (text: string, kind: 'success' | 'error') => void;
}) {
  const t = useTranslations('admin.cancellations');
  const tReasons = useTranslations('cancellation.reasons');

  return (
    <Card>
      <CardContent className="space-y-4">
        <CancellationHeader request={request} />
        <CancellationBadges request={request} windowHours={windowHours} />

        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
          <p>
            <span className="text-muted-foreground">{t('reason')}: </span>
            <span className="font-medium">{tReasons.has(request.reason) ? tReasons(request.reason) : request.reason}</span>
          </p>
          {request.details && <p className="mt-1 whitespace-pre-line text-foreground">{request.details}</p>}
        </div>

        {request.status === 'REQUESTED' ? (
          <CancellationResolveForm request={request} onResolved={onResolved} />
        ) : (
          <CancellationOutcome request={request} />
        )}
      </CardContent>
    </Card>
  );
}
