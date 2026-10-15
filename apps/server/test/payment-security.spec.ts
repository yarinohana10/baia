import { Test } from '@nestjs/testing';
import { Module } from '@nestjs/common';
import { createPaymentProvider } from '../src/payment/payment-provider.factory';
import { MockPaymentProvider } from '../src/payment/mock-payment.provider';
import { PAYMENT_PROVIDER } from '../src/payment/payment.interface';
import { HmacSha256WebhookVerifier, createWebhookVerifier } from '../src/payment/webhook/webhook-verifier';

const quietLogger = { warn: jest.fn() } as any;

describe('createPaymentProvider (mock must never be bound silently in production)', () => {
  it('binds the mock by default outside production', () => {
    expect(createPaymentProvider({ NODE_ENV: 'development' }, quietLogger)).toBeInstanceOf(MockPaymentProvider);
    expect(createPaymentProvider({}, quietLogger)).toBeInstanceOf(MockPaymentProvider);
  });

  it('refuses to bind any provider in production when PAYMENT_PROVIDER is unset', () => {
    expect(() => createPaymentProvider({ NODE_ENV: 'production' }, quietLogger)).toThrow(/Refusing to bind the mock/);
    expect(() => createPaymentProvider({ NODE_ENV: 'production', PAYMENT_PROVIDER: '  ' }, quietLogger)).toThrow();
  });

  it('allows the mock in production only with the explicit PAYMENT_PROVIDER=mock flag, and warns', () => {
    const logger = { warn: jest.fn() } as any;
    const provider = createPaymentProvider({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'mock' }, logger);
    expect(provider).toBeInstanceOf(MockPaymentProvider);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('rejects unknown providers instead of falling back to the mock', () => {
    expect(() => createPaymentProvider({ NODE_ENV: 'development', PAYMENT_PROVIDER: 'stripe' }, quietLogger)).toThrow(
      /Unknown PAYMENT_PROVIDER/,
    );
  });

  it('a Nest module using the factory fails to boot in production without the flag', async () => {
    const prev = { NODE_ENV: process.env.NODE_ENV, PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER };
    process.env.NODE_ENV = 'production';
    delete process.env.PAYMENT_PROVIDER;
    @Module({ providers: [{ provide: PAYMENT_PROVIDER, useFactory: () => createPaymentProvider() }] })
    class M {}
    try {
      await expect(Test.createTestingModule({ imports: [M] }).compile()).rejects.toThrow(/Refusing to bind/);
    } finally {
      process.env.NODE_ENV = prev.NODE_ENV;
      if (prev.PAYMENT_PROVIDER === undefined) delete process.env.PAYMENT_PROVIDER;
      else process.env.PAYMENT_PROVIDER = prev.PAYMENT_PROVIDER;
    }
  });
});

describe('HmacSha256WebhookVerifier', () => {
  const secret = 's'.repeat(40);
  const now = 1_800_000_000_000;
  const verifier = new HmacSha256WebhookVerifier(secret, { now: () => now });
  const event = {
    type: 'payment.succeeded',
    eventId: 'evt_1',
    orderId: 'ord_1',
    providerRef: 'ch_1',
    amount: 229.9,
    currency: 'ILS',
  };
  const body = Buffer.from(JSON.stringify(event));
  const ts = Math.floor(now / 1000);

  it('accepts a correctly signed, fresh payload', () => {
    const sig = HmacSha256WebhookVerifier.sign(secret, body, ts);
    expect(verifier.verify(body, { 'x-baia-signature': sig })).toEqual(event);
  });

  it('rejects a tampered body', () => {
    const sig = HmacSha256WebhookVerifier.sign(secret, body, ts);
    const tampered = Buffer.from(JSON.stringify({ ...event, amount: 0.01 }));
    expect(verifier.verify(tampered, { 'x-baia-signature': sig })).toBeNull();
  });

  it('rejects a wrong secret, a missing header and a stale timestamp (replay)', () => {
    expect(verifier.verify(body, { 'x-baia-signature': HmacSha256WebhookVerifier.sign('x'.repeat(40), body, ts) })).toBeNull();
    expect(verifier.verify(body, {})).toBeNull();
    const stale = HmacSha256WebhookVerifier.sign(secret, body, ts - 3600);
    expect(verifier.verify(body, { 'x-baia-signature': stale })).toBeNull();
  });

  it('requires a strong secret, and is disabled when no secret is configured', () => {
    expect(() => new HmacSha256WebhookVerifier('short')).toThrow();
    expect(createWebhookVerifier({})).toBeNull();
  });
});
