'use client';

import { useEffect, useRef, useState } from 'react';
import { getFreshSession, verifyEmail } from '@/lib/auth-client';

export type VerificationStatus = 'verifying' | 'success' | 'error';
type Outcome = Exclude<VerificationStatus, 'verifying'>;

async function verify(token: string): Promise<Outcome> {
  try {
    const { error } = await verifyEmail({ query: { token } });
    if (error) return 'error';
    // Refresh the cached session so the account page sees emailVerified right away.
    await getFreshSession().catch(() => undefined);
    return 'success';
  } catch {
    return 'error';
  }
}

/**
 * Verifies a single-use email token once (also under StrictMode's double
 * effect run: the request is kept in a ref and each run only subscribes to it).
 * Calls `onVerified` (e.g. a session refetch) before reporting success.
 */
export function useEmailVerification(token: string | null, onVerified: () => void): VerificationStatus {
  const [status, setStatus] = useState<VerificationStatus>(token ? 'verifying' : 'error');
  const request = useRef<{ token: string; result: Promise<Outcome> } | null>(null);

  useEffect(() => {
    if (!token) return;
    if (request.current?.token !== token) {
      // Started (and `onVerified` called) once per token, however often the effect re-runs.
      const result = verify(token).then((outcome) => {
        if (outcome === 'success') onVerified();
        return outcome;
      });
      request.current = { token, result };
    }
    let cancelled = false;
    void request.current.result.then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token, onVerified]);

  return status;
}
