import type { EmailLocale, RenderedEmail } from '../email.types';
import { renderLayout, renderText, type LayoutParts } from './layout';

/**
 * Data each template expects. To add a new email (e.g. order confirmation):
 *   1. add an entry here,
 *   2. add a renderer to `templates` below,
 *   3. call `emailService.sendTemplate('order-confirmation', { to, locale, data })`.
 */
export interface EmailTemplateData {
  'verify-email': { name?: string | null; url: string; expiresInHours: number };
  'reset-password': { name?: string | null; url: string; expiresInMinutes: number };
  welcome: { name?: string | null; shopUrl: string };
}

export type EmailTemplateName = keyof EmailTemplateData;

export type EmailTemplate<D> = (data: D, locale: EmailLocale) => RenderedEmail;

function render(parts: LayoutParts, subject: string): RenderedEmail {
  return { subject, html: renderLayout(parts), text: renderText(parts) };
}

function greeting(locale: EmailLocale, name?: string | null): string {
  const n = name?.trim();
  if (locale === 'he') return n ? `שלום ${n},` : 'שלום,';
  return n ? `Hi ${n},` : 'Hi,';
}

const verifyEmail: EmailTemplate<EmailTemplateData['verify-email']> = (data, locale) => {
  if (locale === 'he') {
    return render(
      {
        locale,
        preheader: 'אימות כתובת האימייל שלך ב-BAIA',
        heading: 'אימות כתובת האימייל',
        paragraphs: [
          greeting(locale, data.name),
          'תודה שנרשמת ל-BAIA. כדי לאשר שכתובת האימייל הזו שייכת לך, יש ללחוץ על הכפתור למטה.',
        ],
        cta: { label: 'אימות האימייל', url: data.url },
        footnote: `הקישור בתוקף ל-${data.expiresInHours} שעות. אם לא נרשמת לאתר, אפשר להתעלם מהודעה זו.`,
      },
      'אימות כתובת האימייל שלך ב-BAIA',
    );
  }
  return render(
    {
      locale,
      preheader: 'Confirm your email address for BAIA',
      heading: 'Confirm your email',
      paragraphs: [
        greeting(locale, data.name),
        'Thanks for joining BAIA. Please confirm that this email address belongs to you by clicking the button below.',
      ],
      cta: { label: 'Verify email', url: data.url },
      footnote: `This link is valid for ${data.expiresInHours} hours. If you didn't create an account, you can ignore this email.`,
    },
    'Confirm your email for BAIA',
  );
};

const resetPassword: EmailTemplate<EmailTemplateData['reset-password']> = (data, locale) => {
  if (locale === 'he') {
    return render(
      {
        locale,
        preheader: 'איפוס הסיסמה לחשבון BAIA שלך',
        heading: 'איפוס סיסמה',
        paragraphs: [
          greeting(locale, data.name),
          'קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך. ללחיצה על הכפתור ובחירת סיסמה חדשה:',
        ],
        cta: { label: 'בחירת סיסמה חדשה', url: data.url },
        footnote: `הקישור בתוקף ל-${data.expiresInMinutes} דקות וניתן לשימוש פעם אחת בלבד. אם לא ביקשת לאפס את הסיסמה, אפשר להתעלם מהודעה זו - הסיסמה שלך לא תשתנה.`,
      },
      'איפוס הסיסמה שלך ב-BAIA',
    );
  }
  return render(
    {
      locale,
      preheader: 'Reset the password for your BAIA account',
      heading: 'Reset your password',
      paragraphs: [
        greeting(locale, data.name),
        'We received a request to reset the password for your account. Click the button below to choose a new one.',
      ],
      cta: { label: 'Choose a new password', url: data.url },
      footnote: `This link is valid for ${data.expiresInMinutes} minutes and can be used once. If you didn't request a password reset, you can ignore this email - your password won't change.`,
    },
    'Reset your BAIA password',
  );
};

const welcome: EmailTemplate<EmailTemplateData['welcome']> = (data, locale) => {
  if (locale === 'he') {
    return render(
      {
        locale,
        preheader: 'ברוכים הבאים ל-BAIA',
        heading: 'ברוכים הבאים ל-BAIA',
        paragraphs: [
          greeting(locale, data.name),
          'שמחים שהצטרפת! מעכשיו אפשר לשמור פריטים לרשימת המשאלות, לעקוב אחר ההזמנות ולהזמין מהר יותר.',
          'הקולקציה החדשה כבר מחכה לך.',
        ],
        cta: { label: 'לקולקציה', url: data.shopUrl },
      },
      'ברוכים הבאים ל-BAIA',
    );
  }
  return render(
    {
      locale,
      preheader: 'Welcome to BAIA',
      heading: 'Welcome to BAIA',
      paragraphs: [
        greeting(locale, data.name),
        "We're happy you're here. You can now save favourites to your wishlist, track your orders and check out faster.",
        'The new collection is waiting for you.',
      ],
      cta: { label: 'Shop the collection', url: data.shopUrl },
    },
    'Welcome to BAIA',
  );
};

export const templates: { [K in EmailTemplateName]: EmailTemplate<EmailTemplateData[K]> } = {
  'verify-email': verifyEmail,
  'reset-password': resetPassword,
  welcome,
};

export function renderTemplate<K extends EmailTemplateName>(
  name: K,
  data: EmailTemplateData[K],
  locale: EmailLocale,
): RenderedEmail {
  const template = templates[name] as EmailTemplate<EmailTemplateData[K]>;
  return template(data, locale);
}
