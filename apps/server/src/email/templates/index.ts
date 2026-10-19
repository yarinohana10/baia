import type { EmailLocale, RenderedEmail } from '../email.types';
import { greeting, render } from './helpers';
import { customerTemplates, type CustomerTemplateData } from './customer';
import { orderTemplates, type OrderTemplateData } from './orders';

/**
 * Data each template expects. To add a new email (e.g. order confirmation):
 *   1. add an entry here,
 *   2. add a renderer to `templates` below,
 *   3. call `emailService.sendTemplate('order-confirmation', { to, locale, data })`.
 */
export interface EmailTemplateData extends CustomerTemplateData, OrderTemplateData {
  'verify-email': { name?: string | null; url: string; expiresInHours: number };
  'reset-password': { name?: string | null; url: string; expiresInMinutes: number };
  welcome: { name?: string | null; shopUrl: string };
  'order-confirmation': {
    orderNumber: string;
    items: { name: string; color: string; size: string; quantity: number; lineTotal: string }[];
    subtotal: string;
    shipping: string;
    discount: string | null;
    total: string;
    /** Courier: the shipping address. Pickup: the pickup point line. */
    address: string;
    /** Link to the order: the account page for members, a signed guest link otherwise. */
    orderUrl?: string | null;
    deliveryMethod?: 'COURIER' | 'PICKUP_POINT';
    /** Business days, e.g. "3-5". */
    etaDays?: string | null;
    /** Public order-status page (order number + email). */
    trackUrl?: string | null;
    /** Public cancellation page. */
    cancelUrl?: string | null;
    cancelWindowHours?: number | null;
  };
}

export type EmailTemplateName = keyof EmailTemplateData;

export type EmailTemplate<D> = (data: D, locale: EmailLocale) => RenderedEmail;

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

const orderConfirmation: EmailTemplate<EmailTemplateData['order-confirmation']> = (data, locale) => {
  const he = locale === 'he';
  const lines = data.items.map(
    (i) => `${i.quantity} × ${i.name} (${i.color} / ${i.size}) - ${i.lineTotal}`,
  );
  const totals = [
    `${he ? 'סכום ביניים' : 'Subtotal'}: ${data.subtotal}`,
    `${he ? 'משלוח' : 'Shipping'}: ${data.shipping}`,
    ...(data.discount ? [`${he ? 'הנחה' : 'Discount'}: -${data.discount}`] : []),
    `${he ? 'סה"כ לתשלום' : 'Total'}: ${data.total}`,
  ];
  const pickup = data.deliveryMethod === 'PICKUP_POINT';
  const subject = he ? `אישור הזמנה ${data.orderNumber} - BAIA` : `Order ${data.orderNumber} confirmed - BAIA`;
  return render(
    {
      locale,
      preheader: he ? `ההזמנה ${data.orderNumber} התקבלה` : `We received order ${data.orderNumber}`,
      heading: he ? 'תודה על ההזמנה!' : 'Thank you for your order!',
      paragraphs: [
        he ? `מספר ההזמנה שלך: ${data.orderNumber}` : `Your order number: ${data.orderNumber}`,
        he
          ? `ההזמנה אושרה ואנחנו כבר מכינים אותה ${pickup ? 'למשלוח לנקודת האיסוף' : 'למשלוח'}.`
          : `Your order is confirmed and we're getting it ready to ship${pickup ? ' to your pickup point' : ''}.`,
        ...lines,
        totals.join(' · '),
        pickup
          ? `${he ? 'איסוף מנקודת חלוקה' : 'Pickup point'}: ${data.address}`
          : `${he ? 'משלוח עד הבית אל' : 'Courier delivery to'}: ${data.address}`,
        ...(data.etaDays
          ? [he ? `זמן הגעה משוער: ${data.etaDays} ימי עסקים מרגע המשלוח.` : `Estimated delivery: ${data.etaDays} business days after dispatch.`]
          : []),
        ...(data.trackUrl
          ? [
              he
                ? `אפשר לעקוב אחר ההזמנה בכל עת עם מספר ההזמנה וכתובת האימייל: ${data.trackUrl}`
                : `Track your order any time with your order number and email: ${data.trackUrl}`,
            ]
          : []),
        ...(data.cancelUrl
          ? [
              he
                ? `ניתן לבטל ללא עלות תוך ${data.cancelWindowHours ?? 48} שעות כל עוד ההזמנה לא נשלחה: ${data.cancelUrl}`
                : `You can cancel free of charge within ${data.cancelWindowHours ?? 48} hours as long as the order hasn't shipped: ${data.cancelUrl}`,
            ]
          : []),
      ],
      cta: data.orderUrl ? { label: he ? 'צפייה בהזמנה' : 'View your order', url: data.orderUrl } : undefined,
      footnote: he
        ? 'שאלות על ההזמנה? אפשר להשיב למייל הזה ולציין את מספר ההזמנה.'
        : 'Questions about your order? Reply to this email with your order number.',
    },
    subject,
  );
};

export const templates: { [K in EmailTemplateName]: EmailTemplate<EmailTemplateData[K]> } = {
  'verify-email': verifyEmail,
  'reset-password': resetPassword,
  welcome,
  'order-confirmation': orderConfirmation,
  ...customerTemplates,
  ...orderTemplates,
};

export function renderTemplate<K extends EmailTemplateName>(
  name: K,
  data: EmailTemplateData[K],
  locale: EmailLocale,
): RenderedEmail {
  const template = templates[name] as EmailTemplate<EmailTemplateData[K]>;
  return template(data, locale);
}
