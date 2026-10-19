/**
 * Contract tests: the shared Zod schemas (@baia/shared, used by the client's
 * forms) must accept and reject the same payloads as the server's
 * class-validator DTOs (the enforcement layer), run through the real
 * strictValidationPipe. When a rule changes on one side, these fail until the
 * other side follows.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
import {
  CANCELLATION_REASONS as SHARED_REASONS,
  CARD_BRANDS as SHARED_CARD_BRANDS,
  DELIVERY_METHODS,
  LOCALES,
  MAX_ADDRESSES,
  MAX_INSTALLMENTS as SHARED_MAX_INSTALLMENTS,
  NEWSLETTER_SOURCES as SHARED_NEWSLETTER_SOURCES,
  PASSWORD_MIN_LENGTH,
  PAYMENT_METHODS as SHARED_PAYMENT_METHODS,
  PAYMENT_SIMULATIONS as SHARED_PAYMENT_SIMULATIONS,
  PRODUCT_CONTENT_MAX as SHARED_PRODUCT_CONTENT_MAX,
  addressSchema,
  addressUpdateSchema,
  businessDetailsSchema,
  cancellationRequestSchema,
  checkoutSchema,
  contactSchema,
  createOrderSchema,
  deliverySettingsSchema,
  issuesByField,
  newsletterSubscribeSchema,
  orderLookupSchema,
  paySchema,
  pickupPointSchema,
  pickupPointUpdateSchema,
  productContentSchema,
  publicCancellationSchema,
  selfCancelSchema,
  toCreateOrderPayload,
} from '@baia/shared';
import { strictValidationPipe } from '../src/common/validation';
import { CreateAddressDto, UpdateAddressDto } from '../src/addresses/dto/address.dto';
import { MAX_ADDRESSES_PER_USER } from '../src/addresses/addresses.service';
import {
  CANCELLATION_REASONS,
  CancellationRequestDto,
  PublicCancellationDto,
  SelfCancelDto,
} from '../src/cancellations/dto/cancellation.dto';
import { CONTACT_LOCALES, CreateContactMessageDto } from '../src/contact/dto/contact.dto';
import { NEWSLETTER_SOURCES, SubscribeDto } from '../src/newsletter/dto/newsletter.dto';
import { CreateOrderDto, OrderLookupDto } from '../src/orders/dto/order.dto';
import { MAX_INSTALLMENTS, PayDto } from '../src/payment/dto/charge.dto';
import { CARD_BRANDS, PAYMENT_METHODS, PAYMENT_SIMULATIONS } from '../src/payment/payment.interface';
import { CreatePickupPointDto, UpdatePickupPointDto } from '../src/pickup-points/dto/pickup-point.dto';
import { PRODUCT_CONTENT_MAX, UpdateProductDto } from '../src/products/dto/product.dto';
import { UpdateSiteConfigDto } from '../src/site-config/dto/update-site-config.dto';
import { DeliveryMethod } from '../src/generated/prisma';

type Payload = Record<string, unknown>;
type DtoClass = new () => object;

/** Runs `payload` through the real pipe: the transformed DTO, or the failing field paths. */
async function viaDto(Dto: DtoClass, payload: Payload): Promise<{ ok: true; value: Payload } | { ok: false; fields: string[] }> {
  const meta: ArgumentMetadata = { type: 'body', metatype: Dto, data: '' };
  try {
    const value = (await strictValidationPipe.transform(structuredClone(payload), meta)) as Payload;
    return { ok: true, value };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    const body = err.getResponse() as { errors: { field: string }[] };
    return { ok: false, fields: [...new Set(body.errors.map((e) => e.field))] };
  }
}

function viaZod(schema: ZodTypeAny, payload: Payload): { ok: true; value: Payload } | { ok: false; fields: string[] } {
  const result = schema.safeParse(payload);
  return result.success ? { ok: true, value: result.data } : { ok: false, fields: Object.keys(issuesByField(result.error)) };
}

const s = (n: number, c = 'a') => c.repeat(n);

type Contract = {
  schema: ZodTypeAny;
  Dto: DtoClass;
  /** Both sides accept these; the DTO also accepts what the schema outputs (what the client sends). */
  valid: Record<string, Payload>;
  /** Both sides reject these, on exactly the named field. */
  invalid: Record<string, [field: string, payload: Payload]>;
};

function contract(name: string, { schema, Dto, valid, invalid }: Contract) {
  describe(name, () => {
    it.each(Object.entries(valid))('accepts: %s', async (_label, payload) => {
      const zod = viaZod(schema, payload);
      expect(zod).toMatchObject({ ok: true });
      expect(await viaDto(Dto, payload)).toMatchObject({ ok: true });
      if (zod.ok) expect(await viaDto(Dto, zod.value)).toMatchObject({ ok: true });
    });

    it.each(Object.entries(invalid))('rejects: %s', async (_label, [field, payload]) => {
      expect(viaZod(schema, payload)).toEqual({ ok: false, fields: [field] });
      expect(await viaDto(Dto, payload)).toEqual({ ok: false, fields: [field] });
    });
  });
}

// ------------------------------------------------------------------- orders

const contact = { customerEmail: 'dana@example.com', recipientName: 'Dana Levi', phone: '050-1234567' };
const courier = {
  ...contact,
  deliveryMethod: 'COURIER',
  shippingCity: 'Tel Aviv',
  shippingStreet: 'Dizengoff',
  shippingNumber: '10',
};
const pickup = { ...contact, deliveryMethod: 'PICKUP_POINT', pickupPointId: 'pp_1' };

contract('createOrderSchema ⇔ CreateOrderDto', {
  schema: createOrderSchema,
  Dto: CreateOrderDto,
  valid: {
    'courier, minimal': courier,
    'courier, every field': {
      ...courier,
      shippingApartment: s(60),
      shippingZip: '6100000',
      couponCode: 'SUMMER10',
      locale: 'en',
      marketingConsent: true,
    },
    'international phone': { ...courier, phone: '+972 50-123-4567' },
    'surrounding whitespace is trimmed': { ...courier, recipientName: '  Dana  ', customerEmail: ' dana@example.com ' },
    'pickup point': pickup,
    'pickup point with a stray address': { ...pickup, shippingCity: '', shippingStreet: '' },
  },
  invalid: {
    'blank name': ['recipientName', { ...courier, recipientName: '   ' }],
    'name too long': ['recipientName', { ...courier, recipientName: s(101) }],
    'letters in phone': ['phone', { ...courier, phone: 'call me' }],
    'phone too short': ['phone', { ...courier, phone: '12345' }],
    'bad email': ['customerEmail', { ...courier, customerEmail: 'dana@' }],
    'email too long': ['customerEmail', { ...courier, customerEmail: `${s(64)}@${s(190)}.com` }],
    'courier without city': ['shippingCity', { ...courier, shippingCity: undefined }],
    'courier with blank street': ['shippingStreet', { ...courier, shippingStreet: ' ' }],
    'street too long': ['shippingStreet', { ...courier, shippingStreet: s(151) }],
    'house number too long': ['shippingNumber', { ...courier, shippingNumber: s(21) }],
    'apartment too long': ['shippingApartment', { ...courier, shippingApartment: s(61) }],
    'zip too long': ['shippingZip', { ...courier, shippingZip: s(21) }],
    'pickup without a point': ['pickupPointId', { ...pickup, pickupPointId: undefined }],
    'pickup point id too long': ['pickupPointId', { ...pickup, pickupPointId: s(51) }],
    'unknown locale': ['locale', { ...courier, locale: 'fr' }],
    'unknown delivery method': ['deliveryMethod', { ...courier, deliveryMethod: 'DRONE' }],
    'coupon too long': ['couponCode', { ...courier, couponCode: s(51) }],
    'consent not a boolean': ['marketingConsent', { ...courier, marketingConsent: 'yes' }],
  },
});

describe('createOrderSchema: deliberately stricter than CreateOrderDto', () => {
  it('requires the email the API would take from the session', async () => {
    const payload = { ...courier, customerEmail: undefined };
    expect(viaZod(createOrderSchema, payload)).toEqual({ ok: false, fields: ['customerEmail'] });
    expect(await viaDto(CreateOrderDto, payload)).toMatchObject({ ok: true });
  });

  it('requires an explicit delivery method (the API defaults to COURIER)', async () => {
    const payload = { ...courier, deliveryMethod: undefined };
    expect(viaZod(createOrderSchema, payload)).toMatchObject({ ok: false });
    expect(await viaDto(CreateOrderDto, payload)).toMatchObject({ ok: true });
  });

  it('delivery methods match the Prisma enum', () => {
    expect([...DELIVERY_METHODS].sort()).toEqual(Object.values(DeliveryMethod).sort());
  });
});

describe('checkoutSchema', () => {
  it('requires the terms checkbox, which never reaches the API', async () => {
    expect(viaZod(checkoutSchema, { ...courier, acceptTerms: false })).toEqual({ ok: false, fields: ['acceptTerms'] });
    const parsed = checkoutSchema.parse({ ...courier, acceptTerms: true });
    const payload = toCreateOrderPayload(parsed);
    expect(payload).not.toHaveProperty('acceptTerms');
    expect(await viaDto(CreateOrderDto, payload)).toMatchObject({ ok: true });
  });
});

contract('orderLookupSchema ⇔ OrderLookupDto', {
  schema: orderLookupSchema,
  Dto: OrderLookupDto,
  valid: { lookup: { orderNumber: 'BA-20260101-ABC123', email: 'dana@example.com' } },
  invalid: {
    'blank order number': ['orderNumber', { orderNumber: '  ', email: 'dana@example.com' }],
    'order number too long': ['orderNumber', { orderNumber: s(41), email: 'dana@example.com' }],
    'bad email': ['email', { orderNumber: 'BA-1', email: 'nope' }],
  },
});

// ------------------------------------------------------------ cancellations

contract('selfCancelSchema ⇔ SelfCancelDto', {
  schema: selfCancelSchema,
  Dto: SelfCancelDto,
  valid: { 'reason only': { reason: 'SIZE' }, 'with details': { reason: 'OTHER', details: s(1000) } },
  invalid: {
    'missing reason': ['reason', {}],
    'unknown reason': ['reason', { reason: 'BORED' }],
    'details too long': ['details', { reason: 'SIZE', details: s(1001) }],
  },
});

contract('cancellationRequestSchema ⇔ CancellationRequestDto', {
  schema: cancellationRequestSchema,
  Dto: CancellationRequestDto,
  valid: {
    'with phone': { reason: 'CHANGED_MIND', contactPhone: '052 123 4567' },
    'blank phone and details': { reason: 'SIZE', contactPhone: '  ', details: '' },
  },
  invalid: { 'bad phone': ['contactPhone', { reason: 'SIZE', contactPhone: 'abc' }] },
});

const publicCancel = { orderNumber: 'BA-1', email: 'dana@example.com', reason: 'SIZE' };
contract('publicCancellationSchema ⇔ PublicCancellationDto', {
  schema: publicCancellationSchema,
  Dto: PublicCancellationDto,
  valid: { request: publicCancel, instant: { ...publicCancel, instant: true, contactPhone: '+972501234567' } },
  invalid: {
    'blank order number': ['orderNumber', { ...publicCancel, orderNumber: '' }],
    'bad email': ['email', { ...publicCancel, email: 'dana.example.com' }],
    'unknown reason': ['reason', { ...publicCancel, reason: 'size' }],
    'instant not a boolean': ['instant', { ...publicCancel, instant: 'true' }],
    'bad phone': ['contactPhone', { ...publicCancel, contactPhone: '05' }],
  },
});

it('cancellation reasons are shared with the server', () => {
  expect(SHARED_REASONS).toEqual(CANCELLATION_REASONS);
});

// ------------------------------------------------------------------ payment

contract('paySchema ⇔ PayDto', {
  schema: paySchema,
  Dto: PayDto,
  valid: {
    empty: {},
    card: { method: 'card', installments: 12, cardBrand: 'isracard', cardLast4: '4242', simulation: 'success' },
    bit: { method: 'bit' },
  },
  invalid: {
    'zero installments': ['installments', { installments: 0 }],
    'too many installments': ['installments', { installments: 13 }],
    'fractional installments': ['installments', { installments: 1.5 }],
    'unknown method': ['method', { method: 'cash' }],
    'unknown brand': ['cardBrand', { cardBrand: 'discover' }],
    'last4 not four digits': ['cardLast4', { cardLast4: '42' }],
    'unknown simulation': ['simulation', { simulation: 'chargeback' }],
  },
});

describe('paySchema: PCI scope', () => {
  it('never lets card data through, like the pipe', async () => {
    const payload = { method: 'card', cardNumber: '4111111111111111', cvv: '123', expiry: '12/30', idNumber: '123456782' };
    const zod = paySchema.parse(payload);
    const dto = await viaDto(PayDto, payload);
    for (const field of ['cardNumber', 'cvv', 'expiry', 'idNumber']) {
      expect(zod).not.toHaveProperty(field);
      expect(dto.ok && dto.value).not.toHaveProperty(field);
    }
  });

  it('enums and limits match the server', () => {
    expect(SHARED_PAYMENT_METHODS).toEqual(PAYMENT_METHODS);
    expect(SHARED_CARD_BRANDS).toEqual(CARD_BRANDS);
    expect(SHARED_PAYMENT_SIMULATIONS).toEqual(PAYMENT_SIMULATIONS);
    expect(SHARED_MAX_INSTALLMENTS).toBe(MAX_INSTALLMENTS);
  });
});

// ------------------------------------------------------------------ contact

const message = { name: 'Dana', email: 'Dana@Example.com', message: 'Do you ship to Eilat?' };
contract('contactSchema ⇔ CreateContactMessageDto', {
  schema: contactSchema,
  Dto: CreateContactMessageDto,
  valid: {
    minimal: message,
    'every field': { ...message, phone: '03-1234567', orderNumber: 'BA-1', subject: 'Shipping', locale: 'he', website: '' },
    'blank optional fields': { ...message, phone: '', orderNumber: ' ', subject: '' },
    'honeypot filled (accepted, then dropped by the API)': { ...message, website: 'http://spam.example' },
  },
  invalid: {
    'blank name': ['name', { ...message, name: ' ' }],
    'name too long': ['name', { ...message, name: s(101) }],
    'bad email': ['email', { ...message, email: 'dana' }],
    'bad phone': ['phone', { ...message, phone: 'abc' }],
    'order number too long': ['orderNumber', { ...message, orderNumber: s(41) }],
    'subject too long': ['subject', { ...message, subject: s(151) }],
    'blank message': ['message', { ...message, message: '' }],
    'message too long': ['message', { ...message, message: s(5001) }],
    'unknown locale': ['locale', { ...message, locale: 'ru' }],
    'honeypot too long': ['website', { ...message, website: s(501) }],
  },
});

it('contact locales match', () => {
  expect(LOCALES).toEqual(CONTACT_LOCALES);
});

// --------------------------------------------------------------- newsletter

contract('newsletterSubscribeSchema ⇔ SubscribeDto', {
  schema: newsletterSubscribeSchema,
  Dto: SubscribeDto,
  valid: {
    minimal: { email: 'dana@example.com', consent: true },
    'with locale and source': { email: 'dana@example.com', consent: true, locale: 'en', source: 'checkout' },
  },
  invalid: {
    'consent false': ['consent', { email: 'dana@example.com', consent: false }],
    'consent missing': ['consent', { email: 'dana@example.com' }],
    'consent as a string': ['consent', { email: 'dana@example.com', consent: 'true' }],
    'bad email': ['email', { email: 'dana@example', consent: true }],
    'source not allowed on this endpoint': ['source', { email: 'dana@example.com', consent: true, source: 'account' }],
  },
});

it('newsletter sources match', () => {
  expect(SHARED_NEWSLETTER_SOURCES).toEqual(NEWSLETTER_SOURCES);
});

// ---------------------------------------------------------------- addresses

const address = { recipientName: 'Dana', phone: '0501234567', city: 'Haifa', street: 'Herzl', number: '5' };
contract('addressSchema ⇔ CreateAddressDto', {
  schema: addressSchema,
  Dto: CreateAddressDto,
  valid: {
    minimal: address,
    'every field': { ...address, apartment: 'Apt 4, floor 2, entrance B', zip: '3100000', isDefault: true },
    'apartment as long as the checkout allows': { ...address, apartment: s(60) },
    'blank optional fields are cleared': { ...address, apartment: '', zip: '  ' },
  },
  invalid: {
    'blank name': ['recipientName', { ...address, recipientName: '' }],
    'bad phone': ['phone', { ...address, phone: '+' }],
    'city too long': ['city', { ...address, city: s(101) }],
    'missing street': ['street', { ...address, street: undefined }],
    'number too long': ['number', { ...address, number: s(21) }],
    'apartment too long': ['apartment', { ...address, apartment: s(61) }],
    'zip too long': ['zip', { ...address, zip: s(21) }],
    'isDefault not a boolean': ['isDefault', { ...address, isDefault: 'yes' }],
  },
});

contract('addressUpdateSchema ⇔ UpdateAddressDto', {
  schema: addressUpdateSchema,
  Dto: UpdateAddressDto,
  valid: { 'one field': { city: ' Jaffa ' }, 'clear apartment': { apartment: '' } },
  invalid: { 'blank city': ['city', { city: '' }] },
});

it('address book limit matches', () => {
  expect(MAX_ADDRESSES).toBe(MAX_ADDRESSES_PER_USER);
});

// ---------------------------------------------------------------- account

it('register password minimum matches better-auth', () => {
  const config = readFileSync(join(__dirname, '../src/auth/auth.config.ts'), 'utf8');
  expect(config).toContain(`minPasswordLength: ${PASSWORD_MIN_LENGTH},`);
});

// -------------------------------------------------------------------- admin

const business = {
  businessName: 'BAIA Swimwear',
  companyId: '515555555',
  businessAddress: 'Herzl 1, Tel Aviv',
  businessPhone: '03-1234567',
  contactEmail: 'hello@baia.co.il',
  whatsappNumber: '972501234567',
  accessibilityCoordinatorName: 'Dana Levi',
  accessibilityCoordinatorPhone: '050-1234567',
  accessibilityCoordinatorEmail: 'a11y@baia.co.il',
};
contract('businessDetailsSchema ⇔ UpdateSiteConfigDto', {
  schema: businessDetailsSchema,
  Dto: UpdateSiteConfigDto,
  valid: {
    'every field': business,
    'no WhatsApp (null)': { ...business, whatsappNumber: null },
    'no WhatsApp (blank)': { ...business, whatsappNumber: '' },
  },
  invalid: {
    'blank business name': ['businessName', { ...business, businessName: '  ' }],
    'company id too long': ['companyId', { ...business, companyId: s(41, '1') }],
    'address too long': ['businessAddress', { ...business, businessAddress: s(201) }],
    'bad contact email': ['contactEmail', { ...business, contactEmail: 'hello@' }],
    'WhatsApp in local format': ['whatsappNumber', { ...business, whatsappNumber: '0501234567' }],
    'WhatsApp with letters': ['whatsappNumber', { ...business, whatsappNumber: '97250abc4567' }],
    'bad coordinator email': ['accessibilityCoordinatorEmail', { ...business, accessibilityCoordinatorEmail: 'x' }],
  },
});

describe('businessDetailsSchema: normalisation', () => {
  it('turns a formatted WhatsApp number into the digits the API expects', async () => {
    const parsed = businessDetailsSchema.parse({ ...business, whatsappNumber: '+972 50-123-4567' });
    expect(parsed.whatsappNumber).toBe('972501234567');
    expect(await viaDto(UpdateSiteConfigDto, parsed)).toMatchObject({ ok: true });
  });

  it('requires every field the form shows (the API allows partial updates)', async () => {
    expect(viaZod(businessDetailsSchema, { ...business, companyId: undefined })).toEqual({ ok: false, fields: ['companyId'] });
    expect(await viaDto(UpdateSiteConfigDto, { ...business, companyId: undefined })).toMatchObject({ ok: true });
  });
});

const delivery = {
  shippingCost: 29.9,
  pickupPointCost: 19.9,
  freeShippingThreshold: 249,
  courierEtaDays: '3-5',
  pickupEtaDays: '2',
  selfCancelWindowHours: 48,
};
contract('deliverySettingsSchema ⇔ UpdateSiteConfigDto', {
  schema: deliverySettingsSchema,
  Dto: UpdateSiteConfigDto,
  valid: {
    defaults: delivery,
    'free shipping, no window': { ...delivery, shippingCost: 0, pickupPointCost: 0, selfCancelWindowHours: 0 },
    'upper limits': { ...delivery, shippingCost: 100000, freeShippingThreshold: 1000000, selfCancelWindowHours: 336 },
  },
  invalid: {
    'negative price': ['shippingCost', { ...delivery, shippingCost: -1 }],
    'price too high': ['pickupPointCost', { ...delivery, pickupPointCost: 100000.01 }],
    'three decimals': ['shippingCost', { ...delivery, shippingCost: 29.999 }],
    'threshold too high': ['freeShippingThreshold', { ...delivery, freeShippingThreshold: 1000001 }],
    'ETA in words': ['courierEtaDays', { ...delivery, courierEtaDays: '3 to 5' }],
    'ETA with three digits': ['pickupEtaDays', { ...delivery, pickupEtaDays: '100' }],
    'window over two weeks': ['selfCancelWindowHours', { ...delivery, selfCancelWindowHours: 337 }],
    'fractional window': ['selfCancelWindowHours', { ...delivery, selfCancelWindowHours: 1.5 }],
  },
});

describe('deliverySettingsSchema: form input', () => {
  it('converts the form strings to the numbers the API expects', async () => {
    const form = { ...delivery, shippingCost: '29.90', pickupPointCost: ' 19.9', freeShippingThreshold: '249', selfCancelWindowHours: '48' };
    const parsed = deliverySettingsSchema.parse(form);
    expect(parsed).toEqual(delivery);
    expect(await viaDto(UpdateSiteConfigDto, parsed)).toMatchObject({ ok: true });
  });

  it('treats a blank amount as missing, not zero', () => {
    expect(viaZod(deliverySettingsSchema, { ...delivery, shippingCost: '' })).toEqual({ ok: false, fields: ['shippingCost'] });
  });
});

const point = { name: 'Super-Pharm Dizengoff', city: 'Tel Aviv', address: 'Dizengoff 50' };
contract('pickupPointSchema ⇔ CreatePickupPointDto', {
  schema: pickupPointSchema,
  Dto: CreatePickupPointDto,
  valid: {
    minimal: point,
    'every field': { ...point, hours: 'Sun-Thu 9-21', isActive: false, sortOrder: 10 },
    'blank hours are cleared': { ...point, hours: '' },
  },
  invalid: {
    'blank name': ['name', { ...point, name: '' }],
    'city too long': ['city', { ...point, city: s(81) }],
    'address too long': ['address', { ...point, address: s(201) }],
    'hours too long': ['hours', { ...point, hours: s(201) }],
    'negative sort order': ['sortOrder', { ...point, sortOrder: -1 }],
    'fractional sort order': ['sortOrder', { ...point, sortOrder: 1.5 }],
    'sort order too high': ['sortOrder', { ...point, sortOrder: 100001 }],
    'isActive not a boolean': ['isActive', { ...point, isActive: 'yes' }],
  },
});

contract('pickupPointUpdateSchema ⇔ UpdatePickupPointDto', {
  schema: pickupPointUpdateSchema,
  Dto: UpdatePickupPointDto,
  valid: { toggle: { isActive: false }, rename: { name: ' New name ' } },
  invalid: { 'blank name': ['name', { name: ' ' }] },
});

contract('productContentSchema ⇔ UpdateProductDto (content fields)', {
  schema: productContentSchema,
  Dto: UpdateProductDto,
  valid: {
    'every field': { fabricHe: '82% ניילון', fabricEn: '82% nylon', careHe: 'כביסה ביד', careEn: 'Hand wash', fitHe: 'M', fitEn: 'M' },
    'at the limits': { fabricHe: s(1000), careEn: s(2000), fitHe: s(1000) },
    'cleared with blanks and null': { fabricHe: '', careHe: null },
  },
  invalid: {
    'fabric too long': ['fabricEn', { fabricEn: s(1001) }],
    'care too long': ['careHe', { careHe: s(2001) }],
    'fit too long': ['fitEn', { fitEn: s(1001) }],
    'not text': ['fitHe', { fitHe: 5 }],
  },
});

it('product content limits match', () => {
  expect(SHARED_PRODUCT_CONTENT_MAX).toEqual(PRODUCT_CONTENT_MAX);
});
