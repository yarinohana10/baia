import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-ocean-700 text-white px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-lg font-light tracking-widest">BAIA Admin</span>
          <span className="text-sm text-white/70">{session.user.email}</span>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-8 px-6">{children}</main>
    </div>
  );
}
