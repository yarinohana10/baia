export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-light tracking-wider mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard title="Products" value="—" href="/admin/products" />
        <DashboardCard title="Orders" value="—" href="/admin/orders" />
        <DashboardCard title="Categories" value="—" href="/admin/categories" />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  href,
}: {
  title: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block bg-white p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
    >
      <p className="text-sm text-gray-500 uppercase tracking-wider">{title}</p>
      <p className="text-3xl font-light mt-2 text-ocean-700">{value}</p>
    </a>
  );
}
