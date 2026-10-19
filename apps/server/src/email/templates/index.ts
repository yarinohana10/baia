import type { EmailBranding, EmailLocale, RenderedEmail } from '../email.types';
import { defaultBranding } from '../email-store';
import { greeting, paymentLines, render, type PaymentInfo } from './helpers';
import type { Block, FooterReason, InfoBox, ItemRow, LayoutContext, Link } from './layout';
import { customerTemplates, type CustomerTemplateData } from './customer';
import { orderTemplates, type OrderTemplateData } from './orders';

/**
 * Data each template expects. To add a new email:
 *   1. add an entry here (or in customer.ts / orders.ts),
 *   2. add a renderer to `templates` and its footer reason to TEMPLATE_REASONS,
 *   3. call `emailService.dispatch('<name>', { to, locale, data })`.
 *
 * Templates are pure functions of (data, locale, ctx); `ctx` carries the
 * store details for the footer (EmailService loads them from SiteConfig).
 */
export interface EmailTemplateData extends CustomerTemplateData, OrderTemplateData {
  'verify-email': { name?: string | null; url: string; expiresInHours: number };
  'reset-password': { name?: string | null; url: string; expiresInMinutes: number };
  welcome: { name?: string | null; shopUrl: string };
  'order-confirmation': {
    name?: string | null;
    orderNumber: string;
    /** Formatted order (payment) date. */
    orderDate?: string | null;
    items: (ItemRow & { color: string; size: string })[];
    subtotal: string;
    shipping: string;
    discount: string | null;
    total: string;
    /** Courier: the shipping address. Pickup: the pickup point line. */
    address: string;
    /** Optional multi-line version of `address` (recipient, street, city...). */
    addressLines?: string[] | null;
    /** Pickup point opening hours. */
    pickupHours?: string | null;
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
    contactUrl?: string | null;
    payment?: PaymentInfo | null;
  };
}

export type EmailTemplateName = keyof EmailTemplateData;

export type EmailTemplate<D> = (data: D, locale: EmailLocale, ctx: LayoutContext) => RenderedEmail;

/**
 * Why the recipient got the email (footer line). 'internal' emails go to the
 * store inbox; every other template is customer-facing and gets the store's
 * contact address as Reply-To.
 */
export const TEMPLATE_REASONS: Record<EmailTemplateName, FooterReason> = {
  'verify-email': 'account',
  'reset-password': 'account',
  welcome: 'account',
  'welcome-verify': 'account',
  'order-confirmation': 'order',
  'order-shipped': 'order',
  'order-delivered': 'order',
  'order-cancelled': 'order',
  'cancellation-request-received': 'order',
  'cancellation-request-rejected': 'order',
  'contact-auto-reply': 'contact',
  'contact-notification': 'internal',
  'admin-new-order': 'internal',
  'admin-cancellation-request': 'internal',
  'admin-order-self-cancelled': 'internal',
};

export function isCustomerFacing(name: EmailTemplateName): boolean {
  return TEMPLATE_REASONS[name] !== 'internal';
}

const verifyEmail: EmailTemplate<EmailTemplateData['verify-email']> = (data, locale, ctx) => {
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
      ctx,
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
    ctx,
  );
};

const resetPassword: EmailTemplate<EmailTemplateData['reset-password']> = (data, locale, ctx) => {
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
      ctx,
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
    ctx,
  );
};

const welcome: EmailTemplate<EmailTemplateData['welcome']> = (data, locale, ctx) => {
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
      ctx,
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
    ctx,
  );
};

const orderConfirmation: EmailTemplate<EmailTemplateData['order-confirmation']> = (data, locale, ctx) => {
  const he = locale === 'he';
  const pickup = data.deliveryMethod === 'PICKUP_POINT';
  const hours = data.cancelWindowHours ?? 48;

  const totals = [
    { label: he ? 'סכום ביניים' : 'Subtotal', value: data.subtotal },
    { label: he ? 'משלוח' : 'Shipping', value: data.shipping },
    ...(data.discount ? [{ label: he ? 'הנחה' : 'Discount', value: `-${data.discount}` }] : []),
    { label: he ? 'סה״כ' : 'Total', value: data.total, strong: true },
  ];

  const eta = data.etaDays
    ? he
      ? `זמן הגעה משוער: ${data.etaDays} ימי עסקים מרגע המשלוח`
      : `Estimated delivery: ${data.etaDays} business days after dispatch`
    : null;
  const addressLines = data.addressLines?.length ? data.addressLines : [data.address];
  const deliveryBox: InfoBox = pickup
    ? {
        title: he ? 'איסוף מנקודת חלוקה' : 'Pickup point',
        lines: [
          ...addressLines,
          ...(data.pickupHours ? [`${he ? 'שעות פעילות' : 'Opening hours'}: ${data.pickupHours}`] : []),
          ...(eta ? [eta] : []),
        ],
      }
    : { title: he ? 'משלוח עד הבית' : 'Courier delivery', lines: [...addressLines, ...(eta ? [eta] : [])] };
  const payment = paymentLines(data.payment, locale);
  const boxes: InfoBox[] = [deliveryBox, ...(payment ? [{ title: he ? 'אמצעי תשלום' : 'Payment', lines: payment }] : [])];

  const blocks: Block[] = [
    {
      type: 'facts',
      items: [
        { label: he ? 'מספר הזמנה' : 'Order number', value: data.orderNumber },
        ...(data.orderDate ? [{ label: he ? 'תאריך' : 'Date', value: data.orderDate }] : []),
      ],
    },
    { type: 'items', title: he ? 'מה הזמנת' : 'Your items', items: data.items },
    { type: 'totals', rows: totals, note: he ? 'המחירים כוללים מע״מ' : 'Prices include VAT' },
    { type: 'info', boxes },
  ];
  if (data.cancelUrl) {
    blocks.push({
      type: 'callout',
      tone: 'info',
      lines: [
        he
          ? `התחרטת? אפשר לבטל ללא עלות תוך ${hours} שעות, כל עוד ההזמנה לא נשלחה.`
          : `Changed your mind? You can cancel free of charge within ${hours} hours, as long as the order hasn't shipped.`,
      ],
    });
  }

  const links: Link[] = [
    ...(data.trackUrl ? [{ label: he ? 'מעקב אחר ההזמנה' : 'Track your order', url: data.trackUrl }] : []),
    ...(data.cancelUrl ? [{ label: he ? 'ביטול הזמנה' : 'Cancel order', url: data.cancelUrl }] : []),
    ...(data.contactUrl ? [{ label: he ? 'יצירת קשר' : 'Contact us', url: data.contactUrl }] : []),
  ];

  return render(
    {
      locale,
      preheader: he
        ? `ההזמנה ${data.orderNumber} התקבלה, ואנחנו כבר מכינים אותה`
        : `We received order ${data.orderNumber} and are getting it ready`,
      heading: he ? 'תודה על ההזמנה!' : 'Thank you for your order!',
      paragraphs: [
        greeting(locale, data.name),
        he
          ? `ההזמנה שלך אושרה ואנחנו כבר מכינים אותה ${pickup ? 'למשלוח לנקודת האיסוף' : 'למשלוח'}. ריכזנו כאן את כל הפרטים.`
          : `Your order is confirmed and we're getting it ready to ship${pickup ? ' to your pickup point' : ''}. Here are all the details.`,
      ],
      blocks,
      cta: data.orderUrl ? { label: he ? 'צפייה בהזמנה' : 'View your order', url: data.orderUrl } : undefined,
      links,
      footnote: he
        ? 'שאלות על ההזמנה? אפשר פשוט להשיב למייל הזה ולציין את מספר ההזמנה.'
        : 'Questions about your order? Just reply to this email with your order number.',
    },
    he ? `אישור הזמנה ${data.orderNumber} - BAIA` : `Order ${data.orderNumber} confirmed - BAIA`,
    ctx,
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

/** Render a template. `branding` defaults to the built-in store details. */
export function renderTemplate<K extends EmailTemplateName>(
  name: K,
  data: EmailTemplateData[K],
  locale: EmailLocale,
  branding: EmailBranding = defaultBranding(),
): RenderedEmail {
  const template = templates[name] as EmailTemplate<EmailTemplateData[K]>;
  return template(data, locale, { branding, reason: TEMPLATE_REASONS[name] });
}
