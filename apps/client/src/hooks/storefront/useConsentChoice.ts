'use client';

import { useSyncExternalStore } from 'react';
import { CONSENT_EVENT, readConsent, type ConsentChoice } from '@/lib/consent';

/** `undefined` while server rendering / hydrating: the cookie is only read in the browser. */
export type ConsentSnapshot = ConsentChoice | null | undefined;

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

const serverSnapshot = (): ConsentSnapshot => undefined;

/**
 * The visitor's cookie-consent choice (`null` = not chosen yet), kept in sync
 * with `writeConsent()`. Hydrates as `undefined` so server and client markup match.
 */
export function useConsentChoice(): ConsentSnapshot {
  return useSyncExternalStore(subscribe, readConsent, serverSnapshot);
}
