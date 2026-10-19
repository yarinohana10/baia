import type { EmailTemplate } from './index';
import { greeting, render } from './helpers';
import { telHref } from './layout';

/**
 * Customer-account, contact and marketing emails (welcome, contact form,
 * newsletter). Add the data shape here and the renderer to `customerTemplates`.
 *
 * Any marketing (advertising) template added here must start its subject with
 * "פרסומת" (חוק התקשורת, סעיף 30א) and include an unsubscribe link.
 */
export interface CustomerTemplateData {
  /** Sent once on email/password sign-up: a warm welcome that also carries the verify button. */
  'welcome-verify': { name?: string | null; url: string; expiresInHours: number; shopUrl: string };
  /** To the store inbox when a shopper submits the contact form (reply-to = shopper). */
  'contact-notification': {
    name: string;
    email: string;
    phone?: string | null;
    orderNumber?: string | null;
    subject?: string | null;
    message: string;
    locale: string;
    adminUrl: string;
  };
  /** Auto-reply to the shopper confirming we got their message. */
  'contact-auto-reply': { name: string; message: string; shopUrl: string };
}

/** Message text as paragraphs: one per non-empty line, capped so a huge message stays readable. */
function messageParagraphs(message: string): string[] {
  return message
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 60);
}

/** Header-safe single line (subjects must never contain CR/LF). */
export function oneLine(value: string, max = 120): string {
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

const welcomeVerify: EmailTemplate<CustomerTemplateData['welcome-verify']> = (data, locale, ctx) => {
  if (locale === 'he') {
    return render(
      {
        locale,
        preheader: 'נשאר רק לאמת את כתובת המייל - וזהו, החשבון שלך מוכן',
        heading: 'ברוכים הבאים ל-BAIA',
        paragraphs: [
          greeting(locale, data.name),
          'איזה כיף שהצטרפת! החשבון שלך נפתח, ואפשר כבר לשמור פריטים לרשימת המשאלות, לעקוב אחרי הזמנות ולהזמין מהר יותר.',
          'נשאר רק צעד קטן אחד: לאמת את כתובת המייל, כדי שאישורי הזמנה ועדכוני משלוח יגיעו אליך בלי תקלות.',
        ],
        cta: { label: 'אימות כתובת המייל', url: data.url },
        footnote: `הקישור בתוקף ל-${data.expiresInHours} שעות. אם לא נרשמת ל-BAIA, אפשר פשוט להתעלם מהמייל הזה.`,
      },
      'ברוכים הבאים ל-BAIA - נשאר רק לאמת את המייל',
      ctx,
    );
  }
  return render(
    {
      locale,
      preheader: "Just confirm your email address and you're all set",
      heading: 'Welcome to BAIA',
      paragraphs: [
        greeting(locale, data.name),
        "We're so happy you're here! Your account is ready: save favourites to your wishlist, track your orders and check out faster.",
        'One small step left: confirm your email address so order confirmations and shipping updates reach you.',
      ],
      cta: { label: 'Confirm my email', url: data.url },
      footnote: `This link is valid for ${data.expiresInHours} hours. If you didn't sign up for BAIA, you can ignore this email.`,
    },
    'Welcome to BAIA - just confirm your email',
    ctx,
  );
};

const contactNotification: EmailTemplate<CustomerTemplateData['contact-notification']> = (data, locale, ctx) => {
  const he = locale === 'he';
  const name = oneLine(data.name, 60);
  const subjectText = data.subject ? oneLine(data.subject, 80) : null;
  const details = [
    { label: he ? 'שם' : 'Name', value: data.name },
    { label: he ? 'אימייל' : 'Email', value: data.email, url: `mailto:${data.email}` },
    ...(data.phone ? [{ label: he ? 'טלפון' : 'Phone', value: data.phone, url: telHref(data.phone) }] : []),
    ...(data.orderNumber ? [{ label: he ? 'מספר הזמנה' : 'Order number', value: data.orderNumber }] : []),
    ...(subjectText ? [{ label: he ? 'נושא' : 'Subject', value: subjectText }] : []),
    { label: he ? 'שפת הפנייה' : 'Language', value: data.locale === 'en' ? 'English' : 'עברית' },
  ];
  const subject = he
    ? `פנייה חדשה מהאתר: ${name}${subjectText ? ` - ${subjectText}` : ''}`
    : `New contact message: ${name}${subjectText ? ` - ${subjectText}` : ''}`;
  return render(
    {
      locale,
      preheader: he ? `${name} השאיר/ה הודעה בטופס יצירת הקשר` : `${name} sent a message through the contact form`,
      heading: he ? 'פנייה חדשה מטופס יצירת הקשר' : 'New contact form message',
      paragraphs: [],
      blocks: [
        { type: 'details', rows: details },
        { type: 'quote', title: he ? 'ההודעה' : 'Message', lines: messageParagraphs(data.message) },
      ],
      cta: { label: he ? 'לתיבת הפניות בניהול' : 'Open the admin inbox', url: data.adminUrl },
      footnote: he
        ? 'אפשר להשיב ישירות למייל הזה - התשובה תישלח ללקוח/ה.'
        : 'Reply directly to this email to answer the customer.',
    },
    subject,
    ctx,
  );
};

const contactAutoReply: EmailTemplate<CustomerTemplateData['contact-auto-reply']> = (data, locale, ctx) => {
  if (locale === 'he') {
    return render(
      {
        locale,
        preheader: 'קיבלנו את פנייתך ונחזור אליך תוך יום עסקים',
        heading: 'קיבלנו את פנייתך',
        paragraphs: [
          greeting(locale, data.name),
          'תודה שכתבת לנו! ההודעה הגיעה אלינו, ונחזור אליך תוך יום עסקים אחד (ימים א׳-ה׳).',
        ],
        blocks: [{ type: 'quote', title: 'לנוחותך, זה מה ששלחת:', lines: messageParagraphs(data.message) }],
        cta: { label: 'חזרה לחנות', url: data.shopUrl },
        footnote: 'רוצה להוסיף משהו? אפשר פשוט להשיב למייל הזה.',
      },
      'קיבלנו את פנייתך - BAIA',
      ctx,
    );
  }
  return render(
    {
      locale,
      preheader: 'We got your message and will reply within one business day',
      heading: 'We got your message',
      paragraphs: [
        greeting(locale, data.name),
        'Thanks for reaching out! Your message reached us and we will get back to you within one business day (Sun-Thu).',
      ],
      blocks: [{ type: 'quote', title: "For your records, here's what you sent:", lines: messageParagraphs(data.message) }],
      cta: { label: 'Back to the shop', url: data.shopUrl },
      footnote: 'Want to add something? Just reply to this email.',
    },
    'We received your message - BAIA',
    ctx,
  );
};

export const customerTemplates: { [K in keyof CustomerTemplateData]: EmailTemplate<CustomerTemplateData[K]> } = {
  'welcome-verify': welcomeVerify,
  'contact-notification': contactNotification,
  'contact-auto-reply': contactAutoReply,
};
