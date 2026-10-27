'use client';

import { ErrorFallback } from '@/components/error-fallback';

/** Last-resort boundary (errors in the root layout). Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <ErrorFallback error={error} reset={reset} locale="en" />
      </body>
    </html>
  );
}
