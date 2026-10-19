'use client';

import { useCallback, useState } from 'react';

/** How an action settled: `navigating` keeps the busy state while the page is left. */
export type ActionOutcome = 'done' | 'navigating';

/**
 * A busy flag around one async action (submit buttons, sign-in redirects).
 * The action handles its own errors; the flag always clears unless the
 * action reports that it is navigating away.
 */
export function useBusyAction(): [busy: boolean, run: (action: () => Promise<ActionOutcome>) => Promise<void>] {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (action: () => Promise<ActionOutcome>) => {
    setBusy(true);
    let outcome: ActionOutcome;
    try {
      outcome = await action();
    } catch (err) {
      setBusy(false);
      throw err;
    }
    // Leaving the page: keep the spinner until the next one replaces it.
    if (outcome !== 'navigating') setBusy(false);
  }, []);
  return [busy, run];
}
