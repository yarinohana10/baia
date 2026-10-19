import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuth, isSignUpRequest, resolveAuthSecret, resolveRequestLocale } from '../src/auth/auth.config';
import { EmailService } from '../src/email/email.service';
import { MemoryEmailTransport } from '../src/email/transports/console.transport';

const TEST_ENV = {
  NODE_ENV: 'test',
  BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-1234',
  BETTER_AUTH_URL: 'http://localhost:8000',
  CLIENT_URL: 'http://localhost:3000',
  AUTH_RATE_LIMIT: 'false',
} as NodeJS.ProcessEnv;

/** Emails are dispatched fire-and-forget; let pending promises settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

function tokenFrom(html: string, path: string): string {
  const match = html.match(new RegExp(`${path}\\?token=([^"&<\\s]+)`));
  if (!match) throw new Error(`no ${path} link in email`);
  return decodeURIComponent(match[1]);
}

function setup() {
  const db = { user: [], session: [], account: [], verification: [] } as Record<string, any[]>;
  const transport = new MemoryEmailTransport();
  const email = new EmailService(transport, 'BAIA <no-reply@test.local>');
  const auth = createAuth({ database: memoryAdapter(db), email, env: TEST_ENV });
  return { auth, db, transport };
}

/** Goes through the HTTP handler, like the web client, so hooks receive the real Request. */
async function signUp(auth: ReturnType<typeof setup>['auth'], emailAddr = 'dana@example.com') {
  const res = await auth.handler(
    new Request('http://localhost:8000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-locale': 'en' },
      body: JSON.stringify({ email: emailAddr, password: 'original-pass-1', name: 'Dana' }),
    }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as { user: { email: string; emailVerified: boolean } };
}

describe('auth flows (better-auth + email)', () => {
  describe('email verification', () => {
    it('sends one welcome email with the verify button on sign-up but does not block sign-in', async () => {
      const { auth, transport } = setup();
      const res = await signUp(auth);
      await flush();

      expect(res.user.emailVerified).toBe(false);
      expect(transport.sent).toHaveLength(1);
      expect(transport.sent[0].to).toBe('dana@example.com');
      expect(transport.sent[0].subject).toBe('Welcome to BAIA - just confirm your email');
      expect(transport.sent[0].html).toContain('http://localhost:3000/en/verify-email?token=');
      expect(transport.sent[0].html).toContain('http://localhost:3000/en');

      // Unverified users can still log in (registration must not add friction).
      const signIn = await auth.api.signInEmail({ body: { email: 'dana@example.com', password: 'original-pass-1' } });
      expect(signIn.user.email).toBe('dana@example.com');
    });

    it('verifies the email with the token without sending a second welcome', async () => {
      const { auth, db, transport } = setup();
      await signUp(auth);
      await flush();
      const token = tokenFrom(transport.sent[0].html, '/verify-email');
      transport.clear();

      await auth.api.verifyEmail({ query: { token }, headers: new Headers({ 'x-locale': 'he' }) });
      await flush();

      expect(db.user[0].emailVerified).toBe(true);
      expect(transport.sent).toHaveLength(0);
    });

    it('sends the Hebrew welcome+verify email by default', async () => {
      const { auth, transport } = setup();
      const res = await auth.handler(
        new Request('http://localhost:8000/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
          body: JSON.stringify({ email: 'noa@example.com', password: 'original-pass-1', name: 'נועה' }),
        }),
      );
      expect(res.status).toBe(200);
      await flush();
      expect(transport.sent).toHaveLength(1);
      expect(transport.sent[0].subject).toBe('ברוכים הבאים ל-BAIA - נשאר רק לאמת את המייל');
      expect(transport.sent[0].html).toContain('dir="rtl"');
      expect(transport.sent[0].html).toContain('/he/verify-email?token=');
    });

    it('rejects an invalid verification token', async () => {
      const { auth, db } = setup();
      await signUp(auth);
      await expect(auth.api.verifyEmail({ query: { token: 'not-a-token' } })).rejects.toThrow();
      expect(db.user[0].emailVerified).toBe(false);
    });

    it('resends a plain verification email (not another welcome)', async () => {
      const { auth, transport } = setup();
      await signUp(auth);
      await flush();
      transport.clear();

      await auth.api.sendVerificationEmail({ body: { email: 'dana@example.com' } });
      await flush();
      expect(transport.sent).toHaveLength(1);
      expect(transport.sent[0].subject).toBe('אימות כתובת האימייל שלך ב-BAIA');
      expect(transport.sent[0].html).toContain('/verify-email?token=');
    });
  });

  describe('password reset', () => {
    it('issues a token, emails a client reset link and changes the password', async () => {
      const { auth, db, transport } = setup();
      await signUp(auth);
      await flush();
      transport.clear();

      const res = await auth.api.requestPasswordReset({
        body: { email: 'dana@example.com', redirectTo: 'http://localhost:3000/he/reset-password' },
      });
      await flush();

      expect(res.status).toBe(true);
      expect(db.verification.some((v) => String(v.identifier).startsWith('reset-password:'))).toBe(true);
      expect(transport.sent).toHaveLength(1);
      expect(transport.sent[0].subject).toBe('איפוס הסיסמה שלך ב-BAIA');
      const token = tokenFrom(transport.sent[0].html, '/he/reset-password');

      await auth.api.resetPassword({ body: { token, newPassword: 'brand-new-pass-2' } });

      await expect(
        auth.api.signInEmail({ body: { email: 'dana@example.com', password: 'original-pass-1' } }),
      ).rejects.toThrow();
      const signIn = await auth.api.signInEmail({ body: { email: 'dana@example.com', password: 'brand-new-pass-2' } });
      expect(signIn.user.email).toBe('dana@example.com');

      // Token is single-use.
      await expect(auth.api.resetPassword({ body: { token, newPassword: 'another-pass-3' } })).rejects.toThrow();
    });

    it('does not reveal whether the email exists', async () => {
      const { auth, transport } = setup();
      await signUp(auth);
      await flush();
      transport.clear();

      const existing = await auth.api.requestPasswordReset({ body: { email: 'dana@example.com' } });
      const missing = await auth.api.requestPasswordReset({ body: { email: 'nobody@example.com' } });
      await flush();

      expect(missing).toEqual(existing);
      expect(transport.sent.map((m) => m.to)).toEqual(['dana@example.com']);
    });

    it('rejects expired reset tokens', async () => {
      const { auth, db, transport } = setup();
      await signUp(auth);
      await auth.api.requestPasswordReset({ body: { email: 'dana@example.com' } });
      await flush();
      const token = tokenFrom(transport.sent[transport.sent.length - 1].html, '/reset-password');

      for (const v of db.verification) v.expiresAt = new Date(Date.now() - 1000);

      await expect(auth.api.resetPassword({ body: { token, newPassword: 'brand-new-pass-2' } })).rejects.toThrow();
    });
  });

  describe('config hardening', () => {
    it('requires a strong BETTER_AUTH_SECRET in production', () => {
      expect(() => resolveAuthSecret({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/must be set/);
      expect(() =>
        resolveAuthSecret({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'baia-dev-secret' } as NodeJS.ProcessEnv),
      ).toThrow(/placeholder/);
      const strong = 'x'.repeat(40);
      expect(resolveAuthSecret({ NODE_ENV: 'production', BETTER_AUTH_SECRET: strong } as NodeJS.ProcessEnv)).toBe(strong);
    });

    it('falls back to a dev secret outside production', () => {
      expect(resolveAuthSecret({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBeTruthy();
    });

    it('picks the email locale from header, callback URL or referer', () => {
      const req = (h: Record<string, string>) => new Request('http://x', { headers: h });
      expect(resolveRequestLocale(req({ 'x-locale': 'en' }))).toBe('en');
      expect(resolveRequestLocale(null, 'http://api/verify?token=a&callbackURL=%2Fen%2Faccount')).toBe('en');
      expect(resolveRequestLocale(req({ referer: 'http://shop/en/login' }))).toBe('en');
      expect(resolveRequestLocale(req({}))).toBe('he');
    });

    it('recognises the email sign-up request', () => {
      expect(isSignUpRequest(new Request('http://api/api/auth/sign-up/email', { method: 'POST' }))).toBe(true);
      expect(isSignUpRequest(new Request('http://api/api/auth/send-verification-email', { method: 'POST' }))).toBe(false);
      expect(isSignUpRequest(undefined)).toBe(false);
    });
  });
});
