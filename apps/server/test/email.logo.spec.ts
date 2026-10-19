import { mergeBranding } from '../src/email/email-store';
import { renderTemplate } from '../src/email/templates';

describe('email logo', () => {
  const branding = mergeBranding(null, { CLIENT_URL: 'https://shop.test' } as NodeJS.ProcessEnv);

  afterEach(() => {
    delete process.env.EMAIL_LOGO_URL;
  });

  it('shows the hosted PNG logo with alt text in every email', () => {
    const { html, text } = renderTemplate('reset-password', { url: 'https://shop.test/r', expiresInMinutes: 60 }, 'he', branding);
    expect(html).toContain('<img src="https://shop.test/email/baia-logo.png"');
    expect(html).toContain('alt="BAIA SWIMWEAR"');
    expect(text).not.toContain('baia-logo.png');
  });

  it('lets EMAIL_LOGO_URL point at a CDN copy', () => {
    process.env.EMAIL_LOGO_URL = 'https://cdn.test/logo.png';
    const { html } = renderTemplate('reset-password', { url: 'https://shop.test/r', expiresInMinutes: 60 }, 'en', branding);
    expect(html).toContain('<img src="https://cdn.test/logo.png"');
  });
});
