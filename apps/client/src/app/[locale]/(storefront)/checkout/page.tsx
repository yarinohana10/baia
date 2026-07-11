'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useCartStore } from '@/store/cart';
import { ShieldCheck, Truck, CreditCard, AlertTriangle } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('cart');
  const { items, fetchCart } = useCartStore();

  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [apartment, setApartment] = useState('');
  const [zip, setZip] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<{ discount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchCart(); }, []);

  const subtotal = items.reduce((sum, item) => {
    const variant = item.variant;
    let price = parseFloat(variant.priceOverride || variant.product.basePrice);
    if (variant.salePrice) {
      const now = new Date();
      const start = variant.saleStart ? new Date(variant.saleStart) : null;
      const end = variant.saleEnd ? new Date(variant.saleEnd) : null;
      if ((!start || now >= start) && (!end || now <= end)) {
        price = parseFloat(variant.salePrice);
      }
    }
    return sum + price * item.quantity;
  }, 0);

  const freeShippingThreshold = 249;
  const shippingCost = subtotal >= freeShippingThreshold ? 0 : 29.9;
  const discount = couponResult?.discount || 0;
  const total = subtotal + shippingCost - discount;

  const applyCoupon = async () => {
    setCouponError('');
    setCouponResult(null);
    if (!couponCode) return;
    try {
      const res = await api.post('/coupons/validate', {
        code: couponCode,
        cartTotal: subtotal,
      });
      setCouponResult(res.data);
    } catch (err: any) {
      setCouponError(err.response?.data?.message || 'Invalid coupon');
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);

    try {
      // Get cart ID
      const cartRes = await api.get('/cart', {
        headers: { 'x-guest-session': localStorage.getItem('baia_guest_session') || '' },
      });

      const order = await api.post('/orders', {
        customerEmail: email,
        couponCode: couponCode || undefined,
        shippingCity: city,
        shippingStreet: street,
        shippingNumber: number,
        shippingApartment: apartment || undefined,
        shippingZip: zip || undefined,
        cartId: cartRes.data.id,
      });

      // Process payment (mock)
      await api.post('/payment/charge', {
        orderId: order.data.id,
        customerEmail: email,
      });

      router.push(`/order-confirmation/${order.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4 text-center text-gray-400">
        <p>Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
      <h1 className="text-2xl font-light tracking-[0.2em] uppercase mb-8">{t('checkout')}</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-6 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact */}
          <section className="bg-white border border-gray-200 p-6 space-y-4">
            <h2 className="font-medium text-gray-800 flex items-center gap-2">
              <CreditCard size={16} /> Contact
            </h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                placeholder="your@email.com"
                required
              />
            </div>
          </section>

          {/* Shipping */}
          <section className="bg-white border border-gray-200 p-6 space-y-4">
            <h2 className="font-medium text-gray-800 flex items-center gap-2">
              <Truck size={16} /> Shipping Address
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Street</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Number</label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Apartment</label>
                <input
                  type="text"
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">ZIP</label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Coupon */}
          <section className="bg-white border border-gray-200 p-6 space-y-3">
            <h2 className="font-medium text-gray-800">Coupon Code</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none uppercase"
                placeholder="Enter code"
              />
              <button
                onClick={applyCoupon}
                className="px-4 py-2 text-sm bg-ocean-700 text-white hover:bg-ocean-800 transition-colors"
              >
                Apply
              </button>
            </div>
            {couponError && <p className="text-xs text-red-500">{couponError}</p>}
            {couponResult && (
              <p className="text-xs text-green-600">
                Discount applied: -₪{couponResult.discount.toFixed(2)}
              </p>
            )}
          </section>
        </div>

        {/* Order Summary */}
        <div className="bg-white border border-gray-200 p-6 h-fit space-y-4">
          <h2 className="font-medium text-gray-800">Order Summary</h2>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {items.map((item) => {
              const product = item.variant.product;
              const name = locale === 'he' ? product.nameHe : product.nameEn;
              return (
                <div key={item.id} className="flex justify-between text-sm">
                  <div>
                    <p className="text-gray-700 line-clamp-1">{name}</p>
                    <p className="text-xs text-gray-400">
                      {item.variant.color} / {item.variant.size} x{item.quantity}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('subtotal')}</span>
              <span>₪{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('shipping')}</span>
              <span className={shippingCost === 0 ? 'text-green-600' : ''}>
                {shippingCost === 0 ? t('freeShipping') : `₪${shippingCost.toFixed(2)}`}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="text-green-600">-₪{discount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3 flex justify-between font-medium text-lg">
              <span>{t('total')}</span>
              <span>₪{total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !email || !city || !street || !number}
            className="w-full bg-ocean-700 text-white py-3 text-sm tracking-[0.15em] uppercase hover:bg-ocean-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ShieldCheck size={16} />
            {submitting ? 'Processing...' : 'Place Order'}
          </button>

          <p className="text-xs text-center text-gray-400">
            Secure checkout with encrypted payment
          </p>
        </div>
      </div>
    </div>
  );
}
