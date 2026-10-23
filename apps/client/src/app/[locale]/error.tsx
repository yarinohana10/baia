'use client';

import { useParams } from 'next/navigation';
import { ErrorFallback } from '@/components/error-fallback';

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useParams<{ locale?: string }>();
  return <ErrorFallback error={error} reset={reset} locale={locale ?? 'he'} />;
}
