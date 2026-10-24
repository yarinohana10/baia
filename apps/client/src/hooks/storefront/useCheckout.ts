'use client';

import { useCallback, useEffect, useReducer } from 'react';
import { useLocale } from 'next-intl';
import { checkoutSchema, toCreateOrderPayload, type CreateOrderPayload } from '@baia/shared';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { sameAddress, type Address } from '@/lib/addresses';
import { validateForm, type FieldIssues } from '@/lib/form-errors';
import { errorCode, shopErrorMessage, type ShopErrorCode } from '@/lib/shop-errors';
import { cartSubtotal, lineIssue, shippingFor, useCartStore } from '@/store/cart';
import { paymentPageHref } from '@/components/storefront/payment/links';
import { useBusyAction } from './useBusyAction';
import { useCoupon } from './useCoupon';
import { useSavedAddresses } from './useSavedAddresses';
import {
  addressOf,
  checkoutFormReducer,
  checkoutValues,
  initialCheckoutForm,
  invalidTarget,
  type CheckoutFields,
  type PendingOrder,
} from './checkoutFormState';

/** Stock or availability changed: re-sync the cart so the affected lines are flagged. */
const RESYNC_CART_CODES: (ShopErrorCode | null)[] = ['OUT_OF_STOCK', 'VARIANT_UNAVAILABLE', 'CART_EMPTY'];

/** Focus the first invalid input, or bring the pickup list into view. */
function revealInvalid(issues: FieldIssues) {
  const target = invalidTarget(issues);
  if (target?.kind === 'pickup') {
    document.getElementById('checkout-delivery')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (target) {
    document.getElementById(target.id)?.focus();
  }
}

/** POST /orders: the cart is resolved server-side from the session / guest cookie. */
async function createOrder(payload: CreateOrderPayload): Promise<PendingOrder> {
  const res = await api.post('/orders', payload);
  // Guests get a one-time access token; signed-in users are matched by session.
  return { id: res.data.id, token: res.data.accessToken };
}

/**
 * Checkout: contact + delivery form (validated with the shared checkoutSchema),
 * coupon, the signed-in shopper's address book, and placing the order, which
 * continues on the hosted payment page.
 */
export function useCheckout() {
  const locale = useLocale();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const loaded = useCartStore((s) => s.loaded);
  const shipping = useCartStore((s) => s.shipping);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const fetchShipping = useCartStore((s) => s.fetchShipping);
  const { data: session } = useSession();
  const [form, dispatch] = useReducer(checkoutFormReducer, initialCheckoutForm);
  const locked = form.pendingOrder !== null;

  const subtotal = cartSubtotal(items);
  const coupon = useCoupon(subtotal, locked);
  const applyAddress = useCallback((address: Address) => dispatch({ type: 'applyAddress', address }), []);
  const userId = session?.user?.id;
  const addressBook = useSavedAddresses(userId, applyAddress);
  const [submitting, runSubmit] = useBusyAction();

  useEffect(() => {
    fetchCart();
    fetchShipping();
  }, [fetchCart, fetchShipping]);

  // Signed-in shoppers: start from the account's email and name.
  const sessionEmail = session?.user?.email;
  const sessionName = session?.user?.name;
  useEffect(() => {
    if (sessionEmail || sessionName) dispatch({ type: 'prefillContact', email: sessionEmail, name: sessionName });
  }, [sessionEmail, sessionName]);

  const isPickup = form.deliveryMethod === 'PICKUP_POINT';
  const address = addressOf(form.fields);
  const matchedAddress = addressBook.addresses.find((a) => sameAddress(a, address)) ?? null;
  const offerSaveAddress = !!userId && !matchedAddress && !isPickup;
  const shippingCost = shippingFor(subtotal, shipping, form.deliveryMethod);
  const discount = coupon.state.applied?.discount ?? 0;
  const hasIssues = items.some((item) => lineIssue(item));

  /** "Ship to": a saved address fills the form; "a new address" clears the address part. */
  const chooseSavedAddress = (id: string) => {
    const saved = addressBook.addresses.find((a) => a.id === id);
    dispatch(saved ? { type: 'applyAddress', address: saved } : { type: 'clearAddress' });
  };

  /** On leaving a field: tell the shopper about that field's problem right away. */
  const checkField = (field: keyof CheckoutFields) => {
    const check = validateForm(checkoutSchema, checkoutValues(form, locale, coupon.state.applied?.code));
    dispatch({ type: 'fieldChecked', field, issues: check.errors });
  };

  /** Validates the form; the order payload, or null (and the first problem revealed). */
  const validatedPayload = (): CreateOrderPayload | null => {
    const check = validateForm(checkoutSchema, checkoutValues(form, locale, coupon.state.applied?.code));
    dispatch({ type: 'validated', issues: check.errors });
    if (!check.success) {
      revealInvalid(check.errors);
      return null;
    }
    return toCreateOrderPayload(check.data);
  };

  const createNewOrder = async (payload: CreateOrderPayload): Promise<PendingOrder> => {
    const order = await createOrder(payload);
    dispatch({ type: 'orderCreated', order });
    if (offerSaveAddress && form.saveAddress) addressBook.save(address);
    return order;
  };

  /** How to get the order to pay: the pending one, or a new one from the valid form (null if invalid). */
  const orderSource = (): (() => Promise<PendingOrder>) | null => {
    const pending = form.pendingOrder;
    if (pending) return async () => pending;
    const payload = validatedPayload();
    return payload && (() => createNewOrder(payload));
  };

  const submit = async () => {
    if (submitting || (!locked && hasIssues)) return;
    const getOrder = orderSource();
    if (!getOrder) return;
    dispatch({ type: 'submitting' });
    await runSubmit(async () => {
      let order: PendingOrder;
      try {
        order = await getOrder();
      } catch (err) {
        const code = errorCode(err);
        if (code?.startsWith('COUPON_')) coupon.reject(err);
        if (RESYNC_CART_CODES.includes(code)) void fetchCart();
        dispatch({
          type: 'failed',
          error: shopErrorMessage(err, locale),
          pickupUnavailable: code === 'PICKUP_POINT_UNAVAILABLE',
        });
        return 'done';
      }
      // Payment happens on the hosted payment page (mock PSP while testing).
      void fetchCart();
      router.push(paymentPageHref(order.id, order.token));
      return 'navigating';
    });
  };

  return {
    form,
    dispatch,
    checkField,
    coupon,
    items,
    loaded,
    shipping,
    subtotal,
    shippingCost,
    discount,
    total: Math.max(0, subtotal + shippingCost - discount),
    hasIssues,
    locked,
    isPickup,
    savedAddresses: addressBook.addresses,
    matchedAddress,
    offerSaveAddress,
    chooseSavedAddress,
    submitting,
    canSubmit: !submitting && (locked || (!hasIssues && form.termsAccepted)),
    submit,
  };
}

export type Checkout = ReturnType<typeof useCheckout>;
