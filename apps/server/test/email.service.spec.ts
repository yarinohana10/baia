import { EmailService, createEmailTransportFromEnv, normalizeLocale } from '../src/email/email.service';
import { renderTemplate } from '../src/email/templates';
import { ConsoleEmailTransport, MemoryEmailTransport } from '../src/email/transports/console.transport';
import { SmtpEmailTransport } from '../src/email/transports/smtp.transport';

describe('EmailService', () => {
  it('renders Hebrew templates right-to-left and English left-to-right', () => {
    const he = renderTemplate('reset-password', { name: 'דנה', url: 'https://x/he/reset?token=t', expiresInMinutes: 60 }, 'he');
    expect(he.html).toContain('<html lang="he" dir="rtl">');
    expect(he.html).toContain('text-align:right');
    expect(he.html).toContain('שלום דנה,');
    expect(he.text).toContain('https://x/he/reset?token=t');

    const en = renderTemplate('welcome', { name: 'Dana', shopUrl: 'https://x/en' }, 'en');
    expect(en.html).toContain('<html lang="en" dir="ltr">');
    expect(en.subject).toBe('Welcome to BAIA');
  });

  it('escapes user-controlled values in HTML', () => {
    const r = renderTemplate('welcome', { name: '<script>alert(1)</script>', shopUrl: 'https://x' }, 'en');
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;');
  });

  it('renders the sign-up welcome with the verify button', () => {
    const he = renderTemplate(
      'welcome-verify',
      { name: 'דנה', url: 'https://x/he/verify-email?token=t', expiresInHours: 24, shopUrl: 'https://x/he' },
      'he',
    );
    expect(he.subject).toBe('ברוכים הבאים ל-BAIA - נשאר רק לאמת את המייל');
    expect(he.html).toContain('https://x/he/verify-email?token=t');
    expect(he.html).toContain('dir="rtl"');
  });

  it('renders contact emails with escaped, single-line subjects', () => {
    const r = renderTemplate(
      'contact-notification',
      {
        name: 'Dana\r\nBcc: evil@x',
        email: 'dana@example.com',
        subject: '<b>Size</b>\nquestion',
        message: 'line one\n<script>x</script>',
        locale: 'en',
        adminUrl: 'https://x/he/admin/messages',
      },
      'he',
    );
    expect(r.subject).not.toMatch(/[\r\n]/);
    expect(r.subject.startsWith('פנייה חדשה מהאתר')).toBe(true);
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('line one');

    const reply = renderTemplate('contact-auto-reply', { name: 'Dana', message: 'hi', shopUrl: 'https://x/en' }, 'en');
    expect(reply.subject).toBe('We received your message - BAIA');
    expect(renderTemplate('contact-auto-reply', { name: 'דנה', message: 'hi', shopUrl: 'https://x' }, 'he').subject).toBe(
      'קיבלנו את פנייתך - BAIA',
    );
  });

  it('sends templated mail through the transport with the default from address', async () => {
    const transport = new MemoryEmailTransport();
    const service = new EmailService(transport, 'BAIA <no-reply@test>');
    await service.sendTemplate('verify-email', {
      to: 'a@b.co',
      locale: 'fr',
      data: { url: 'https://x/v', expiresInHours: 24 },
    });
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({ to: 'a@b.co', from: 'BAIA <no-reply@test>' });
    // Unknown locale falls back to Hebrew.
    expect(transport.sent[0].html).toContain('dir="rtl"');
  });

  it('dispatch never throws when the transport fails', async () => {
    const service = new EmailService({ name: 'broken', send: jest.fn().mockRejectedValue(new Error('down')) }, 'x@y');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      service.dispatch('welcome', { to: 'a@b.co', data: { shopUrl: 'https://x' } }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('failed to send "welcome"'));
    spy.mockRestore();
  });

  it('chooses the transport from env', () => {
    expect(createEmailTransportFromEnv({} as NodeJS.ProcessEnv)).toBeInstanceOf(ConsoleEmailTransport);
    expect(createEmailTransportFromEnv({ SMTP_HOST: 'localhost', SMTP_PORT: '1025' } as NodeJS.ProcessEnv)).toBeInstanceOf(
      SmtpEmailTransport,
    );
    expect(() => createEmailTransportFromEnv({ EMAIL_PROVIDER: 'smtp' } as NodeJS.ProcessEnv)).toThrow(/SMTP_HOST/);
    expect(() => createEmailTransportFromEnv({ EMAIL_PROVIDER: 'pigeon' } as NodeJS.ProcessEnv)).toThrow(/Unknown/);
  });

  it('normalizes locales', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale(undefined)).toBe('he');
  });
});
