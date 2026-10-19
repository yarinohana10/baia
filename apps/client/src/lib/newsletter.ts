import { api } from '@/lib/api';

export type NewsletterSource = 'footer' | 'checkout' | 'register';

/** Public opt-in. `consent` must be an explicit, user-ticked `true`. */
export async function subscribeToNewsletter(email: string, locale: string, source: NewsletterSource) {
  await api.post('/newsletter/subscribe', { email, locale, consent: true, source });
}

export async function unsubscribeFromNewsletter(email: string) {
  await api.post('/newsletter/unsubscribe', { email });
}

export type MarketingConsent = { marketingConsent: boolean; marketingConsentAt: string | null };

export async function getMyMarketingConsent(): Promise<MarketingConsent> {
  const res = await api.get<MarketingConsent>('/newsletter/me');
  return res.data;
}

export async function setMyMarketingConsent(
  consent: boolean,
  opts: { locale?: string; source?: 'register' | 'account' | 'checkout' } = {},
): Promise<MarketingConsent> {
  const res = await api.put<MarketingConsent>('/newsletter/me', { consent, ...opts });
  return res.data;
}
