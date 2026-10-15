import Link from 'next/link';

// Fallback for URLs outside the locale tree (the localized 404 lives in [locale]/(storefront)/not-found.tsx).
export default function RootNotFound() {
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#FAF6EF', color: '#0F2A36', textAlign: 'center', padding: '20vh 1rem' }}>
        <h1 style={{ fontSize: 32, fontWeight: 500 }}>404</h1>
        <p>
          <Link href="/he">BAIA — לדף הבית</Link> · <Link href="/en">Home</Link>
        </p>
      </body>
    </html>
  );
}
