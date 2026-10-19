import { z } from 'zod';
import { ADDRESS_LIMITS } from './address';
import { emailSchema, localeSchema, optionalText, phoneSchema, requiredText, V } from './common';

export const DELIVERY_METHODS = ['COURIER', 'PICKUP_POINT'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

const orderBase = {
  /** The API defaults it to the signed-in account's email; the checkout form always sends it. */
  customerEmail: emailSchema,
  recipientName: requiredText(ADDRESS_LIMITS.recipientName),
  phone: phoneSchema,
  locale: localeSchema.optional(),
  couponCode: optionalText(50),
  /** The unticked-by-default "send me offers" checkbox. */
  marketingConsent: z.boolean().optional(),
};

const courierFields = {
  deliveryMethod: z.literal('COURIER'),
  shippingCity: requiredText(ADDRESS_LIMITS.city),
  shippingStreet: requiredText(ADDRESS_LIMITS.street),
  shippingNumber: requiredText(ADDRESS_LIMITS.number),
  shippingApartment: optionalText(ADDRESS_LIMITS.apartment),
  shippingZip: optionalText(ADDRESS_LIMITS.zip),
};

const pickupFields = {
  deliveryMethod: z.literal('PICKUP_POINT'),
  /** The address comes from the point; any address fields are dropped. */
  pickupPointId: z
    .string({ required_error: V.pickupPointRequired, invalid_type_error: V.pickupPointRequired })
    .trim()
    .min(1, V.pickupPointRequired)
    .max(50, V.tooLong),
};

/** POST /orders body: courier orders need a street address, pickup orders a pickup point. */
export const createOrderSchema = z.discriminatedUnion('deliveryMethod', [
  z.object({ ...orderBase, ...courierFields }),
  z.object({ ...orderBase, ...pickupFields }),
]);
export type CreateOrderPayload = z.output<typeof createOrderSchema>;

/** Client-only: the terms checkbox must be ticked (never sent to the API). */
const acceptTerms = z.literal(true, {
  errorMap: () => ({ message: V.acceptTerms }),
});

/** The checkout form: the order payload plus the terms checkbox. */
export const checkoutSchema = z.discriminatedUnion('deliveryMethod', [
  z.object({ ...orderBase, ...courierFields, acceptTerms }),
  z.object({ ...orderBase, ...pickupFields, acceptTerms }),
]);
export type CheckoutFormInput = z.input<typeof checkoutSchema>;
export type CheckoutForm = z.output<typeof checkoutSchema>;

/** The API payload for a validated checkout form (drops the client-only `acceptTerms`). */
export function toCreateOrderPayload(form: CheckoutForm): CreateOrderPayload {
  const { acceptTerms: _accepted, ...payload } = form;
  return payload;
}
