import { isAxiosError } from 'axios';

/** ` (server message)` to append to a failure notice, or '' when the API sent none. */
export function serverMessage(err: unknown): string {
  const message: unknown = isAxiosError(err) ? err.response?.data?.message : undefined;
  return typeof message === 'string' && message ? ` (${message})` : '';
}

/** True when activating failed because the product has no active sizes. */
export function isNoSizesError(err: unknown): boolean {
  const fields: unknown = isAxiosError(err) ? err.response?.data?.errors : undefined;
  return Array.isArray(fields) && fields.some((e) => e?.field === 'variants');
}
