import { isAxiosError } from 'axios';
import { api } from '@/lib/api';

export type ContactInput = {
  name: string;
  email: string;
  phone?: string;
  orderNumber?: string;
  subject?: string;
  message: string;
  locale: string;
  /** Honeypot; always empty for humans. */
  website?: string;
};

/** Same rule as the API's ContactMessage DTO (HTML patterns are implicitly anchored). */
export const CONTACT_PHONE_PATTERN = '\\+?[0-9][0-9\\s\\-]{7,18}';

export type ContactError = 'rateLimited' | 'invalid' | 'failed';

export async function sendContactMessage(input: ContactInput): Promise<void> {
  const body = Object.fromEntries(
    Object.entries(input).filter(([, v]) => typeof v === 'string' && v.trim() !== ''),
  );
  await api.post('/contact', body);
}

export function contactErrorKind(err: unknown): ContactError {
  if (isAxiosError(err)) {
    if (err.response?.status === 429) return 'rateLimited';
    if (err.response?.status === 400) return 'invalid';
  }
  return 'failed';
}
