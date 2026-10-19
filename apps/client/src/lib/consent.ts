/**
 * Cookie-consent choice, stored in the `baia_consent` cookie so both the client
 * and (later) server code can read it. We only use essential cookies today;
 * gate any future analytics/marketing script on `hasAnalyticsConsent()`.
 */
export const CONSENT_COOKIE = 'baia_consent';
export type ConsentChoice = 'essential' | 'all';
/** Window event fired by `writeConsent()` (detail: the choice). */
export const CONSENT_EVENT = 'baia:consent';

/** 180 days, then we ask again. */
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export function parseConsent(cookieHeader: string | null | undefined): ConsentChoice | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === CONSENT_COOKIE) {
      const value = decodeURIComponent(rest.join('='));
      return value === 'all' || value === 'essential' ? value : null;
    }
  }
  return null;
}

export function readConsent(): ConsentChoice | null {
  if (typeof document === 'undefined') return null;
  try {
    return parseConsent(document.cookie);
  } catch {
    return null;
  }
}

export function writeConsent(choice: ConsentChoice): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
}

/** True only after the visitor chose "accept all". */
export function hasAnalyticsConsent(): boolean {
  return readConsent() === 'all';
}
