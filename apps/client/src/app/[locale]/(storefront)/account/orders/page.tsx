'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Package, ChevronRight } from 'lucide-react';

const statusColors: Record<string, string> = {
  PENDING_PAYMENT: 'bg-yellow-50 text-yellow-600',
  CONFIRMED: 'bg-blue-50 text-blue-600',
  PROCESSING: 'bg-indigo-50 text-indigo-600',
  SHIPPED: 'bg-purple-50 text-purple-600',
  DELIVERED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
  REFUNDED: 'bg-red-50 text-red-500',
};

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/orders/my')
      .then((res) => setOrders(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 animate-pulse">
        <div className="h-8 bg-gray-200 w-1/4 mb-8" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 mb-3" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <h1 className="text-2xl font-light tracking-[0.2em] uppercase mb-8">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-400 mb-6">No orders yet.</p>
          <Link
            href="/"
            className="inline-block bg-ocean-700 text-white px-8 py-3 text-sm tracking-wider hover:bg-ocean-800 transition-colors"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/order-confirmation/${order.id}`}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 hover:border-ocean-300 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-mono text-sm font-medium">{order.orderNumber}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString()} &middot;{' '}
                    {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm">₪{parseFloat(order.total).toFixed(2)}</span>
                <span
                  className={`text-xs px-2 py-0.5 uppercase tracking-wider ${
                    statusColors[order.status] || 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {order.status.replace('_', ' ')}
                </span>
                <ChevronRight size={14} className="text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
