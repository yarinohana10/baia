'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Package, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const statusColors: Record<string, string> = {
  PENDING_PAYMENT: 'bg-yellow-50 text-yellow-600',
  CONFIRMED: 'bg-blue-50 text-blue-600',
  PROCESSING: 'bg-indigo-50 text-indigo-600',
  SHIPPED: 'bg-purple-50 text-purple-600',
  DELIVERED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
  REFUNDED: 'bg-red-50 text-red-500',
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const fetchOrders = async () => {
    const res = await api.get('/admin/orders', {
      params: { status: statusFilter || undefined, page, limit: 20 },
    });
    setOrders(res.data.orders);
    setTotal(res.data.total);
    setTotalPages(res.data.totalPages);
  };

  useEffect(() => { fetchOrders(); }, [page, statusFilter]);

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus) return;
    await api.put(`/admin/orders/${selectedOrder.id}/status`, {
      status: newStatus,
      trackingNumber: trackingNumber || undefined,
    });
    setSelectedOrder(null);
    setNewStatus('');
    setTrackingNumber('');
    fetchOrders();
  };

  const openDetail = async (id: string) => {
    const res = await api.get(`/admin/orders/${id}`);
    setSelectedOrder(res.data);
    setNewStatus(res.data.status);
    setTrackingNumber(res.data.trackingNumber || '');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light tracking-wider">Orders ({total})</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-3 py-1 text-xs uppercase tracking-wider border transition-colors ${
            !statusFilter ? 'border-ocean-700 bg-ocean-700 text-white' : 'border-gray-300 hover:border-ocean-500'
          }`}
        >
          All
        </button>
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1 text-xs uppercase tracking-wider border transition-colors ${
              statusFilter === s ? 'border-ocean-700 bg-ocean-700 text-white' : 'border-gray-300 hover:border-ocean-500'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-mono font-medium">{selectedOrder.orderNumber}</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                Close
              </button>
            </div>

            <div className="text-sm space-y-1">
              <p><span className="text-gray-400">Email:</span> {selectedOrder.customerEmail}</p>
              <p><span className="text-gray-400">Date:</span> {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              <p>
                <span className="text-gray-400">Address:</span>{' '}
                {selectedOrder.shippingStreet} {selectedOrder.shippingNumber}
                {selectedOrder.shippingApartment ? `, Apt ${selectedOrder.shippingApartment}` : ''},{' '}
                {selectedOrder.shippingCity} {selectedOrder.shippingZip}
              </p>
              {selectedOrder.paymentRef && (
                <p><span className="text-gray-400">Payment:</span> {selectedOrder.paymentRef}</p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
              {selectedOrder.items.map((item: any) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.productName} ({item.color}/{item.size}) x{item.quantity}</span>
                  <span>₪{(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 font-medium flex justify-between">
                <span>Total</span>
                <span>₪{parseFloat(selectedOrder.total).toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Update Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:border-ocean-500 focus:outline-none"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              {(newStatus === 'SHIPPED' || selectedOrder.trackingNumber) && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tracking Number</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                    placeholder="IL123456789"
                  />
                </div>
              )}
              <button
                onClick={handleStatusUpdate}
                className="bg-ocean-700 text-white px-5 py-2 text-sm hover:bg-ocean-800 transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-start px-4 py-3 font-medium text-gray-500">Order</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Customer</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Items</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Total</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="text-end px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No orders.</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{order.customerEmail}</td>
                  <td className="px-4 py-3 text-gray-600">{order.items.length}</td>
                  <td className="px-4 py-3 font-medium">₪{parseFloat(order.total).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 uppercase tracking-wider ${statusColors[order.status] || ''}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => openDetail(order.id)}
                      className="p-1.5 text-gray-400 hover:text-ocean-600 transition-colors"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-2 border border-gray-300 disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="p-2 border border-gray-300 disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
