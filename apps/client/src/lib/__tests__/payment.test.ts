import { describe, expect, it } from 'vitest';
import {
  cardNumberValid,
  cardPayRequest,
  detectCardBrand,
  expiryValid,
  formatCardNumber,
  formatExpiry,
  formatIsraeliMobile,
  installmentOptions,
  israeliIdValid,
  israeliMobileValid,
  isracardValid,
  luhnValid,
  normalizePaymentConfig,
  paymentSummary,
  simulationForCard,
} from '../payment';

describe('luhnValid', () => {
  it('accepts valid numbers and rejects bad check digits', () => {
    expect(luhnValid('4242424242424242')).toBe(true);
    expect(luhnValid('4242 4242 4242 4242')).toBe(true);
    expect(luhnValid('4000000000000002')).toBe(true);
    expect(luhnValid('378282246310005')).toBe(true);
    expect(luhnValid('4242424242424241')).toBe(false);
    expect(luhnValid('1234')).toBe(false);
    expect(luhnValid('')).toBe(false);
  });
});

describe('detectCardBrand', () => {
  it.each([
    ['4242', 'visa'],
    ['5555 5555 5555 4444', 'mastercard'],
    ['2223003122003222', 'mastercard'],
    ['2720', 'mastercard'],
    ['378282246310005', 'amex'],
    ['34', 'amex'],
    ['30569309025904', 'diners'],
    ['36', 'diners'],
    ['12345674', 'isracard'],
  ] as const)('%s -> %s', (number, brand) => {
    expect(detectCardBrand(number)).toBe(brand);
  });

  it('is null while unknown', () => {
    expect(detectCardBrand('')).toBeNull();
    expect(detectCardBrand('9')).toBeNull();
    expect(detectCardBrand('2721')).toBeNull();
    expect(detectCardBrand('1234567890')).toBeNull();
  });
});

describe('cardNumberValid', () => {
  it('needs a known brand, the brand length and a valid checksum', () => {
    expect(cardNumberValid('4242424242424242')).toBe(true);
    expect(cardNumberValid('378282246310005')).toBe(true);
    expect(cardNumberValid('30569309025904')).toBe(true);
    expect(cardNumberValid('5555555555554444')).toBe(true);
    expect(cardNumberValid('424242424242')).toBe(false); // too short
    expect(cardNumberValid('4242424242424241')).toBe(false); // checksum
    expect(cardNumberValid('9999999999999995')).toBe(false); // unknown brand
  });

  it('validates Isracard with its mod 11 check', () => {
    expect(isracardValid('12345679')).toBe(true);
    expect(isracardValid('100000002')).toBe(true);
    expect(isracardValid('12345678')).toBe(false);
    expect(isracardValid('1234567')).toBe(false);
    expect(cardNumberValid('12345679')).toBe(true);
    expect(cardNumberValid('12345678')).toBe(false);
  });
});

describe('formatCardNumber', () => {
  it('groups by brand and caps the length', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('42424')).toBe('4242 4');
    expect(formatCardNumber('4242-4242 4242x4242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
    expect(formatCardNumber('3782822463100059999')).toBe('3782 822463 10005');
    expect(formatCardNumber('30569309025904')).toBe('3056 930902 5904');
    expect(formatCardNumber('55555555555544449')).toBe('5555 5555 5555 4444');
    expect(formatCardNumber('')).toBe('');
  });
});

describe('expiry', () => {
  it('formats MM/YY while typing', () => {
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('12')).toBe('12');
    expect(formatExpiry('123')).toBe('12/3');
    expect(formatExpiry('1230')).toBe('12/30');
    expect(formatExpiry('12/30')).toBe('12/30');
    expect(formatExpiry('4')).toBe('04');
    expect(formatExpiry('13')).toBe('1');
    expect(formatExpiry('00')).toBe('0');
    expect(formatExpiry('123099')).toBe('12/30');
  });

  it('accepts the current month and later, not the past', () => {
    const now = new Date(2026, 9, 19); // October 2026
    expect(expiryValid('10/26', now)).toBe(true);
    expect(expiryValid('01/27', now)).toBe(true);
    expect(expiryValid('09/26', now)).toBe(false);
    expect(expiryValid('13/27', now)).toBe(false);
    expect(expiryValid('1/27', now)).toBe(false);
    expect(expiryValid('12/99', now)).toBe(false); // absurdly far
  });
});

describe('israeliIdValid', () => {
  it('checks the ID check digit', () => {
    expect(israeliIdValid('123456782')).toBe(true);
    expect(israeliIdValid('000000018')).toBe(true);
    expect(israeliIdValid('39337423')).toBe(true); // leading zero omitted
    expect(israeliIdValid('123456789')).toBe(false);
    expect(israeliIdValid('000000000')).toBe(false);
    expect(israeliIdValid('1234567890')).toBe(false);
    expect(israeliIdValid('12345678a')).toBe(false);
    expect(israeliIdValid('')).toBe(false);
  });
});

describe('Bit phone', () => {
  it('validates and formats Israeli mobiles', () => {
    expect(israeliMobileValid('050-1234567')).toBe(true);
    expect(israeliMobileValid('0501234567')).toBe(true);
    expect(israeliMobileValid('03-1234567')).toBe(false);
    expect(israeliMobileValid('050123456')).toBe(false);
    expect(formatIsraeliMobile('0501234567')).toBe('050-1234567');
    expect(formatIsraeliMobile('05012345678')).toBe('050-1234567');
    expect(formatIsraeliMobile('05')).toBe('05');
  });
});

describe('test cards and the request sent to the API', () => {
  it('maps the mock test cards to outcomes', () => {
    expect(simulationForCard('4242 4242 4242 4242')).toBe('success');
    expect(simulationForCard('4000 0000 0000 0002')).toBe('decline');
    expect(simulationForCard('4000000000009995')).toBe('insufficient_funds');
    expect(simulationForCard('4000000000003220')).toBe('3ds');
    expect(simulationForCard('5555555555554444')).toBe('success');
  });

  it('never includes the card number, only brand and last 4', () => {
    const req = cardPayRequest('4000 0000 0000 0002', 1, { testMode: true });
    expect(req).toEqual({ method: 'card', installments: 1, cardBrand: 'visa', cardLast4: '0002', simulation: 'decline' });
    expect(JSON.stringify(req)).not.toContain('4000000000000002');
    expect(cardPayRequest('4242424242424242', 3, { testMode: false })).toEqual({
      method: 'card',
      installments: 3,
      cardBrand: 'visa',
      cardLast4: '4242',
    });
    expect(cardPayRequest('4000000000003220', 1, { testMode: true, simulation: '3ds' }).simulation).toBe('3ds');
  });

  it('offers installments only from the minimum total', () => {
    const config = { max: 12, minTotal: 300 };
    expect(installmentOptions(299.9, config)).toEqual([1]);
    expect(installmentOptions(300, config)).toHaveLength(12);
    expect(installmentOptions(500, undefined)).toEqual([1]);
  });
});

describe('paymentSummary', () => {
  it('describes how an order was paid', () => {
    expect(paymentSummary({ paymentMethod: 'card', cardBrand: 'visa', cardLast4: '4242', paymentInstallments: 3 })).toEqual({
      key: 'cardInstallments',
      values: { brand: 'visa', last4: '4242', installments: 3 },
    });
    expect(paymentSummary({ paymentMethod: 'card', cardBrand: 'weird', cardLast4: '1111', paymentInstallments: 1 })?.key).toBe('card');
    expect(paymentSummary({ paymentMethod: 'card', cardBrand: 'weird', cardLast4: '1111' })?.values.brand).toBe('other');
    expect(paymentSummary({ paymentMethod: 'bit' })?.key).toBe('bit');
    expect(paymentSummary({ paymentMethod: 'apple_pay' })?.key).toBe('applePay');
    expect(paymentSummary({ paymentMethod: null })).toBeNull();
    expect(paymentSummary({})).toBeNull();
  });
});

describe('normalizePaymentConfig', () => {
  const base = { enabled: true, methods: ['card' as const], installments: { max: 1, minTotal: 0 } };

  it('keeps the test UI for the mock provider only', () => {
    expect(normalizePaymentConfig({ ...base, provider: 'mock', testMode: true }).testMode).toBe(true);
    // A real provider never shows test cards, whatever the server reported.
    expect(normalizePaymentConfig({ ...base, provider: 'tranzila', testMode: true }).testMode).toBe(false);
    expect(normalizePaymentConfig({ ...base, provider: 'mock', testMode: false }).testMode).toBe(false);
  });

  it('passes the payments flag through', () => {
    expect(normalizePaymentConfig({ ...base, enabled: false, provider: 'mock', testMode: false }).enabled).toBe(false);
  });
});
