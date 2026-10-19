import { isAxiosError } from 'axios';
import type { ContactPayload } from '@baia/shared';
import { api } from '@/lib/api';

/** A validated contact form (see `contactSchema`); `website` is the honeypot, always empty for humans. */
export type ContactInput = ContactPayload;

/** Same rule as the API's ContactMessage DTO (HTML patterns are implicitly anchored). */
export { PHONE_PATTERN as CONTACT_PHONE_PATTERN } from '@baia/shared';

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
