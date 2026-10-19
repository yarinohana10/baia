/**
 * Unit tests for the shared Zod schemas (@baia/shared). Agreement with the
 * server's DTOs is covered by apps/server/test/zod-contract.spec.ts; these pin
 * the client-facing behaviour: i18n error keys, trimming and normalisation.
 */
import { describe, expect, it } from 'vitest';
import {
  addressSchema,
  businessDetailsSchema,
  cancellationRequestSchema,
  checkoutSchema,
  contactSchema,
  createOrderSchema,
  deliverySettingsSchema,
  emailSchema,
  newsletterSubscribeSchema,
  optionalPhoneSchema,
  orderLookupSchema,
  paySchema,
  phoneSchema,
  pickupPointSchema,
  productContentSchema,
  publicCancellationSchema,
  registerFormSchema,
  registerSchema,
  toCreateOrderPayload,
  validateForm,
  PHONE_PATTERN,
  PHONE_REGEX,
} from '@baia/shared';

/** field → i18n key of its first issue. */
const keys = (schema: Parameters<typeof validateForm>[0], input: unknown) =>
  Object.fromEntries(Object.entries(validateForm(schema, input).errors).map(([field, issue]) => [field, issue.key]));

describe('phone', () => {
  it.each(['050-1234567', '0501234567', '03 123 4567', '+972 50-123-4567', '+972501234567'])('accepts %s', (phone) => {
    expect(phoneSchema.safeParse(phone).success).toBe(true);
  });

  it.each(['', 'abc', '12345', '050-12a4567', '++972501234567', '-0501234567'])('rejects "%s"', (phone) => {
    expect(phoneSchema.safeParse(phone).success).toBe(false);
  });

  it('uses the i18n keys', () => {
    expect(phoneSchema.safeParse('').error?.issues[0].message).toBe('validation.required');
    expect(phoneSchema.safeParse('abc').error?.issues[0].message).toBe('validation.phoneInvalid');
  });

  it('optional phone: blank is "not given"', () => {
    expect(optionalPhoneSchema.parse('  ')).toBeUndefined();
    expect(optionalPhoneSchema.parse(undefined)).toBeUndefined();
    expect(optionalPhoneSchema.parse(' 052-1234567 ')).toBe('052-1234567');
    expect(optionalPhoneSchema.safeParse('abc').success).toBe(false);
  });

  it('the <input pattern> matches the same numbers as the regex', () => {
    const html = new RegExp(`^(?:${PHONE_PATTERN})$`, 'v');
    for (const v of ['050-1234567', '+972 50 123 4567', 'abc', '12345', '0501234567890123456789']) {
      expect(html.test(v)).toBe(PHONE_REGEX.test(v));
    }
  });
});

describe('email', () => {
  it('trims and accepts ordinary addresses', () => {
    expect(emailSchema.parse('  dana.levi+swim@example.co.il ')).toBe('dana.levi+swim@example.co.il');
  });

  it.each([
    ['', 'validation.required'],
    ['dana', 'validation.emailInvalid'],
    ['dana@example', 'validation.emailInvalid'],
    [`${'a'.repeat(65)}@example.com`, 'validation.emailInvalid'],
    [`${'a'.repeat(60)}@${'b'.repeat(190)}.com`, 'validation.tooLong'],
  ])('rejects "%s" with %s', (email, key) => {
    expect(emailSchema.safeParse(email).error?.issues[0].message).toBe(key);
  });
});

const courierForm = {
  customerEmail: 'dana@example.com',
  recipientName: 'Dana Levi',
  phone: '050-1234567',
  deliveryMethod: 'COURIER' as const,
  shippingCity: 'Tel Aviv',
  shippingStreet: 'Dizengoff',
  shippingNumber: '10',
  shippingApartment: '',
  shippingZip: '',
  acceptTerms: true,
};

describe('checkoutSchema', () => {
  it('courier: requires the address and drops blank optional parts', () => {
    const parsed = checkoutSchema.parse(courierForm);
    expect(parsed).toMatchObject({ shippingCity: 'Tel Aviv', shippingApartment: undefined, shippingZip: undefined });
    expect(keys(checkoutSchema, { ...courierForm, shippingCity: ' ', shippingNumber: undefined })).toEqual({
      shippingCity: 'validation.required',
      shippingNumber: 'validation.required',
    });
  });

  it('pickup: requires a point instead of an address, and ignores address fields', () => {
    const pickup = { ...courierForm, deliveryMethod: 'PICKUP_POINT' as const, shippingCity: '' };
    expect(keys(checkoutSchema, pickup)).toEqual({ pickupPointId: 'validation.pickupPointRequired' });
    const parsed = checkoutSchema.parse({ ...pickup, pickupPointId: 'pp_1' });
    expect(parsed).not.toHaveProperty('shippingCity');
  });

  it('the terms box must be ticked, but is not part of the API payload', () => {
    expect(keys(checkoutSchema, { ...courierForm, acceptTerms: false })).toEqual({ acceptTerms: 'validation.acceptTerms' });
    const payload = toCreateOrderPayload(checkoutSchema.parse(courierForm));
    expect(payload).not.toHaveProperty('acceptTerms');
    expect(createOrderSchema.safeParse(payload).success).toBe(true);
  });

  it('reports every invalid contact field at once', () => {
    expect(keys(checkoutSchema, { ...courierForm, customerEmail: 'x', recipientName: '', phone: '1' })).toEqual({
      customerEmail: 'validation.emailInvalid',
      recipientName: 'validation.required',
      phone: 'validation.phoneInvalid',
    });
  });

  it('only knows the two delivery methods', () => {
    expect(validateForm(checkoutSchema, { ...courierForm, deliveryMethod: 'DRONE' }).success).toBe(false);
  });
});

describe('contactSchema', () => {
  const message = { name: 'Dana', email: 'dana@example.com', message: 'Hello' };

  it('drops blank optional fields and keeps the honeypot as given', () => {
    expect(contactSchema.parse({ ...message, orderNumber: ' ', subject: '', phone: '', website: 'bot' })).toEqual({
      ...message,
      orderNumber: undefined,
      subject: undefined,
      phone: undefined,
      website: 'bot',
    });
  });

  it('limits lengths like the API', () => {
    expect(keys(contactSchema, { ...message, message: 'x'.repeat(5001), subject: 'x'.repeat(151) })).toEqual({
      message: 'validation.tooLong',
      subject: 'validation.tooLong',
    });
  });
});

describe('newsletterSubscribeSchema', () => {
  it('requires explicit consent', () => {
    expect(keys(newsletterSubscribeSchema, { email: 'dana@example.com', consent: false })).toEqual({
      consent: 'validation.consentRequired',
    });
    expect(newsletterSubscribeSchema.safeParse({ email: 'dana@example.com', consent: true, source: 'footer' }).success).toBe(true);
  });

  it('rejects sources this endpoint does not take', () => {
    expect(newsletterSubscribeSchema.safeParse({ email: 'dana@example.com', consent: true, source: 'account' }).success).toBe(false);
  });
});

describe('order lookup and cancellation', () => {
  it('orderLookupSchema trims both fields', () => {
    expect(orderLookupSchema.parse({ orderNumber: ' BA-1 ', email: ' dana@example.com ' })).toEqual({
      orderNumber: 'BA-1',
      email: 'dana@example.com',
    });
  });

  it('a reason is required', () => {
    expect(keys(cancellationRequestSchema, {})).toEqual({ reason: 'validation.reasonRequired' });
    expect(keys(cancellationRequestSchema, { reason: '' })).toEqual({ reason: 'validation.reasonRequired' });
  });

  it('publicCancellationSchema needs the order number and email', () => {
    expect(keys(publicCancellationSchema, { reason: 'SIZE', orderNumber: '', email: '' })).toEqual({
      orderNumber: 'validation.required',
      email: 'validation.required',
    });
    expect(publicCancellationSchema.parse({ reason: 'SIZE', orderNumber: 'BA-1', email: 'd@e.co', details: '', contactPhone: '' })).toEqual({
      reason: 'SIZE',
      orderNumber: 'BA-1',
      email: 'd@e.co',
      details: undefined,
      contactPhone: undefined,
    });
  });
});

describe('paySchema', () => {
  it('accepts the hosted page report and strips card data', () => {
    const parsed = paySchema.parse({ method: 'card', installments: 3, cardBrand: 'visa', cardLast4: '4242', cardNumber: '4111111111111111', cvv: '123' });
    expect(parsed).toEqual({ method: 'card', installments: 3, cardBrand: 'visa', cardLast4: '4242' });
  });

  it.each([0, 13, 2.5])('rejects %s installments', (installments) => {
    expect(paySchema.safeParse({ installments }).success).toBe(false);
  });
});

describe('addressSchema', () => {
  const address = { recipientName: 'Dana', phone: '0501234567', city: 'Haifa', street: 'Herzl', number: '5', apartment: ' ', zip: '' };

  it('clears blank apartment and zip (null)', () => {
    expect(addressSchema.parse(address)).toMatchObject({ apartment: null, zip: null });
  });

  it('allows the same apartment length as the checkout', () => {
    expect(addressSchema.safeParse({ ...address, apartment: 'x'.repeat(60) }).success).toBe(true);
    expect(keys(addressSchema, { ...address, apartment: 'x'.repeat(61) })).toEqual({ apartment: 'validation.tooLong' });
  });
});

describe('register', () => {
  const form = { name: 'Dana', email: 'dana@example.com', password: 'swimsuit', confirmPassword: 'swimsuit' };

  it('passwords need 8+ characters and must match', () => {
    expect(registerFormSchema.safeParse(form).success).toBe(true);
    expect(keys(registerFormSchema, { ...form, password: 'short', confirmPassword: 'short' })).toEqual({
      password: 'validation.passwordTooShort',
    });
    expect(keys(registerFormSchema, { ...form, confirmPassword: 'swimsuits' })).toEqual({
      confirmPassword: 'validation.passwordsMismatch',
    });
  });

  it('the payload never carries the confirmation', () => {
    expect(registerSchema.parse({ ...form, marketingConsent: true })).toEqual({
      name: 'Dana',
      email: 'dana@example.com',
      password: 'swimsuit',
      marketingConsent: true,
    });
  });
});

describe('admin schemas', () => {
  const business = {
    businessName: 'BAIA',
    companyId: '515555555',
    businessAddress: 'Herzl 1',
    businessPhone: '03-1234567',
    contactEmail: 'hello@baia.co.il',
    whatsappNumber: '',
    accessibilityCoordinatorName: 'Dana',
    accessibilityCoordinatorPhone: '050-1234567',
    accessibilityCoordinatorEmail: 'a11y@baia.co.il',
  };

  it('business details: WhatsApp is normalised to digits, blank hides it', () => {
    expect(businessDetailsSchema.parse(business).whatsappNumber).toBeNull();
    expect(businessDetailsSchema.parse({ ...business, whatsappNumber: '+972 (50) 123-4567' }).whatsappNumber).toBe('972501234567');
    expect(keys(businessDetailsSchema, { ...business, whatsappNumber: '050-1234567' })).toEqual({
      whatsappNumber: 'validation.whatsappInvalid',
    });
  });

  it('business details: every field the form shows is required', () => {
    expect(keys(businessDetailsSchema, { ...business, businessName: ' ', contactEmail: '' })).toEqual({
      businessName: 'validation.required',
      contactEmail: 'validation.required',
    });
  });

  const delivery = {
    shippingCost: '29.9',
    pickupPointCost: '19.9',
    freeShippingThreshold: '249',
    courierEtaDays: '3-5',
    pickupEtaDays: '2',
    selfCancelWindowHours: '48',
  };

  it('delivery settings: converts form strings and validates ranges', () => {
    expect(deliverySettingsSchema.parse(delivery)).toEqual({
      shippingCost: 29.9,
      pickupPointCost: 19.9,
      freeShippingThreshold: 249,
      courierEtaDays: '3-5',
      pickupEtaDays: '2',
      selfCancelWindowHours: 48,
    });
    expect(
      keys(deliverySettingsSchema, {
        ...delivery,
        shippingCost: '',
        pickupPointCost: 'abc',
        freeShippingThreshold: '-1',
        courierEtaDays: '3 to 5',
        selfCancelWindowHours: '1.5',
      }),
    ).toEqual({
      shippingCost: 'validation.required',
      pickupPointCost: 'validation.amountInvalid',
      freeShippingThreshold: 'validation.outOfRange',
      courierEtaDays: 'validation.etaInvalid',
      selfCancelWindowHours: 'validation.wholeNumber',
    });
  });

  it('pickup point: blank hours clear, blank sort order is omitted', () => {
    expect(pickupPointSchema.parse({ name: 'Point', city: 'Haifa', address: 'Herzl 1', hours: '', sortOrder: '' })).toEqual({
      name: 'Point',
      city: 'Haifa',
      address: 'Herzl 1',
      hours: null,
      sortOrder: undefined,
    });
    expect(keys(pickupPointSchema, { name: '', city: 'Haifa', address: 'x', sortOrder: '-1' })).toEqual({
      name: 'validation.required',
      sortOrder: 'validation.outOfRange',
    });
  });

  it('product content: limits and clearing', () => {
    expect(productContentSchema.parse({ fabricHe: '', careEn: ' Hand wash ' })).toEqual({ fabricHe: null, careEn: 'Hand wash' });
    expect(keys(productContentSchema, { careHe: 'x'.repeat(2001), fitEn: 'x'.repeat(1001) })).toEqual({
      careHe: 'validation.tooLong',
      fitEn: 'validation.tooLong',
    });
  });
});
