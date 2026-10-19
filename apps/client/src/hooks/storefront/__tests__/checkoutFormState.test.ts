import { describe, expect, it } from 'vitest';
import type { Address } from '@/lib/addresses';
import {
  addressOf,
  checkoutFormReducer,
  checkoutValues,
  initialCheckoutForm,
  invalidTarget,
  type CheckoutFormState,
} from '../checkoutFormState';

const address: Address = {
  id: 'a1',
  recipientName: 'Dana Levi',
  phone: '0501234567',
  city: 'Tel Aviv',
  street: 'Dizengoff',
  number: '10',
  apartment: null,
  zip: null,
  isDefault: true,
} as Address;

const withFields = (fields: Partial<CheckoutFormState['fields']>): CheckoutFormState => ({
  ...initialCheckoutForm,
  fields: { ...initialCheckoutForm.fields, ...fields },
});

describe('checkoutFormReducer', () => {
  it('edits a field and clears its schema issue only', () => {
    const state = {
      ...initialCheckoutForm,
      issues: { customerEmail: { key: 'validation.email' }, phone: { key: 'validation.phone' } },
    };
    const next = checkoutFormReducer(state, { type: 'edit', field: 'email', value: 'dana@example.test' });
    expect(next.fields.email).toBe('dana@example.test');
    expect(next.issues).toEqual({ phone: { key: 'validation.phone' } });
  });

  it('prefills the account email and name without overwriting what was typed', () => {
    const next = checkoutFormReducer(withFields({ recipientName: 'Typed' }), {
      type: 'prefillContact',
      email: 'dana@example.test',
      name: 'Dana',
    });
    expect(next.fields.email).toBe('dana@example.test');
    expect(next.fields.recipientName).toBe('Typed');
  });

  it('applies a saved address (optional parts as empty strings) and clears only the address part', () => {
    const applied = checkoutFormReducer(withFields({ email: 'e@example.test' }), { type: 'applyAddress', address });
    expect(addressOf(applied.fields)).toEqual({
      recipientName: 'Dana Levi',
      phone: '0501234567',
      city: 'Tel Aviv',
      street: 'Dizengoff',
      number: '10',
      apartment: '',
      zip: '',
    });
    const cleared = checkoutFormReducer(applied, { type: 'clearAddress' });
    expect(cleared.fields).toMatchObject({ email: 'e@example.test', recipientName: 'Dana Levi', phone: '0501234567', city: '', street: '', number: '' });
  });

  it('hides the "choose a point" error when the method or the point changes', () => {
    const missing = checkoutFormReducer(initialCheckoutForm, { type: 'validated', issues: { pickupPointId: { key: 'validation.required' } } });
    expect(missing.pickupMissing).toBe(true);
    expect(checkoutFormReducer(missing, { type: 'chooseDelivery', method: 'COURIER' }).pickupMissing).toBe(false);
    const point = { id: 'p1', name: 'Shop', city: 'Haifa', address: 'Main 1', hours: null };
    const chosen = checkoutFormReducer(missing, { type: 'choosePickupPoint', point });
    expect(chosen).toMatchObject({ pickupPoint: point, pickupMissing: false });
  });

  it('accepting the terms clears its issue', () => {
    const state = { ...initialCheckoutForm, issues: { acceptTerms: { key: 'validation.acceptTerms' } } };
    expect(checkoutFormReducer(state, { type: 'setTermsAccepted', value: true })).toMatchObject({ termsAccepted: true, issues: {} });
  });

  it('keeps the pending order and drops an unavailable pickup point on failure', () => {
    const point = { id: 'p1', name: 'Shop', city: 'Haifa', address: 'Main 1', hours: null };
    const placed = checkoutFormReducer({ ...initialCheckoutForm, pickupPoint: point }, { type: 'orderCreated', order: { id: 'o1', token: 't' } });
    expect(placed.pendingOrder).toEqual({ id: 'o1', token: 't' });
    const failed = checkoutFormReducer(placed, { type: 'failed', error: { key: 'pickupPointUnavailable' }, pickupUnavailable: true });
    expect(failed).toMatchObject({ pickupPoint: null, error: { key: 'pickupPointUnavailable' } });
    expect(checkoutFormReducer(failed, { type: 'submitting' }).error).toBeNull();
  });
});

describe('checkoutValues', () => {
  const state = withFields({ email: 'e@example.test', recipientName: 'Dana', phone: '050', city: 'Haifa', street: 'Herzl', number: '1' });

  it('sends the courier address', () => {
    expect(checkoutValues(state, 'he', 'SALE')).toMatchObject({
      customerEmail: 'e@example.test',
      locale: 'he',
      couponCode: 'SALE',
      deliveryMethod: 'COURIER',
      shippingCity: 'Haifa',
      shippingStreet: 'Herzl',
    });
  });

  it('sends only the pickup point for pickup orders, and maps unknown locales to Hebrew', () => {
    const pickup = { ...state, deliveryMethod: 'PICKUP_POINT' as const, pickupPoint: { id: 'p1', name: '', city: '', address: '', hours: null } };
    const values = checkoutValues(pickup, 'fr', undefined);
    expect(values).toMatchObject({ pickupPointId: 'p1', locale: 'he' });
    expect(values).not.toHaveProperty('shippingCity');
  });
});

describe('invalidTarget', () => {
  it('prefers the pickup list, then the first invalid input on screen', () => {
    expect(invalidTarget({ pickupPointId: { key: 'x' }, phone: { key: 'x' } })).toEqual({ kind: 'pickup' });
    expect(invalidTarget({ shippingZip: { key: 'x' }, customerEmail: { key: 'x' } })).toEqual({ kind: 'input', id: 'checkout-email' });
    expect(invalidTarget({ acceptTerms: { key: 'x' } })).toBeNull();
    expect(invalidTarget({})).toBeNull();
  });
});
