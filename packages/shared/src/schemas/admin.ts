import { z } from 'zod';
import { clearableText, emailSchema, hasMaxDecimals, numberInput, requiredText, V } from './common';

// -------------------------------------------------------- business details

/** International format, digits only (e.g. 972501234567). */
export const WHATSAPP_REGEX = /^[1-9]\d{7,14}$/;

/**
 * Admin "business details" (PUT /admin/site-config). The API treats each field
 * as optional (partial update); the settings form always sends all of them.
 */
export const businessDetailsSchema = z.object({
  businessName: requiredText(120),
  companyId: requiredText(40),
  businessAddress: requiredText(200),
  businessPhone: requiredText(40),
  contactEmail: emailSchema,
  /** Spaces, dashes, + and brackets are dropped; blank hides the WhatsApp button (null). */
  whatsappNumber: z
    .string({ invalid_type_error: V.whatsappInvalid })
    .transform((v) => v.replace(/[\s\-+()]/g, ''))
    .refine((v) => v === '' || WHATSAPP_REGEX.test(v), V.whatsappInvalid)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  accessibilityCoordinatorName: requiredText(120),
  accessibilityCoordinatorPhone: requiredText(40),
  accessibilityCoordinatorEmail: emailSchema,
});
export type BusinessDetailsFormInput = z.input<typeof businessDetailsSchema>;
export type BusinessDetailsPayload = z.output<typeof businessDetailsSchema>;
export const BUSINESS_DETAILS_FIELDS = Object.keys(businessDetailsSchema.shape) as (keyof BusinessDetailsPayload)[];

// ------------------------------------------------------- delivery settings

/** "3-5" or "2" (days). */
export const ETA_REGEX = /^\d{1,2}(-\d{1,2})?$/;
export const MAX_SELF_CANCEL_WINDOW_HOURS = 24 * 14;

const amount = (max: number) =>
  numberInput(
    z
      .number({ required_error: V.required, invalid_type_error: V.amountInvalid })
      .finite(V.amountInvalid)
      .min(0, V.outOfRange)
      .max(max, V.outOfRange)
      .refine((n) => hasMaxDecimals(n, 2), V.amountInvalid),
  );

const eta = z.string({ required_error: V.required }).trim().regex(ETA_REGEX, V.etaInvalid);

/** Admin delivery prices/ETAs (PUT /admin/site-config). Form strings are converted to numbers. */
export const deliverySettingsSchema = z.object({
  shippingCost: amount(100000),
  pickupPointCost: amount(100000),
  freeShippingThreshold: amount(1000000),
  courierEtaDays: eta,
  pickupEtaDays: eta,
  selfCancelWindowHours: numberInput(
    z
      .number({ required_error: V.required, invalid_type_error: V.wholeNumber })
      .int(V.wholeNumber)
      .min(0, V.outOfRange)
      .max(MAX_SELF_CANCEL_WINDOW_HOURS, V.outOfRange),
  ),
});
export type DeliverySettingsPayload = z.output<typeof deliverySettingsSchema>;

// ----------------------------------------------------------- pickup points

/** Admin pickup point (POST /admin/pickup-points; PUT takes `.partial()`). Blank hours become null. */
export const pickupPointSchema = z.object({
  name: requiredText(120),
  city: requiredText(80),
  address: requiredText(200),
  hours: clearableText(200),
  isActive: z.boolean().optional(),
  sortOrder: numberInput(
    z
      .number({ invalid_type_error: V.wholeNumber })
      .int(V.wholeNumber)
      .min(0, V.outOfRange)
      .max(100000, V.outOfRange)
      .optional(),
  ),
});
export type PickupPointFormInput = z.input<typeof pickupPointSchema>;
export type PickupPointPayload = z.output<typeof pickupPointSchema>;
export const pickupPointUpdateSchema = pickupPointSchema.partial();

// --------------------------------------------------------- product content

/** Max lengths of the product page's fabric / care / fit texts (the server's PRODUCT_CONTENT_MAX). */
export const PRODUCT_CONTENT_MAX = { fabric: 1000, care: 2000, fit: 1000 } as const;

/** Product page content fields (part of the admin product create/update payload). Blank clears (null). */
export const productContentSchema = z.object({
  fabricHe: clearableText(PRODUCT_CONTENT_MAX.fabric),
  fabricEn: clearableText(PRODUCT_CONTENT_MAX.fabric),
  careHe: clearableText(PRODUCT_CONTENT_MAX.care),
  careEn: clearableText(PRODUCT_CONTENT_MAX.care),
  fitHe: clearableText(PRODUCT_CONTENT_MAX.fit),
  fitEn: clearableText(PRODUCT_CONTENT_MAX.fit),
});
export type ProductContentPayload = z.output<typeof productContentSchema>;
