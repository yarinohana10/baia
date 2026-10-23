'use client';

import { useEffect } from 'react';
import { getErrorReporter } from '@/lib/error-reporting';

const COPY = {
  he: { title: 'משהו השתבש', body: 'אירעה תקלה בלתי צפויה. אפשר לנסות שוב, ואם זה חוזר, נשמח שתיצרו איתנו קשר.', retry: 'נסו שוב' },
  en: { title: 'Something went wrong', body: 'An unexpected error occurred. You can try again, and if it keeps happening please contact us.', retry: 'Try again' },
} as const;

/** Shared UI + reporting for the Next.js error boundaries. */
export function ErrorFallback({ error, reset, locale }: { error: Error & { digest?: string }; reset: () => void; locale: string }) {
  useEffect(() => {
    getErrorReporter().captureException(error, { tags: { boundary: 'error', digest: error.digest ?? '' } });
  }, [error]);

  const copy = locale === 'en' ? COPY.en : COPY.he;
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">{copy.title}</h1>
      <p className="text-sm text-neutral-600">{copy.body}</p>
      <button type="button" onClick={reset} className="rounded-full bg-black px-6 py-2 text-sm text-white">
        {copy.retry}
      </button>
    </main>
  );
}
