import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

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
      <nav className="bg-ocean-700 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-lg font-light tracking-[0.2em]">BAIA</span>
          <span className="text-xs tracking-wider text-white/60 uppercase">Admin</span>
        </div>
        <span className="text-sm text-white/70">{session.user.email}</span>
      </nav>
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
