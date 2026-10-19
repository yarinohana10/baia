import { z } from 'zod';

/**
 * Building blocks shared by every input schema.
 *
 * Error messages are i18n keys (the `validation` namespace of the client's
 * messages), never display text: the client translates them with next-intl.
 * Field rules mirror the NestJS class-validator DTOs, which stay the server's
 * enforcement layer; `apps/server/test/zod-contract.spec.ts` keeps the two in sync.
 */
export const V = {
  required: 'validation.required',
  invalid: 'validation.invalid',
  tooLong: 'validation.tooLong',
  tooShort: 'validation.tooShort',
  emailInvalid: 'validation.emailInvalid',
  phoneInvalid: 'validation.phoneInvalid',
  consentRequired: 'validation.consentRequired',
  acceptTerms: 'validation.acceptTerms',
  pickupPointRequired: 'validation.pickupPointRequired',
  reasonRequired: 'validation.reasonRequired',
  passwordTooShort: 'validation.passwordTooShort',
  passwordsMismatch: 'validation.passwordsMismatch',
  whatsappInvalid: 'validation.whatsappInvalid',
  etaInvalid: 'validation.etaInvalid',
  amountInvalid: 'validation.amountInvalid',
  wholeNumber: 'validation.wholeNumber',
  outOfRange: 'validation.outOfRange',
} as const;
export type ValidationMessageKey = (typeof V)[keyof typeof V];

export const LOCALES = ['he', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const localeSchema = z.enum(LOCALES);

/**
 * Israeli (050-1234567, 03-1234567) or international (+972 50 123 4567)
 * number: digits, spaces and dashes with an optional leading +. Same rule as
 * the orders/addresses/contact/cancellation DTOs.
 */
export const PHONE_REGEX = /^\+?[0-9][0-9\s-]{7,18}$/;
/** PHONE_REGEX for an `<input pattern>` (HTML patterns are implicitly anchored). */
export const PHONE_PATTERN = '\\+?[0-9][0-9\\s\\-]{7,18}';

const str = () => z.string({ required_error: V.required, invalid_type_error: V.invalid });

/** Trimmed, non-empty text of at most `max` characters. */
export const requiredText = (max: number) => str().trim().min(1, V.required).max(max, V.tooLong);

/** Trimmed optional text; blank becomes `undefined` (the field is simply not sent). */
export const optionalText = (max: number) =>
  str()
    .trim()
    .max(max, V.tooLong)
    .transform((v) => (v === '' ? undefined : v))
    .optional();

/** Trimmed clearable text; blank becomes `null` (the API stores null). */
export const clearableText = (max: number) =>
  str()
    .trim()
    .max(max, V.tooLong)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const phoneSchema = str().trim().min(1, V.required).regex(PHONE_REGEX, V.phoneInvalid);
/** The spec name for the store's phone rule (Israeli and international numbers). */
export const israeliPhoneSchema = phoneSchema;

/** Optional phone: blank becomes `undefined`, anything else must be a valid phone. */
export const optionalPhoneSchema = str()
  .trim()
  .refine((v) => v === '' || PHONE_REGEX.test(v), V.phoneInvalid)
  .transform((v) => (v === '' ? undefined : v))
  .optional();

/**
 * Email as the API accepts it (class-validator `IsEmail` + `MaxLength(254)`).
 * Zod's email check is a little stricter than validator.js (no IP or quoted
 * local parts), which only matters for addresses no shopper uses.
 */
export const emailSchema = str()
  .trim()
  .min(1, V.required)
  .max(254, V.tooLong)
  .email(V.emailInvalid)
  .refine((v) => v.split('@')[0].length <= 64, V.emailInvalid);
export type Email = z.infer<typeof emailSchema>;

/**
 * A number typed into a form field: numeric strings are converted, a blank
 * string is "missing". Numbers pass through, so the same schema validates API payloads.
 */
export const numberInput = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const s = v.trim();
    return s === '' ? undefined : Number(s);
  }, schema);

/** True when `n` has at most `places` decimal places (class-validator `maxDecimalPlaces`). */
export const hasMaxDecimals = (n: number, places: number) => (n.toString().split('.')[1] ?? '').length <= places;
