import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AdminShell } from '@/components/admin/AdminShell';
import { forwardedRequestHeaders, serverAuthUrl } from '@/lib/api-urls';
import { getLogoUrl } from '@/lib/brand';

async function getSession() {
  const headersList = await headers();

  try {
    const res = await fetch(
      // Skip the cookie cache so a just-demoted admin loses access immediately.
      `${serverAuthUrl()}/api/auth/get-session?disableCookieCache=true`,
      {
        headers: forwardedRequestHeaders(headersList),
        cache: 'no-store',
      },
    );

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, session] = await Promise.all([params, getSession()]);

  if (!session?.user) {
    redirect(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/admin`)}`);
  }
  if (session.user.role !== 'ADMIN') {
    redirect(`/${locale}`);
  }

  return <AdminShell user={session.user} logoUrl={getLogoUrl()}>{children}</AdminShell>;
}
