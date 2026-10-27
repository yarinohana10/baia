import Link from 'next/link';

// Fallback for URLs outside the locale tree (the localized 404 lives in [locale]/(storefront)/not-found.tsx).
export default function RootNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#FAF6EF', color: '#0F2A36', textAlign: 'center', padding: '20vh 1rem' }}>
        <h1 style={{ fontSize: 32, fontWeight: 500 }}>404</h1>
        <p>
          <Link href="/en">BAIA — Home</Link> · <Link href="/he">לדף הבית</Link>
        </p>
      </body>
    </html>
  );
}
