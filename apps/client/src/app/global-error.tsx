'use client';

import { ErrorFallback } from '@/components/error-fallback';

/** Last-resort boundary (errors in the root layout). Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <ErrorFallback error={error} reset={reset} locale="he" />
      </body>
    </html>
  );
}
