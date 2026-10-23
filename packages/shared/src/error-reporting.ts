/**
 * Dependency-free Sentry reporter, shared by the API (Node) and the storefront
 * (browser + Next server). It speaks Sentry's public "envelope" HTTP protocol
 * directly, so there is no SDK to bundle (the browser cost is a few KB) and no
 * source-map upload step.
 *
 * Guarantees:
 * - With no DSN (or an unparseable one) `createErrorReporter` returns a strict
 *   no-op: nothing is sent, nothing is patched, nothing can throw.
 * - Every event goes through `scrubEvent` first: emails, phone numbers,
 *   addresses, names, cookies, auth headers, tokens and URL query strings are
 *   removed (a swimwear shop's errors can easily carry customer data).
 * - Reporting never throws and never blocks the caller (fire-and-forget fetch
 *   with a short timeout), and is rate limited so an error loop cannot flood
 *   the free tier.
 */

export const FILTERED = '[Filtered]';

/** Object keys whose values are always replaced (case-insensitive substring match). */
const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|authorization|cookie|api[-_]?key|session|credential|email|e-mail|phone|mobile|tel$|whatsapp|address|street|city|zip|postal|apartment|first[-_]?name|last[-_]?name|full[-_]?name|recipient|card|cvv|iban|national[-_]?id|id[-_]?number|^name$/i;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Israeli and international phone numbers: +972 5x..., 05x-xxxxxxx, 0x-xxxxxxx, with separators.
const PHONE_RE = /(?<![\w.])(?:\+|00)?\d[\d\s().-]{7,}\d(?![\w.])/g;
const BEARER_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
// Long opaque tokens (order access links, reset/verify tokens): 24+ url-safe chars containing a digit.
const LONG_TOKEN_RE = /\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{32,}\b/g;
const TOKEN_PARAM_RE = /([?&](?:token|t|key|code|secret|email|access_token)=)[^&#\s]*/gi;

/** Scrub PII patterns inside a free-text string. */
export function scrubString(value: string): string {
  return value
    .replace(EMAIL_RE, '[email]')
    .replace(BEARER_RE, '$1 [token]')
    .replace(TOKEN_PARAM_RE, `$1${FILTERED}`)
    .replace(PHONE_RE, (m) => (m.replace(/\D/g, '').length >= 9 ? '[phone]' : m))
    .replace(LONG_TOKEN_RE, '[token]');
}

/** Drop the query string and fragment of a URL (they can carry tokens and emails). */
export function stripUrlQuery(url: string): string {
  return url.replace(/[?#].*$/, '');
}

const MAX_DEPTH = 8;

/** Deep copy with sensitive keys filtered and PII patterns removed from strings. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return FILTERED;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? FILTERED : scrubValue(v, depth + 1);
  }
  return out;
}

export type SentryEvent = Record<string, any>;

/**
 * Pure `beforeSend`: returns a scrubbed copy of the event. Request headers,
 * cookies, bodies and query strings are removed outright; the user is reduced
 * to an opaque id; exception messages and breadcrumbs have PII patterns
 * stripped. Stack frames keep file names and line numbers only.
 */
export function scrubEvent(event: SentryEvent): SentryEvent {
  const copy: SentryEvent = { ...event };

  if (copy.request) {
    const req = copy.request as SentryEvent;
    copy.request = {
      method: req.method,
      url: typeof req.url === 'string' ? stripUrlQuery(scrubString(req.url)) : undefined,
      // Header names only; values (cookie, authorization, user-agent IPs...) are dropped.
      headers: req.headers && typeof req.headers === 'object' ? Object.fromEntries(Object.keys(req.headers).map((k) => [k, FILTERED])) : undefined,
    };
  }

  if (copy.user) {
    const id = (copy.user as SentryEvent).id;
    copy.user = id ? { id: String(id) } : undefined;
  }
  delete copy.server_name; // hostnames of containers: noise, not needed

  if (copy.exception?.values) {
    copy.exception = {
      ...copy.exception,
      values: (copy.exception.values as SentryEvent[]).map((v) => ({
        ...v,
        value: typeof v.value === 'string' ? scrubString(v.value) : v.value,
        stacktrace: v.stacktrace
          ? {
              ...v.stacktrace,
              frames: (v.stacktrace.frames as SentryEvent[] | undefined)?.map((f) => ({
                filename: typeof f.filename === 'string' ? stripUrlQuery(f.filename) : f.filename,
                function: f.function,
                lineno: f.lineno,
                colno: f.colno,
                in_app: f.in_app,
              })),
            }
          : undefined,
      })),
    };
  }

  if (typeof copy.message === 'string') copy.message = scrubString(copy.message);
  if (copy.breadcrumbs) copy.breadcrumbs = scrubValue(copy.breadcrumbs);
  if (copy.extra) copy.extra = scrubValue(copy.extra) as SentryEvent;
  if (copy.contexts) copy.contexts = scrubValue(copy.contexts) as SentryEvent;
  if (copy.tags) copy.tags = scrubValue(copy.tags) as SentryEvent;
  if (typeof copy.transaction === 'string') copy.transaction = stripUrlQuery(scrubString(copy.transaction));
  return copy;
}

// ── DSN / envelope ──────────────────────────────────────────────────────────

export interface ParsedDsn {
  publicKey: string;
  host: string;
  protocol: string;
  projectId: string;
  /** Envelope endpoint, already carrying the auth query parameters. */
  envelopeUrl: string;
}

/** Parses `https://<key>@<host>/<projectId>`; returns null for anything else. */
export function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn || !dsn.trim()) return null;
  try {
    const url = new URL(dsn.trim());
    if (!['http:', 'https:'].includes(url.protocol) || !url.username) return null;
    const segments = url.pathname.split('/').filter(Boolean);
    const projectId = segments.pop();
    if (!projectId || !/^\d+$/.test(projectId)) return null;
    const prefix = segments.length ? `/${segments.join('/')}` : '';
    return {
      publicKey: url.username,
      host: url.host,
      protocol: url.protocol,
      projectId,
      envelopeUrl: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/?sentry_key=${encodeURIComponent(url.username)}&sentry_version=7`,
    };
  } catch {
    return null;
  }
}

interface Frame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
}

/** Parses V8 ("at fn (file:1:2)") and Firefox/Safari ("fn@file:1:2") stack traces. Sentry wants oldest-first. */
export function parseStack(stack: string | undefined): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const line of stack.split('\n')) {
    const v8 = line.match(/^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?\s*$/);
    const gecko = !v8 ? line.match(/^(.*?)@(.+?):(\d+):(\d+)\s*$/) : null;
    const m = v8 ?? gecko;
    if (!m) continue;
    const filename = m[2];
    frames.push({
      function: m[1] || '<anonymous>',
      filename,
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !/node_modules|node:internal/.test(filename),
    });
  }
  return frames.reverse();
}

function randomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// ── Reporter ────────────────────────────────────────────────────────────────

export interface ErrorReporterOptions {
  dsn?: string;
  /** 'node' for the API / Next server, 'javascript' for the browser. */
  platform: 'node' | 'javascript';
  environment?: string;
  release?: string;
  /** Extra static tags (e.g. `{ app: 'server' }`). */
  tags?: Record<string, string>;
  /** Max events per minute (default 20). */
  maxPerMinute?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests. */
  now?: () => number;
}

export interface CaptureContext {
  /** Extra data (scrubbed). */
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
  /** Request metadata; the query string, cookies, headers' values and body are dropped. */
  request?: { method?: string; url?: string; headers?: Record<string, unknown> };
  /** Opaque user id only. */
  userId?: string;
  level?: 'error' | 'fatal' | 'warning' | 'info';
}

export interface ErrorReporter {
  readonly enabled: boolean;
  captureException(error: unknown, context?: CaptureContext): void;
  captureMessage(message: string, context?: CaptureContext): void;
}

export const NOOP_REPORTER: ErrorReporter = Object.freeze({
  enabled: false,
  captureException() {},
  captureMessage() {},
});

export function createErrorReporter(options: ErrorReporterOptions): ErrorReporter {
  const dsn = parseDsn(options.dsn);
  if (!dsn) return NOOP_REPORTER;

  const doFetch = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!doFetch) return NOOP_REPORTER;
  const now = options.now ?? Date.now;
  const maxPerMinute = options.maxPerMinute ?? 20;
  let windowStart = now();
  let sentInWindow = 0;
  const recent = new Map<string, number>(); // fingerprint -> last sent (ms): drop repeats within 60s

  const allow = (fingerprint: string): boolean => {
    const t = now();
    if (t - windowStart >= 60_000) {
      windowStart = t;
      sentInWindow = 0;
    }
    const last = recent.get(fingerprint);
    if (last !== undefined && t - last < 60_000) return false;
    if (sentInWindow >= maxPerMinute) return false;
    sentInWindow += 1;
    recent.set(fingerprint, t);
    if (recent.size > 200) recent.delete(recent.keys().next().value as string);
    return true;
  };

  const send = (event: SentryEvent, fingerprint: string) => {
    try {
      if (!allow(fingerprint)) return;
      const scrubbed = scrubEvent(event);
      const eventId = randomId();
      const body =
        JSON.stringify({ event_id: eventId, sent_at: new Date(now()).toISOString(), dsn: options.dsn }) +
        '\n' +
        JSON.stringify({ type: 'event' }) +
        '\n' +
        JSON.stringify({ ...scrubbed, event_id: eventId });
      const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
      const timer = controller ? setTimeout(() => controller.abort(), 3000) : undefined;
      (timer as { unref?: () => void } | undefined)?.unref?.();
      void Promise.resolve(
        doFetch(dsn.envelopeUrl, {
          method: 'POST',
          // text/plain keeps this a "simple" CORS request from browsers (no preflight).
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body,
          keepalive: true,
          signal: controller?.signal,
        }),
      )
        .catch(() => undefined)
        .finally(() => timer && clearTimeout(timer));
    } catch {
      // Reporting must never break the app.
    }
  };

  const base = (context?: CaptureContext): SentryEvent => ({
    platform: options.platform,
    level: context?.level ?? 'error',
    timestamp: now() / 1000,
    environment: options.environment,
    release: options.release,
    tags: { ...options.tags, ...context?.tags },
    extra: context?.extra,
    request: context?.request,
    user: context?.userId ? { id: context.userId } : undefined,
    sdk: { name: 'baia.minimal', version: '1.0.0' },
  });

  return {
    enabled: true,
    captureException(error, context) {
      try {
        const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Non-error thrown');
        const frames = parseStack(err.stack);
        const top = frames[frames.length - 1];
        send(
          {
            ...base(context),
            exception: {
              values: [
                {
                  type: err.name || 'Error',
                  value: err.message,
                  stacktrace: frames.length ? { frames } : undefined,
                },
              ],
            },
          },
          `${err.name}|${err.message}|${top?.filename}:${top?.lineno}`,
        );
      } catch {
        // never throw
      }
    },
    captureMessage(message, context) {
      send({ ...base({ level: 'info', ...context }), message }, `msg|${message}`);
    },
  };
}
