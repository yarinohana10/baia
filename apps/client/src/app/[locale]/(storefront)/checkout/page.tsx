'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { checkoutSchema, toCreateOrderPayload, type CreateOrderPayload } from '@baia/shared';
import { addressesApi, PHONE_PATTERN, sameAddress, streetLine, type Address, type AddressInput } from '@/lib/addresses';
import { clearIssue, firstInvalidField, invalidProps, validateForm, type FieldIssues } from '@/lib/form-errors';
import { FieldError } from '@/components/forms/FieldError';
import { formatPrice } from '@/lib/catalog/pricing';
import { errorCode, shopErrorMessage, type ErrorMessage } from '@/lib/shop-errors';
import { cartSubtotal, etaFor, lineIssue, shippingFor, useCartStore, type DeliveryMethod } from '@/store/cart';
import { formatEta } from '@/lib/orders';
import { cn } from '@/lib/utils';
import { FreeShippingProgress } from '@/components/storefront/FreeShippingProgress';
import { PickupPointPicker, type PickupPoint } from '@/components/storefront/orders/PickupPointPicker';
import { ShieldCheck, Truck, CreditCard, AlertTriangle, X, MapPin, Home, Package } from 'lucide-react';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-ocean-500 focus:outline-none';
const labelClass = 'block text-xs font-medium text-gray-500 mb-1';

type AppliedCoupon = { code: string; discount: number; subtotal: number };

/** checkoutSchema field → input id, in on-screen order (for focusing the first invalid field). */
const FIELD_INPUTS = {
  recipientName: 'checkout-name',
  customerEmail: 'checkout-email',
  phone: 'checkout-phone',
  shippingCity: 'checkout-city',
  shippingStreet: 'checkout-street',
  shippingNumber: 'checkout-number',
  shippingApartment: 'checkout-apartment',
  shippingZip: 'checkout-zip',
  couponCode: 'checkout-coupon',
} as const;
const FIELD_ORDER = Object.keys(FIELD_INPUTS);

export default function CheckoutPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('cart');
  const tCheckout = useTranslations('checkout');
  const tErrors = useTranslations('checkout.errors');
  const tDelivery = useTranslations('delivery');
  const { items, loaded, shipping, fetchCart, fetchShipping } = useCartStore();
  const { data: session } = useSession();

  const [email, setEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [apartment, setApartment] = useState('');
  const [zip, setZip] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('COURIER');
  const [pickupPoint, setPickupPoint] = useState<PickupPoint | null>(null);
  const [pickupMissing, setPickupMissing] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [saveAddress, setSaveAddress] = useState(true);
  const prefilledFromAddress = useRef(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<ErrorMessage | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [issues, setIssues] = useState<FieldIssues>({});
  const edited = (field: string) => setIssues((v) => clearIssue(v, field));
  /** aria wiring + the translated error under a checkout input. */
  const fieldAria = (field: keyof typeof FIELD_INPUTS) => invalidProps(issues, field, `${FIELD_INPUTS[field]}-error`);
  const fieldError = (field: keyof typeof FIELD_INPUTS) => (
    <FieldError id={`${FIELD_INPUTS[field]}-error`} issue={issues[field]} className="text-red-500" />
  );
  // An order already created from the cart (e.g. the shopper came back from
  // the payment page): continue to pay it instead of creating a second order.
  const [pendingOrder, setPendingOrder] = useState<{ id: string; token?: string } | null>(null);

  useEffect(() => {
    fetchCart();
    fetchShipping();
  }, [fetchCart, fetchShipping]);

  // Signed-in shoppers: start from the account's email and name.
  const sessionEmail = session?.user?.email;
  const sessionName = session?.user?.name;
  useEffect(() => {
    if (sessionEmail) setEmail((current) => current || sessionEmail);
    if (sessionName) setRecipientName((current) => current || sessionName);
  }, [sessionEmail, sessionName]);

  const applyAddress = (address: Address) => {
    setRecipientName(address.recipientName);
    setPhone(address.phone);
    setCity(address.city);
    setStreet(address.street);
    setNumber(address.number);
    setApartment(address.apartment ?? '');
    setZip(address.zip ?? '');
  };

  // Signed-in shoppers: load the address book and start from the default address.
  const sessionUserId = session?.user?.id;
  useEffect(() => {
    if (!sessionUserId) {
      setSavedAddresses([]);
      return;
    }
    let cancelled = false;
    addressesApi
      .list()
      .then((list) => {
        if (cancelled) return;
        setSavedAddresses(list);
        const preferred = list.find((a) => a.isDefault) ?? list[0];
        if (preferred && !prefilledFromAddress.current) {
          prefilledFromAddress.current = true;
          applyAddress(preferred);
        }
      })
      // The address book is a convenience: checkout works without it.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  const addressInput: AddressInput = { recipientName, phone, city, street, number, apartment, zip };
  const matchedAddress = savedAddresses.find((a) => sameAddress(a, addressInput)) ?? null;
  const isPickup = deliveryMethod === 'PICKUP_POINT';
  const offerSaveAddress = !!sessionUserId && !matchedAddress && !isPickup;

  const chooseSavedAddress = (id: string) => {
    const address = savedAddresses.find((a) => a.id === id);
    if (address) {
      applyAddress(address);
    } else {
      // "A new address": keep the contact details, clear the address itself.
      setCity('');
      setStreet('');
      setNumber('');
      setApartment('');
      setZip('');
    }
  };

  const subtotal = cartSubtotal(items);
  const shippingCost = shippingFor(subtotal, shipping, deliveryMethod);
  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal + shippingCost - discount);
  const hasIssues = items.some((item) => lineIssue(item));

  // The discount depends on the subtotal: re-check the coupon whenever the cart changes.
  useEffect(() => {
    if (!appliedCoupon || appliedCoupon.subtotal === subtotal || pendingOrder || subtotal <= 0) return;
    let cancelled = false;
    const { code } = appliedCoupon;
    api
      .post('/coupons/validate', { code, cartTotal: subtotal })
      .then((res) => {
        if (!cancelled) setAppliedCoupon({ code, discount: Number(res.data.discount) || 0, subtotal });
      })
      .catch((err) => {
        if (cancelled) return;
        setAppliedCoupon(null);
        setCouponError(shopErrorMessage(err, locale));
      });
    return () => {
      cancelled = true;
    };
  }, [appliedCoupon, subtotal, pendingOrder, locale]);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    setCouponError(null);
    setAppliedCoupon(null);
    if (!code) return;
    setCouponChecking(true);
    try {
      const res = await api.post('/coupons/validate', { code, cartTotal: subtotal });
      setAppliedCoupon({ code, discount: Number(res.data.discount) || 0, subtotal });
    } catch (err) {
      setCouponError(shopErrorMessage(err, locale));
    } finally {
      setCouponChecking(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  const onCouponKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter applies the coupon instead of submitting the whole order.
    if (e.key === 'Enter') {
      e.preventDefault();
      void applyCoupon();
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || (!pendingOrder && hasIssues)) return;
    let payload: CreateOrderPayload | null = null;
    if (!pendingOrder) {
      const check = validateForm(checkoutSchema, {
        customerEmail: email,
        recipientName,
        phone,
        locale: locale === 'en' ? 'en' : 'he',
        couponCode: appliedCoupon?.code,
        deliveryMethod,
        marketingConsent,
        acceptTerms: termsAccepted,
        ...(isPickup
          ? { pickupPointId: pickupPoint?.id }
          : {
              shippingCity: city,
              shippingStreet: street,
              shippingNumber: number,
              shippingApartment: apartment,
              shippingZip: zip,
            }),
      });
      setIssues(check.errors);
      if (!check.success) {
        const first = firstInvalidField(check.errors, FIELD_ORDER) as keyof typeof FIELD_INPUTS | undefined;
        if (check.errors.pickupPointId) {
          setPickupMissing(true);
          document.getElementById('checkout-delivery')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (first && FIELD_INPUTS[first]) {
          document.getElementById(FIELD_INPUTS[first])?.focus();
        }
        return;
      }
      payload = toCreateOrderPayload(check.data);
    }
    setError(null);
    setSubmitting(true);

    let order = pendingOrder;
    try {
      if (!order) {
        // The cart is resolved server-side from the session / guest cookie.
        // `payload` is set whenever there is no pending order (validated above).
        const res = await api.post('/orders', payload);
        // Guests get a one-time access token; signed-in users are matched by session.
        order = { id: res.data.id, token: res.data.accessToken };
        setPendingOrder(order);
        if (offerSaveAddress && saveAddress) {
          // Best effort: a failure here must never get in the way of paying.
          addressesApi
            .create(addressInput)
            .then((created) => setSavedAddresses((list) => [...list, created]))
            .catch(() => undefined);
        }
      }
    } catch (err) {
      const code = errorCode(err);
      if (code?.startsWith('COUPON_')) {
        setAppliedCoupon(null);
        setCouponError(shopErrorMessage(err, locale));
      }
      // Stock or availability changed: re-sync so the affected lines are flagged.
      if (code === 'OUT_OF_STOCK' || code === 'VARIANT_UNAVAILABLE' || code === 'CART_EMPTY') void fetchCart();
      if (code === 'PICKUP_POINT_UNAVAILABLE') setPickupPoint(null);
      setError(shopErrorMessage(err, locale));
      setSubmitting(false);
      return;
    }

    // Payment happens on the hosted payment page (mock PSP while testing).
    // The token travels in the URL fragment, which browsers never send to
    // servers or in Referer headers; the payment page swaps it for an
    // httpOnly cookie and strips it from the address bar.
    void fetchCart();
    router.push(`/checkout/payment/${order.id}${order.token ? `#token=${order.token}` : ''}`);
  };

  const errorBanner = error && (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-6 flex items-center gap-2 rounded-lg"
    >
      <AlertTriangle size={14} className="shrink-0" /> {tErrors(error.key, error.values)}
    </div>
  );

  if (!loaded) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 animate-pulse" aria-busy="true">
        <span className="sr-only">{tCheckout('loading')}</span>
        <div className="h-8 bg-gray-200 w-1/4 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-32 bg-gray-100 rounded-xl" />
            <div className="h-48 bg-gray-100 rounded-xl" />
          </div>
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (items.length === 0 && !pendingOrder) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4 text-center text-gray-400">
        {errorBanner}
        <p>{tCheckout('empty')}</p>
      </div>
    );
  }

  const canSubmit = !submitting && (pendingOrder !== null || (!hasIssues && termsAccepted));
  const locked = pendingOrder !== null;
  const methodPrice = (method: DeliveryMethod) => {
    const cost = shippingFor(subtotal, shipping, method);
    return cost === 0 ? t('freeShipping') : formatPrice(cost);
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
      <h1 className="text-2xl font-bold tracking-normal mb-8">{t('checkout')}</h1>

      {errorBanner}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="font-medium text-gray-800 flex items-center gap-2">
              <CreditCard size={16} /> {tCheckout('contact')}
            </h2>
            <div>
              <label htmlFor="checkout-name" className={labelClass}>{tCheckout('fullName')}</label>
              <input
                id="checkout-name"
                type="text"
                autoComplete="name"
                maxLength={100}
                value={recipientName}
                onChange={(e) => {
                  setRecipientName(e.target.value);
                  edited('recipientName');
                }}
                {...fieldAria('recipientName')}
                className={inputClass}
                required
              />
              {fieldError('recipientName')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="checkout-email" className={labelClass}>{tCheckout('email')}</label>
                <input
                  id="checkout-email"
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  maxLength={254}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    edited('customerEmail');
                  }}
                  {...fieldAria('customerEmail')}
                  aria-describedby="checkout-email-hint"
                  disabled={locked}
                  className={inputClass}
                  required
                />
                {fieldError('customerEmail')}
              </div>
              <div>
                <label htmlFor="checkout-phone" className={labelClass}>{tCheckout('phone')}</label>
                <input
                  id="checkout-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  pattern={PHONE_PATTERN}
                  title={tCheckout('phoneHint')}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    edited('phone');
                  }}
                  {...fieldAria('phone')}
                  className={inputClass}
                  required
                />
                {fieldError('phone')}
              </div>
            </div>
            <p id="checkout-email-hint" className="text-xs text-gray-500">
              {tCheckout('emailHint')}
            </p>
          </section>

          {/* Delivery method */}
          <section id="checkout-delivery" className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="font-medium text-gray-800 flex items-center gap-2">
              <Package size={16} /> {tDelivery('title')}
            </h2>
            <div role="radiogroup" aria-label={tDelivery('title')} className="grid gap-3 sm:grid-cols-2">
              {(['COURIER', 'PICKUP_POINT'] as const).map((method) => {
                const selected = deliveryMethod === method;
                const Icon = method === 'COURIER' ? Home : MapPin;
                const free = shippingFor(subtotal, shipping, method) === 0;
                return (
                  <button
                    key={method}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={locked}
                    onClick={() => {
                      setDeliveryMethod(method);
                      setPickupMissing(false);
                    }}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-4 text-start transition-colors disabled:cursor-not-allowed',
                      selected ? 'border-ocean-600 bg-ocean-50/60 ring-1 ring-ocean-600' : 'border-gray-200 hover:border-ocean-300',
                      locked && !selected && 'opacity-50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        selected ? 'bg-ocean-700 text-white' : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {method === 'COURIER' ? tDelivery('courier') : tDelivery('pickup')}
                        </span>
                        <span className={cn('text-sm font-medium', free ? 'text-green-600' : 'text-gray-900')}>
                          {methodPrice(method)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {method === 'COURIER' ? tDelivery('courierDescription') : tDelivery('pickupDescription')}
                      </span>
                      <span className="mt-1 block text-xs text-gray-400">
                        {tDelivery('eta', { days: formatEta(etaFor(shipping, method)) })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {isPickup && (
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500">{tDelivery('choosePoint')}</p>
                <PickupPointPicker
                  value={pickupPoint}
                  onChange={(point) => {
                    setPickupPoint(point);
                    setPickupMissing(false);
                  }}
                  disabled={locked}
                  invalid={pickupMissing}
                />
                {pickupMissing && (
                  <p role="alert" className="text-xs text-red-500">{tDelivery('pointRequired')}</p>
                )}
                <p className="text-xs text-gray-400">{tDelivery('pickupNotice')}</p>
              </div>
            )}
          </section>

          {/* Shipping address (courier only) */}
          {!isPickup && (
          <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="font-medium text-gray-800 flex items-center gap-2">
              <Truck size={16} /> {tCheckout('shippingAddress')}
            </h2>
            {savedAddresses.length > 0 && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label htmlFor="checkout-saved-address" className="block text-xs font-medium text-gray-500">
                    {tCheckout('shipTo')}
                  </label>
                  <Link href="/account/addresses" className="text-xs text-ocean-700 hover:underline">
                    {tCheckout('manageAddresses')}
                  </Link>
                </div>
                <select
                  id="checkout-saved-address"
                  value={matchedAddress?.id ?? 'new'}
                  onChange={(e) => chooseSavedAddress(e.target.value)}
                  disabled={pendingOrder !== null}
                  className={`${inputClass} bg-white`}
                >
                  {savedAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.recipientName} · {streetLine(address)}, {address.city}
                      {address.isDefault ? ` ${tCheckout('defaultAddressTag')}` : ''}
                    </option>
                  ))}
                  <option value="new">{tCheckout('newAddressOption')}</option>
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="checkout-city" className={labelClass}>{tCheckout('city')}</label>
                <input
                  id="checkout-city"
                  type="text"
                  autoComplete="address-level2"
                  maxLength={100}
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    edited('shippingCity');
                  }}
                  {...fieldAria('shippingCity')}
                  className={inputClass}
                  required
                />
                {fieldError('shippingCity')}
              </div>
              <div>
                <label htmlFor="checkout-street" className={labelClass}>{tCheckout('street')}</label>
                <input
                  id="checkout-street"
                  type="text"
                  autoComplete="address-line1"
                  maxLength={150}
                  value={street}
                  onChange={(e) => {
                    setStreet(e.target.value);
                    edited('shippingStreet');
                  }}
                  {...fieldAria('shippingStreet')}
                  className={inputClass}
                  required
                />
                {fieldError('shippingStreet')}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="checkout-number" className={labelClass}>{tCheckout('number')}</label>
                <input
                  id="checkout-number"
                  type="text"
                  maxLength={20}
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    edited('shippingNumber');
                  }}
                  {...fieldAria('shippingNumber')}
                  className={inputClass}
                  required
                />
                {fieldError('shippingNumber')}
              </div>
              <div>
                <label htmlFor="checkout-apartment" className={labelClass}>{tDelivery('apartmentFloor')}</label>
                <input
                  id="checkout-apartment"
                  type="text"
                  maxLength={60}
                  placeholder={tDelivery('apartmentPlaceholder')}
                  value={apartment}
                  onChange={(e) => {
                    setApartment(e.target.value);
                    edited('shippingApartment');
                  }}
                  {...fieldAria('shippingApartment')}
                  className={inputClass}
                />
                {fieldError('shippingApartment')}
              </div>
              <div>
                <label htmlFor="checkout-zip" className={labelClass}>{tCheckout('zip')}</label>
                <input
                  id="checkout-zip"
                  type="text"
                  autoComplete="postal-code"
                  maxLength={20}
                  value={zip}
                  onChange={(e) => {
                    setZip(e.target.value);
                    edited('shippingZip');
                  }}
                  {...fieldAria('shippingZip')}
                  className={inputClass}
                />
                {fieldError('shippingZip')}
              </div>
            </div>
            {offerSaveAddress && !pendingOrder && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                  className="accent-ocean-700"
                />
                {tCheckout('saveAddress')}
              </label>
            )}
          </section>
          )}

          {/* Coupon */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
            <h2 className="font-medium text-gray-800">{tCheckout('coupon')}</h2>
            <div className="flex gap-2">
              <label htmlFor="checkout-coupon" className="sr-only">{tCheckout('coupon')}</label>
              <input
                id="checkout-coupon"
                type="text"
                maxLength={50}
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value.toUpperCase());
                  setAppliedCoupon(null);
                  setCouponError(null);
                }}
                onKeyDown={onCouponKeyDown}
                disabled={pendingOrder !== null}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-ocean-500 focus:outline-none uppercase"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponChecking || !couponInput.trim() || pendingOrder !== null}
                className="px-4 py-2 text-sm bg-ocean-700 text-white rounded-lg hover:bg-ocean-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {tCheckout('apply')}
              </button>
            </div>
            {couponError && (
              <p role="alert" className="text-xs text-red-500">{tErrors(couponError.key, couponError.values)}</p>
            )}
            {appliedCoupon && (
              <p className="text-xs text-green-600 flex items-center gap-2">
                {tCheckout('discountApplied', { code: appliedCoupon.code, amount: formatPrice(appliedCoupon.discount) })}
                {!pendingOrder && (
                  <button
                    type="button"
                    onClick={removeCoupon}
                    aria-label={tCheckout('removeCoupon')}
                    className="p-0.5 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </p>
            )}
          </section>
        </div>

        {/* Order Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 h-fit space-y-4">
          <h2 className="font-medium text-gray-800">{tCheckout('orderSummary')}</h2>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {items.map((item) => {
              const product = item.variant.product;
              const name = locale === 'he' ? product.nameHe : product.nameEn;
              const issue = lineIssue(item);
              return (
                <div key={item.id} className="flex justify-between text-sm">
                  <div>
                    <p className="text-gray-700 line-clamp-1">{name}</p>
                    <p className="text-xs text-gray-400">
                      {item.variant.color} / {item.variant.size} x{item.quantity}
                    </p>
                    {issue && (
                      <p className="text-xs text-red-500">
                        {issue.kind === 'insufficient'
                          ? t('issues.insufficient', { available: issue.available })
                          : t(`issues.${issue.kind}`)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('subtotal')}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-gray-500">
                {t('shipping')}
                <span className="block text-xs text-gray-400">
                  {isPickup ? tDelivery('pickup') : tDelivery('courier')}
                </span>
              </span>
              <span className={shippingCost === 0 ? 'text-green-600' : ''}>
                {shippingCost === 0 ? t('freeShipping') : formatPrice(shippingCost)}
              </span>
            </div>
            <FreeShippingProgress subtotal={subtotal} threshold={shipping.freeThreshold} />
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tCheckout('discount')}</span>
                <span className="text-green-600">-{formatPrice(discount)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3 flex justify-between font-medium text-lg">
              <span>{t('total')}</span>
              <span>{formatPrice(total)}</span>
            </div>
            <p className="text-xs text-gray-400">{tDelivery('vatIncluded')}</p>
          </div>

          <div className="space-y-3 border-t border-gray-200 pt-4">
            <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                disabled={locked}
                className="mt-0.5 accent-ocean-700"
              />
              <span>{tCheckout('marketingConsent')}</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted || locked}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  edited('acceptTerms');
                }}
                disabled={locked}
                required
                className="mt-0.5 accent-ocean-700"
              />
              <span>
                {tCheckout.rich('termsConsent', {
                  terms: (chunks) => (
                    <Link href="/terms" target="_blank" className="underline text-ocean-700 hover:text-ocean-800">
                      {chunks}
                    </Link>
                  ),
                  privacy: (chunks) => (
                    <Link href="/privacy" target="_blank" className="underline text-ocean-700 hover:text-ocean-800">
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </label>
            <FieldError id="checkout-terms-error" issue={issues.acceptTerms} className="text-red-500" />
          </div>

          {hasIssues && !pendingOrder && (
            <p role="status" className="text-xs text-red-500 flex items-start gap-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>
                {t('issues.blocked')}{' '}
                <Link href="/cart" className="underline hover:text-red-600">
                  {tCheckout('backToCart')}
                </Link>
              </span>
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={submitting}
            className="w-full bg-ocean-700 text-white py-3 text-sm tracking-wider uppercase rounded-lg hover:bg-ocean-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ShieldCheck size={16} />
            {submitting
              ? tCheckout('processing')
              : pendingOrder
                ? tCheckout('retryPayment')
                : tCheckout('placeOrder')}
          </button>

          <p className="text-xs text-center text-gray-400">{tCheckout('secureNote')}</p>
          <p className="text-xs text-center text-gray-400">
            {tDelivery('cancelPolicy', { hours: shipping.selfCancelWindowHours ?? 48 })}
          </p>
        </div>
      </form>
    </div>
  );
}
