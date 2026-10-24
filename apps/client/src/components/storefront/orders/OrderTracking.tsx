'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { trackingUrl } from '@/lib/orders';

/** The parcel's tracking number, with the carrier link when one is configured. */
export function OrderTracking({ trackingNumber }: { trackingNumber: string }) {
  const tPage = useTranslations('orderPage');
  const tOrders = useTranslations('orders');
  const trackLink = trackingUrl(trackingNumber);
  return (
    <div className="border-t border-gray-100 pt-4 text-sm">
      <p className="text-xs text-gray-400 mb-1">{tOrders('tracking')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono" dir="ltr">{trackingNumber}</p>
        {trackLink && (
          <a
            href={trackLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-black underline underline-offset-2 hover:text-black"
          >
            {tPage('trackParcel')} <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
