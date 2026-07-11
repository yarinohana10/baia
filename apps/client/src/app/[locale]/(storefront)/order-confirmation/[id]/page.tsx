'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { CheckCircle2, Package } from 'lucide-react';

export default function OrderConfirmationPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    api.get(`/orders/${id}`).then((res) => setOrder(res.data)).catch(() => {});
  }, [id]);

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center animate-pulse">
        <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="h-6 bg-gray-200 w-1/2 mx-auto mb-2" />
        <div className="h-4 bg-gray-200 w-1/3 mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center">
      <CheckCircle2 size={64} className="mx-auto text-green-500 mb-6" />
      <h1 className="text-3xl font-light tracking-wider mb-2">Thank You!</h1>
      <p className="text-gray-500 mb-8">Your order has been placed successfully.</p>

      <div className="bg-white border border-gray-200 p-6 text-start space-y-4 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Order Number</p>
            <p className="font-mono font-medium">{order.orderNumber}</p>
          </div>
          <span className="text-xs px-3 py-1 bg-green-50 text-green-600 uppercase tracking-wider">
            {order.status.replace('_', ' ')}
          </span>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-2">
          {order.items.map((item: any) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.productName} ({item.color}/{item.size}) x{item.quantity}
              </span>
              <span>₪{(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Subtotal</span>
            <span>₪{parseFloat(order.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Shipping</span>
            <span>
              {parseFloat(order.shippingCost) === 0
                ? 'Free'
                : `₪${parseFloat(order.shippingCost).toFixed(2)}`}
            </span>
          </div>
          {parseFloat(order.discountAmount) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-₪{parseFloat(order.discountAmount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium text-base pt-2 border-t border-gray-100">
            <span>Total</span>
            <span>₪{parseFloat(order.total).toFixed(2)}</span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 text-sm">
          <p className="text-xs text-gray-400 mb-1">Shipping to</p>
          <p>
            {order.shippingStreet} {order.shippingNumber}
            {order.shippingApartment ? `, Apt ${order.shippingApartment}` : ''}
          </p>
          <p>{order.shippingCity} {order.shippingZip}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Link
          href="/"
          className="px-6 py-2.5 text-sm border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Continue Shopping
        </Link>
        <Link
          href="/account/orders"
          className="flex items-center gap-2 px-6 py-2.5 text-sm bg-ocean-700 text-white hover:bg-ocean-800 transition-colors"
        >
          <Package size={14} /> My Orders
        </Link>
      </div>
    </div>
  );
}
