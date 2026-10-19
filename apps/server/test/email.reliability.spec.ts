import { EmailService, isTransientEmailError, retryDelaysFromEnv } from '../src/email/email.service';
import { mergeBranding } from '../src/email/email-store';
import { renderTemplate } from '../src/email/templates';
import { paymentLines } from '../src/email/templates/helpers';
import { MemoryEmailTransport } from '../src/email/transports/console.transport';
import type { EmailLogEntry, EmailStore, EmailTransport } from '../src/email/email.types';

const ENV = { CLIENT_URL: 'https://shop.test', NODE_ENV: 'test' } as NodeJS.ProcessEnv;

const BRANDING = {
  businessName: 'BAIA Swimwear',
  companyId: '000000000',
  businessAddress: 'מושב גילת',
  businessPhone: '050-1234567',
  contactEmail: 'hello@baia.test',
  whatsappNumber: '972501234567',
};

class FakeStore implements EmailStore {
  logs: EmailLogEntry[] = [];
  brandingCalls = 0;
  failLog = false;
  failBranding = false;

  async branding() {
    this.brandingCalls += 1;
    if (this.failBranding) throw new Error('db down');
    return BRANDING;
  }

  async log(entry: EmailLogEntry) {
    if (this.failLog) throw new Error('log table missing');
    this.logs.push(entry);
  }
}

/** Fails `failures` times with `error`, then succeeds. */
function flakyTransport(failures: number, error: unknown = Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' })) {
  const sent: unknown[] = [];
  let calls = 0;
  const transport: EmailTransport & { calls: () => number; sent: unknown[] } = {
    name: 'flaky',
    sent,
    calls: () => calls,
    async send(message) {
      calls += 1;
      if (calls <= failures) throw error;
      sent.push(message);
    },
  };
  return transport;
}

const welcome = { to: 'dana@example.test', locale: 'he', data: { name: 'דנה', shopUrl: 'https://shop.test/he' } } as const;

describe('EmailService reliability', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  it('retries transient failures and logs one SENT row with the attempt count', async () => {
    const store = new FakeStore();
    const transport = flakyTransport(2);
    const service = new EmailService(transport, 'BAIA <orders@baia.test>', { store, retryDelaysMs: [0, 0, 0], env: ENV });

    const result = await service.deliver('order-delivered', {
      to: 'dana@example.test',
      locale: 'en',
      meta: { orderId: 'ord_1' },
      data: { orderNumber: 'BA-1001', returnsUrl: 'https://shop.test/en/returns' },
    });

    expect(result).toEqual({ status: 'SENT', attempts: 3 });
    expect(transport.calls()).toBe(3);
    expect(store.logs).toHaveLength(1);
    expect(store.logs[0]).toMatchObject({
      template: 'order-delivered',
      to: 'dana@example.test',
      locale: 'en',
      orderId: 'ord_1',
      status: 'SENT',
      attempts: 3,
      error: null,
    });
    expect(store.logs[0].subject).toContain('BA-1001');
    // The body never reaches the log.
    expect(JSON.stringify(store.logs[0])).not.toContain('<html');
  });

  it('gives up after the configured attempts and logs FAILED with a trimmed error', async () => {
    const store = new FakeStore();
    const longError = Object.assign(new Error(`421 try again later\n${'x'.repeat(2000)}`), { responseCode: 421 });
    const transport = flakyTransport(10, longError);
    const service = new EmailService(transport, 'x@y', { store, retryDelaysMs: [0, 0, 0], env: ENV });

    await expect(service.dispatch('welcome', welcome)).resolves.toBeUndefined();

    expect(transport.calls()).toBe(3);
    expect(store.logs).toEqual([expect.objectContaining({ status: 'FAILED', attempts: 3, template: 'welcome' })]);
    expect(store.logs[0].error!.length).toBeLessThanOrEqual(500);
    expect(store.logs[0].error).not.toMatch(/\n/);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failed to send "welcome"'));
  });

  it('does not retry permanent failures (rejected recipient, bad credentials)', async () => {
    const store = new FakeStore();
    const transport = flakyTransport(10, Object.assign(new Error('550 mailbox unavailable'), { responseCode: 550 }));
    const service = new EmailService(transport, 'x@y', { store, retryDelaysMs: [0, 0, 0], env: ENV });

    const result = await service.deliver('welcome', welcome);
    expect(result).toMatchObject({ status: 'FAILED', attempts: 1 });
    expect(transport.calls()).toBe(1);

    expect(isTransientEmailError(Object.assign(new Error('auth'), { code: 'EAUTH', responseCode: 535 }))).toBe(false);
    expect(isTransientEmailError(Object.assign(new Error('x'), { code: 'ECONNECTION' }))).toBe(true);
    expect(isTransientEmailError(Object.assign(new Error('x'), { responseCode: 451 }))).toBe(true);
  });

  it('never throws into callers when the log store or branding lookup fails', async () => {
    const store = new FakeStore();
    store.failLog = true;
    store.failBranding = true;
    const transport = new MemoryEmailTransport();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = new EmailService(transport, 'x@y', { store, env: ENV });

    await expect(service.deliver('welcome', welcome)).resolves.toEqual({ status: 'SENT', attempts: 1 });
    expect(transport.sent).toHaveLength(1);
    // Falls back to the default footer.
    expect(transport.sent[0].text).toContain('BAIA Swimwear');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('could not write the email log'));
    warn.mockRestore();
  });

  it('sendTemplate still throws for callers that want to know', async () => {
    const service = new EmailService({ name: 'down', send: jest.fn().mockRejectedValue(new Error('down')) }, 'x@y', {
      retryDelaysMs: [0, 0],
    });
    await expect(service.sendTemplate('welcome', welcome)).rejects.toThrow('down');
  });

  it('caches branding and sets Reply-To to the store address on customer emails only', async () => {
    const store = new FakeStore();
    const transport = new MemoryEmailTransport();
    const service = new EmailService(transport, 'x@y', { store, env: ENV });

    await service.deliver('welcome', welcome);
    await service.deliver('admin-new-order', {
      to: 'store@baia.test',
      data: {
        orderNumber: 'BA-1',
        customer: 'Dana',
        email: 'dana@example.test',
        total: '₪100',
        itemCount: 1,
        delivery: 'שליח',
        marketingConsent: false,
        adminUrl: 'https://shop.test/he/admin/orders',
      },
    });
    await service.deliver('contact-notification', {
      to: 'store@baia.test',
      replyTo: 'dana@example.test',
      data: { name: 'Dana', email: 'dana@example.test', message: 'hi', locale: 'he', adminUrl: 'https://shop.test/he/admin' },
    });

    expect(store.brandingCalls).toBe(1);
    expect(transport.sent[0].replyTo).toBe('hello@baia.test');
    expect(transport.sent[1].replyTo).toBeUndefined();
    expect(transport.sent[2].replyTo).toBe('dana@example.test');
  });

  it('reads retry delays from env, with no waiting under tests', () => {
    expect(retryDelaysFromEnv({ EMAIL_RETRY_DELAYS_MS: '0, 500,1000' } as NodeJS.ProcessEnv)).toEqual([0, 500, 1000]);
    expect(retryDelaysFromEnv({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toEqual([0, 0, 0]);
    expect(retryDelaysFromEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toEqual([0, 2000, 8000]);
  });
});

describe('email footer', () => {
  const branding = mergeBranding(BRANDING, ENV);

  it('shows the business details, links and an accurate reason (Hebrew)', () => {
    const order = renderTemplate(
      'order-delivered',
      { orderNumber: 'BA-1', returnsUrl: 'https://shop.test/he/returns' },
      'he',
      branding,
    );
    expect(order.html).toContain('BAIA Swimwear');
    expect(order.html).toContain('מושב גילת');
    expect(order.html).toContain('href="tel:+972501234567"');
    expect(order.html).toContain('href="mailto:hello@baia.test"');
    expect(order.html).toContain('href="https://wa.me/972501234567"');
    expect(order.html).toContain('ח.פ. יעודכן בקרוב');
    expect(order.html).toContain('href="https://shop.test/he/terms"');
    expect(order.html).toContain('href="https://shop.test/he/privacy"');
    expect(order.html).toContain('בעקבות הזמנה שביצעת');
    expect(order.text).toContain('בעקבות הזמנה שביצעת');
    expect(order.text).toContain('https://shop.test/he/terms');

    const account = renderTemplate('reset-password', { url: 'https://shop.test/r', expiresInMinutes: 60 }, 'he', branding);
    expect(account.html).toContain('בעקבות פעולה בחשבון שלך');
    expect(account.html).not.toContain('בעקבות הזמנה');

    const contact = renderTemplate('contact-auto-reply', { name: 'דנה', message: 'שלום', shopUrl: 'https://shop.test/he' }, 'he', branding);
    expect(contact.html).toContain('בעקבות פנייה ששלחת');
  });

  it('shows a real company number and omits WhatsApp when unset (English)', () => {
    const b = mergeBranding({ ...BRANDING, companyId: '516123456', whatsappNumber: null }, ENV);
    const r = renderTemplate('welcome', { shopUrl: 'https://shop.test/en' }, 'en', b);
    expect(r.html).toContain('Company no. 516123456');
    expect(r.html).not.toContain('wa.me');
    expect(r.html).toContain('href="https://shop.test/en/privacy"');
    expect(r.html).toContain('activity on your BAIA account');
  });
});

describe('order email content', () => {
  const branding = mergeBranding(BRANDING, ENV);
  const confirmation = (overrides: Record<string, unknown> = {}) => ({
    name: 'דנה',
    orderNumber: 'BA-1001',
    orderDate: '19 באוקטובר 2026',
    items: [
      {
        name: 'בגד ים <img src=x onerror=alert(1)>',
        color: 'שחור"><script>',
        size: 'M',
        quantity: 2,
        unitPrice: '₪149.00',
        lineTotal: '₪298.00',
        imageUrl: 'https://cdn.test/p.jpg',
      },
      { name: 'Bikini', color: 'Blue', size: 'S', quantity: 1, lineTotal: '₪99.00', imageUrl: 'javascript:alert(1)' },
    ],
    subtotal: '₪397.00',
    shipping: 'חינם',
    discount: '₪20.00',
    total: '₪377.00',
    address: 'דנה, הרצל 1, תל אביב',
    addressLines: ['דנה', 'הרצל 1', 'תל אביב'],
    orderUrl: 'https://shop.test/he/account/orders',
    deliveryMethod: 'COURIER' as const,
    etaDays: '3-5',
    trackUrl: 'https://shop.test/he/order-status',
    cancelUrl: 'https://shop.test/he/cancel-order',
    cancelWindowHours: 48,
    contactUrl: 'https://shop.test/he/contact',
    payment: { method: 'card', cardBrand: 'visa', cardLast4: '4242', installments: 3 },
    ...overrides,
  });

  it('renders items, totals, payment and links without HTML injection', () => {
    const r = renderTemplate('order-confirmation', confirmation(), 'he', branding);
    expect(r.html).not.toContain('<img src=x');
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(r.html).not.toContain('javascript:');
    expect(r.html).toContain('src="https://cdn.test/p.jpg"');
    expect(r.html).toContain('ויזה •••• 4242 · 3 תשלומים');
    expect(r.html).toContain('המחירים כוללים מע״מ');
    expect(r.html).toContain('-₪20.00');
    // Secondary links are real anchors with labels, not printed URLs.
    expect(r.html).toMatch(/<a href="https:\/\/shop.test\/he\/order-status"[^>]*>מעקב אחר ההזמנה<\/a>/);
    expect(r.html).toMatch(/<a href="https:\/\/shop.test\/he\/cancel-order"[^>]*>ביטול הזמנה<\/a>/);
    // Text alternative carries the same information.
    expect(r.text).toContain('- 2 × בגד ים <img src=x onerror=alert(1)>');
    expect(r.text).toContain('סה״כ: ₪377.00');
    expect(r.text).toContain('מעקב אחר ההזמנה: https://shop.test/he/order-status');
    expect(r.text).toContain('48 שעות');
    expect(r.subject).toBe('אישור הזמנה BA-1001 - BAIA');
  });

  it('escapes admin notes and shows the refund breakdown on cancellation', () => {
    const r = renderTemplate(
      'order-cancelled',
      {
        orderNumber: 'BA-1',
        paid: true,
        orderTotal: '₪229.90',
        feeAmount: '₪11.50',
        refundAmount: '₪218.40',
        note: '<b>sorry</b>',
        shopUrl: 'https://shop.test/en',
      },
      'en',
      branding,
    );
    expect(r.html).toContain('&lt;b&gt;sorry&lt;/b&gt;');
    expect(r.html).not.toContain('<b>sorry</b>');
    expect(r.text).toContain('Order total: ₪229.90');
    expect(r.text).toContain('Cancellation fee: -₪11.50');
    expect(r.text).toContain('Refund: ₪218.40');
  });

  it('formats payment methods', () => {
    expect(paymentLines({ method: 'bit' }, 'he')).toEqual(['Bit']);
    expect(paymentLines({ method: 'apple_pay', installments: 1 }, 'en')).toEqual(['Apple Pay · single payment']);
    expect(paymentLines({ method: 'card', cardBrand: 'mastercard', cardLast4: '1111' }, 'en')).toEqual(['Mastercard •••• 1111']);
    expect(paymentLines({ method: null }, 'he')).toBeNull();
  });
});
