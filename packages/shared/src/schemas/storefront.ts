import { z } from 'zod';
import {
  emailSchema,
  localeSchema,
  optionalPhoneSchema,
  phoneSchema,
  optionalText,
  requiredText,
  V,
} from './common';

// ---------------------------------------------------------------- contact

/** POST /contact. `website` is a honeypot: humans never fill it (the API quietly drops such messages). */
export const contactSchema = z.object({
  name: requiredText(100),
  email: emailSchema,
  phone: optionalPhoneSchema,
  orderNumber: optionalText(40),
  subject: optionalText(150),
  message: requiredText(5000),
  locale: localeSchema.optional(),
  website: z.string().max(500, V.tooLong).optional(),
});
export type ContactFormInput = z.input<typeof contactSchema>;
export type ContactPayload = z.output<typeof contactSchema>;

// ------------------------------------------------------------- newsletter

/** Where a newsletter opt-in happened (kept as proof of consent). */
export const NEWSLETTER_SOURCES = ['footer', 'checkout', 'register', 'account'] as const;
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

/**
 * POST /newsletter/subscribe. Consent must be an explicit, user-ticked `true`
 * (חוק התקשורת, סעיף 30א) - never assumed.
 */
export const newsletterSubscribeSchema = z.object({
  email: emailSchema,
  locale: localeSchema.optional(),
  consent: z.literal(true, { errorMap: () => ({ message: V.consentRequired }) }),
  source: z.enum(['footer', 'checkout', 'register']).optional(),
});
export type NewsletterSubscribePayload = z.output<typeof newsletterSubscribeSchema>;

// ------------------------------------------------------------ order lookup

/** POST /orders/lookup (order-status and cancel-order pages). */
export const orderLookupSchema = z.object({
  orderNumber: requiredText(40),
  email: emailSchema,
});
export type OrderLookupPayload = z.output<typeof orderLookupSchema>;

// ------------------------------------------------------------ cancellation

export const CANCELLATION_REASONS = ['SIZE', 'CHANGED_MIND', 'ORDERED_BY_MISTAKE', 'SHIPPING_DELAY', 'OTHER'] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const cancellationReasonSchema = z.enum(CANCELLATION_REASONS, {
  errorMap: () => ({ message: V.reasonRequired }),
});

/** Signed-in / token holder self-cancel (any time before the order ships). */
export const selfCancelSchema = z.object({
  reason: cancellationReasonSchema,
  details: optionalText(1000),
});

/** POST /orders/:id/cancellation-request. */
export const cancellationRequestSchema = selfCancelSchema.extend({
  /** Required: the store must be able to call the customer about a cancellation or return. */
  contactPhone: phoneSchema,
});
export type CancellationRequestPayload = z.output<typeof cancellationRequestSchema>;

/** POST /cancellations - the public cancel-order form proves the order with number + email. */
export const publicCancellationSchema = cancellationRequestSchema.extend({
  orderNumber: requiredText(40),
  email: emailSchema,
  /** Ignored by the server (an order that has not shipped is always cancelled instantly); accepted for older clients. */
  instant: z.boolean().optional(),
});
export type PublicCancellationFormInput = z.input<typeof publicCancellationSchema>;
export type PublicCancellationPayload = z.output<typeof publicCancellationSchema>;

// ---------------------------------------------------------------- payment

export const PAYMENT_METHODS = ['card', 'bit', 'apple_pay'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const CARD_BRANDS = ['visa', 'mastercard', 'amex', 'isracard', 'diners'] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];
export const PAYMENT_SIMULATIONS = ['success', 'decline', 'insufficient_funds', '3ds'] as const;
export type PaymentSimulation = (typeof PAYMENT_SIMULATIONS)[number];
export const MAX_INSTALLMENTS = 12;

/**
 * What the hosted payment page reports about a payment (POST /payment/orders/:id/pay).
 * PCI scope: the card number, CVV, expiry and ID number are never part of it -
 * parsing strips any such field. Only the brand and last four digits are kept.
 */
export const paySchema = z.object({
  method: z.enum(PAYMENT_METHODS).optional(),
  installments: z.number().int(V.wholeNumber).min(1, V.outOfRange).max(MAX_INSTALLMENTS, V.outOfRange).optional(),
  simulation: z.enum(PAYMENT_SIMULATIONS).optional(),
  cardBrand: z.enum(CARD_BRANDS).optional(),
  cardLast4: z.string().regex(/^\d{4}$/, V.invalid).optional(),
});
export type PayPayload = z.output<typeof paySchema>;

// ---------------------------------------------------------------- account

export const PASSWORD_MIN_LENGTH = 8;
/** better-auth's default maximum. */
export const PASSWORD_MAX_LENGTH = 128;

/** Email/password sign-up (better-auth `signUp.email`, minPasswordLength 8). */
export const registerSchema = z.object({
  name: requiredText(100),
  email: emailSchema,
  password: z
    .string({ required_error: V.required })
    .min(1, V.required)
    .min(PASSWORD_MIN_LENGTH, V.passwordTooShort)
    .max(PASSWORD_MAX_LENGTH, V.tooLong),
  marketingConsent: z.boolean().optional(),
});
export type RegisterPayload = z.output<typeof registerSchema>;

/** The register form: the payload plus the "repeat password" field. */
export const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { message: V.passwordsMismatch, path: ['confirmPassword'] });
export type RegisterFormInput = z.input<typeof registerFormSchema>;
