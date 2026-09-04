import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AdminShell } from '@/components/admin/AdminShell';

async function getSession() {
  const headersList = await headers();
  const cookie = headersList.get('cookie') || '';

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:8000'}/api/auth/get-session`,
      {
        headers: { cookie },
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
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  return <AdminShell user={session.user}>{children}</AdminShell>;
}
