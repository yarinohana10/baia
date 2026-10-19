import type { FieldIssues } from '@baia/shared';
import { toInput, type Address, type AddressInput } from '@/lib/addresses';
import { clearIssue, firstInvalidField } from '@/lib/form-errors';
import type { ErrorMessage } from '@/lib/shop-errors';
import type { DeliveryMethod } from '@/store/cart';
import type { PickupPoint } from '@/components/storefront/orders/PickupPointPicker';

/** checkoutSchema field → input id, in on-screen order (for focusing the first invalid field). */
export const FIELD_INPUTS = {
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
export type CheckoutInputField = keyof typeof FIELD_INPUTS;
const FIELD_ORDER = Object.keys(FIELD_INPUTS);

/** Form field → checkoutSchema field (whose issue an edit clears). */
const SCHEMA_FIELD: Record<keyof CheckoutFields, CheckoutInputField> = {
  email: 'customerEmail',
  recipientName: 'recipientName',
  phone: 'phone',
  city: 'shippingCity',
  street: 'shippingStreet',
  number: 'shippingNumber',
  apartment: 'shippingApartment',
  zip: 'shippingZip',
};

/** The typed contact and address fields: the address book's shape plus the email. */
export type CheckoutFields = AddressInput & { email: string };

/** An order already created from the cart, still awaiting payment (guests get a one-time token). */
export type PendingOrder = { id: string; token?: string };

export type CheckoutFormState = {
  fields: CheckoutFields;
  deliveryMethod: DeliveryMethod;
  pickupPoint: PickupPoint | null;
  /** Submitted without choosing a pickup point. */
  pickupMissing: boolean;
  marketingConsent: boolean;
  termsAccepted: boolean;
  /** Signed-in shoppers: add a new address to the address book. */
  saveAddress: boolean;
  issues: FieldIssues;
  error: ErrorMessage | null;
  /**
   * Set once the order exists (e.g. the shopper came back from the payment
   * page): the form locks and submitting continues to pay it instead of
   * creating a second order.
   */
  pendingOrder: PendingOrder | null;
};

export type CheckoutFormAction =
  | { type: 'edit'; field: keyof CheckoutFields; value: string }
  /** Signed-in shoppers: start from the account's email and name (never over what was typed). */
  | { type: 'prefillContact'; email?: string | null; name?: string | null }
  | { type: 'applyAddress'; address: Address }
  /** "A new address": keep the contact details, clear the address itself. */
  | { type: 'clearAddress' }
  | { type: 'chooseDelivery'; method: DeliveryMethod }
  | { type: 'choosePickupPoint'; point: PickupPoint | null }
  | { type: 'setMarketingConsent'; value: boolean }
  | { type: 'setTermsAccepted'; value: boolean }
  | { type: 'setSaveAddress'; value: boolean }
  | { type: 'validated'; issues: FieldIssues }
  | { type: 'submitting' }
  | { type: 'orderCreated'; order: PendingOrder }
  /** POST /orders failed; `pickupUnavailable` drops the chosen point. */
  | { type: 'failed'; error: ErrorMessage; pickupUnavailable: boolean };

export const initialCheckoutForm: CheckoutFormState = {
  fields: { email: '', recipientName: '', phone: '', city: '', street: '', number: '', apartment: '', zip: '' },
  deliveryMethod: 'COURIER',
  pickupPoint: null,
  pickupMissing: false,
  marketingConsent: false,
  termsAccepted: false,
  saveAddress: true,
  issues: {},
  error: null,
  pendingOrder: null,
};

export function checkoutFormReducer(state: CheckoutFormState, action: CheckoutFormAction): CheckoutFormState {
  switch (action.type) {
    case 'edit':
      return {
        ...state,
        fields: { ...state.fields, [action.field]: action.value },
        issues: clearIssue(state.issues, SCHEMA_FIELD[action.field]),
      };
    case 'prefillContact':
      return {
        ...state,
        fields: {
          ...state.fields,
          email: state.fields.email || action.email || '',
          recipientName: state.fields.recipientName || action.name || '',
        },
      };
    case 'applyAddress':
      return { ...state, fields: { ...state.fields, ...toInput(action.address) } };
    case 'clearAddress':
      return { ...state, fields: { ...state.fields, city: '', street: '', number: '', apartment: '', zip: '' } };
    case 'chooseDelivery':
      return { ...state, deliveryMethod: action.method, pickupMissing: false };
    case 'choosePickupPoint':
      return { ...state, pickupPoint: action.point, pickupMissing: false };
    case 'setMarketingConsent':
      return { ...state, marketingConsent: action.value };
    case 'setTermsAccepted':
      return { ...state, termsAccepted: action.value, issues: clearIssue(state.issues, 'acceptTerms') };
    case 'setSaveAddress':
      return { ...state, saveAddress: action.value };
    case 'validated':
      return {
        ...state,
        issues: action.issues,
        pickupMissing: action.issues.pickupPointId ? true : state.pickupMissing,
      };
    case 'submitting':
      return { ...state, error: null };
    case 'orderCreated':
      return { ...state, pendingOrder: action.order };
    case 'failed':
      return {
        ...state,
        error: action.error,
        pickupPoint: action.pickupUnavailable ? null : state.pickupPoint,
      };
  }
}

/** The values checked by `checkoutSchema` (the courier address or the pickup point). */
export function checkoutValues(state: CheckoutFormState, locale: string, couponCode: string | undefined) {
  const { fields, deliveryMethod, pickupPoint } = state;
  return {
    customerEmail: fields.email,
    recipientName: fields.recipientName,
    phone: fields.phone,
    locale: locale === 'en' ? 'en' : 'he',
    couponCode,
    deliveryMethod,
    marketingConsent: state.marketingConsent,
    acceptTerms: state.termsAccepted,
    ...(deliveryMethod === 'PICKUP_POINT'
      ? { pickupPointId: pickupPoint?.id }
      : {
          shippingCity: fields.city,
          shippingStreet: fields.street,
          shippingNumber: fields.number,
          shippingApartment: fields.apartment,
          shippingZip: fields.zip,
        }),
  };
}

/** Where to take the shopper after a failed validation: the pickup list, or the first invalid input's id. */
export function invalidTarget(issues: FieldIssues): { kind: 'pickup' } | { kind: 'input'; id: string } | null {
  if (issues.pickupPointId) return { kind: 'pickup' };
  const first = firstInvalidField(issues, FIELD_ORDER) as CheckoutInputField | undefined;
  return first && FIELD_INPUTS[first] ? { kind: 'input', id: FIELD_INPUTS[first] } : null;
}

/** The address part of the form, for matching / saving it in the address book. */
export function addressOf(fields: CheckoutFields): AddressInput {
  const { recipientName, phone, city, street, number, apartment, zip } = fields;
  return { recipientName, phone, city, street, number, apartment, zip };
}
