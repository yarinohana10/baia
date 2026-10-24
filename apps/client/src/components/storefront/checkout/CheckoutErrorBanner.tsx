import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import type { ErrorMessage } from '@/lib/shop-errors';

/** Why placing the order failed (a `checkout.errors` message). */
export function CheckoutErrorBanner({ error }: { error: ErrorMessage | null }) {
  const tErrors = useTranslations('checkout.errors');
  if (!error) return null;
  return (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-6 flex items-center gap-2 rounded-none"
    >
      <AlertTriangle size={14} className="shrink-0" /> {tErrors(error.key, error.values)}
    </div>
  );
}
