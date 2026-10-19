import { isAxiosError } from 'axios';
import type { useTranslations } from 'next-intl';

type OrdersT = ReturnType<typeof useTranslations<'admin.orders'>>;

/** User-facing message for a failed admin order request (`fallback` when nothing more specific applies). */
export function orderErrorMessage(err: unknown, fallback: string, t: OrdersT): string {
  if (!isAxiosError(err) || !err.response) return fallback;
  const { status, data } = err.response;
  const message: unknown = data?.message;
  if (status === 409) {
    return typeof message === 'string' && /reload/i.test(message) ? t('statusChangedMeanwhile') : t('transitionNotAllowed');
  }
  if (status === 404) return t('orderNotFound');
  if (typeof message === 'string' && message) return `${fallback} (${message})`;
  return fallback;
}
