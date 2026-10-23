import { HttpException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import {
  FILTERED,
  NOOP_REPORTER,
  createErrorReporter,
  parseDsn,
  parseStack,
  scrubEvent,
  scrubString,
  scrubValue,
} from '@baia/shared';
import { ErrorReportingInterceptor, responseStatus } from '../src/observability/error-reporting.interceptor';
import { initErrorReporting } from '../src/observability/error-reporter';

const DSN = 'https://abc123@o1.ingest.sentry.io/4500';

describe('scrubbing', () => {
  it('removes emails, phones, bearer tokens and token query params from strings', () => {
    const out = scrubString(
      'failed for dana@example.com phone 050-123-4567 / +972 54 123 4567 Authorization: Bearer abcdef123456789 at /order-status?token=SECRETVALUE&x=1',
    );
    expect(out).not.toMatch(/dana@example\.com/);
    expect(out).not.toMatch(/123-4567|054|4567/);
    expect(out).not.toMatch(/abcdef123456789/);
    expect(out).not.toMatch(/SECRETVALUE/);
    expect(out).toContain('[email]');
    expect(out).toContain('[phone]');
  });

  it('keeps short numbers and ordinary text', () => {
    expect(scrubString('Order BAIA-1234 has 3 items, total 249.90')).toBe('Order BAIA-1234 has 3 items, total 249.90');
  });

  it('filters sensitive keys at any depth', () => {
    const out = scrubValue({
      ok: 'fine',
      email: 'a@b.co',
      shippingAddress: { street: 'Herzl 1', city: 'Haifa', zip: '123' },
      nested: { cookie: 'session=abc', phoneNumber: '0501234567', list: [{ authorization: 'x' }] },
    }) as Record<string, any>;
    expect(out.ok).toBe('fine');
    expect(out.email).toBe(FILTERED);
    expect(out.shippingAddress).toBe(FILTERED);
    expect(out.nested.cookie).toBe(FILTERED);
    expect(out.nested.phoneNumber).toBe(FILTERED);
    expect(out.nested.list[0].authorization).toBe(FILTERED);
  });

  it('scrubEvent drops request cookies/body/query/header values, user PII and server_name', () => {
    const event = scrubEvent({
      server_name: 'railway-abc',
      user: { id: 'u1', email: 'x@y.com', ip_address: '1.2.3.4' },
      request: {
        method: 'POST',
        url: 'https://baia.co.il/v1/orders?email=x@y.com&token=abc',
        headers: { cookie: 'baia.session_token=zzz', authorization: 'Bearer 123456789abc', 'user-agent': 'x' },
        cookies: { a: 'b' },
        data: { email: 'x@y.com', address: 'Herzl 1' },
        query_string: 'email=x@y.com',
      },
      exception: { values: [{ type: 'Error', value: 'cannot email dana@example.com', stacktrace: { frames: [{ filename: '/app/x.js?v=1', function: 'f', lineno: 1, colno: 2, vars: { secret: 'y' } }] } }] },
      extra: { customerEmail: 'a@b.co', note: 'ok' },
      breadcrumbs: [{ message: 'sent to a@b.co' }],
    });
    const json = JSON.stringify(event);
    expect(json).not.toMatch(/x@y\.com|a@b\.co|dana@example|zzz|123456789abc|Herzl|1\.2\.3\.4|railway-abc|"vars"/);
    expect(event.request.url).toBe('https://baia.co.il/v1/orders');
    expect(event.request.headers.cookie).toBe(FILTERED);
    expect(event.user).toEqual({ id: 'u1' });
    expect(event.exception.values[0].stacktrace.frames[0].filename).toBe('/app/x.js');
    expect(event.extra.note).toBe('ok');
  });
});

describe('parseDsn / parseStack', () => {
  it('parses a valid DSN into an envelope url', () => {
    expect(parseDsn(DSN)?.envelopeUrl).toBe('https://o1.ingest.sentry.io/api/4500/envelope/?sentry_key=abc123&sentry_version=7');
  });
  it.each([undefined, '', '   ', 'not a url', 'https://o1.ingest.sentry.io/4500', 'https://k@host/notanumber', 'ftp://k@host/1'])(
    'rejects %p',
    (value) => expect(parseDsn(value as string | undefined)).toBeNull(),
  );
  it('parses V8 stacks oldest-first', () => {
    const frames = parseStack('Error: x\n    at inner (/app/a.js:10:5)\n    at /app/b.js:20:7\n    at node:internal/main:1:1');
    expect(frames[0].filename).toBe('node:internal/main');
    expect(frames[frames.length - 1]).toMatchObject({ function: 'inner', filename: '/app/a.js', lineno: 10, colno: 5, in_app: true });
  });
});

describe('createErrorReporter', () => {
  it('is a strict no-op without a DSN (never calls fetch)', () => {
    const fetchImpl = jest.fn();
    const r = createErrorReporter({ dsn: undefined, platform: 'node', fetchImpl });
    expect(r).toBe(NOOP_REPORTER);
    r.captureException(new Error('boom'));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(createErrorReporter({ dsn: 'garbage', platform: 'node', fetchImpl }).enabled).toBe(false);
  });

  it('sends a scrubbed envelope, tagged with environment and release', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const r = createErrorReporter({ dsn: DSN, platform: 'node', environment: 'production', release: 'abc1234', fetchImpl });
    r.captureException(new Error('payment failed for dana@example.com'), { extra: { email: 'dana@example.com' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/api/4500/envelope/');
    const [header, item, payload] = (init.body as string).split('\n').map((l) => JSON.parse(l));
    expect(header.dsn).toBe(DSN);
    expect(item.type).toBe('event');
    expect(payload.environment).toBe('production');
    expect(payload.release).toBe('abc1234');
    expect(JSON.stringify(payload)).not.toMatch(/dana@example/);
  });

  it('never throws when fetch throws or rejects', async () => {
    const throwing = createErrorReporter({ dsn: DSN, platform: 'node', fetchImpl: () => { throw new Error('net'); } });
    expect(() => throwing.captureException(new Error('a'))).not.toThrow();
    const rejecting = createErrorReporter({ dsn: DSN, platform: 'node', fetchImpl: () => Promise.reject(new Error('net')) });
    expect(() => rejecting.captureException(new Error('b'))).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });

  it('drops identical errors within a minute and caps events per minute', () => {
    let t = 1_000_000;
    const fetchImpl = jest.fn().mockResolvedValue({});
    const r = createErrorReporter({ dsn: DSN, platform: 'node', fetchImpl, now: () => t, maxPerMinute: 3 });
    const same = new Error('same');
    r.captureException(same);
    r.captureException(same);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 5; i++) r.captureException(new Error(`distinct ${i}`));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    t += 61_000;
    r.captureException(new Error('distinct 9'));
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });
});

describe('initErrorReporting', () => {
  it('is disabled without SENTRY_DSN and enabled with a valid one (RAILWAY_GIT_COMMIT_SHA as release)', () => {
    expect(initErrorReporting({}).enabled).toBe(false);
    expect(initErrorReporting({ SENTRY_DSN: 'nope' }).enabled).toBe(false);
    const before = process.listenerCount('uncaughtExceptionMonitor');
    expect(initErrorReporting({ SENTRY_DSN: DSN, RAILWAY_GIT_COMMIT_SHA: 'deadbeef' }).enabled).toBe(true);
    process.removeAllListeners('uncaughtExceptionMonitor');
    void before;
    initErrorReporting({});
  });
});

describe('ErrorReportingInterceptor', () => {
  const ctx = (req: object = { method: 'GET', url: '/v1/x', headers: {} }) =>
    ({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) }) as any;

  it('classifies statuses', () => {
    expect(responseStatus(new NotFoundException())).toBe(404);
    expect(responseStatus(new InternalServerErrorException())).toBe(500);
    expect(responseStatus(new HttpException('x', 503))).toBe(503);
    expect(responseStatus(new Error('plain'))).toBe(500);
  });

  it('passes success values through untouched', async () => {
    const out = await lastValueFrom(new ErrorReportingInterceptor().intercept(ctx(), { handle: () => of(42) }));
    expect(out).toBe(42);
  });

  it('re-throws the very same error (responses unchanged), for 4xx and 5xx', async () => {
    const i = new ErrorReportingInterceptor();
    for (const err of [new NotFoundException('nope'), new Error('boom')]) {
      await expect(lastValueFrom(i.intercept(ctx(), { handle: () => throwError(() => err) }))).rejects.toBe(err);
    }
  });
});
