import type { EmailTemplate } from './index';
import { greeting, render } from './helpers';
import { telHref, type Block, type InfoBox, type Link } from './layout';

/**
 * Order lifecycle emails (shipped, delivered, cancelled, cancellation
 * requests) and the store-inbox alerts. Customer emails are bilingual and use
 * Order.locale; admin alerts are always Hebrew. Money values arrive already
 * formatted (see orders/order-mailer.ts).
 */

type PickupPointInfo = { name: string; address: string; city: string; hours?: string | null };

export interface OrderTemplateData {
  'order-shipped': {
    name?: string | null;
    orderNumber: string;
    deliveryMethod: 'COURIER' | 'PICKUP_POINT';
    pickupPoint?: PickupPointInfo | null;
    address?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    etaDays?: string | null;
    orderUrl?: string | null;
    /** Carrier display name, e.g. "חברת השליחויות" (TRACKING_CARRIER_NAME). */
    carrierName?: string | null;
    contactUrl?: string | null;
  };
  'order-delivered': {
    name?: string | null;
    orderNumber: string;
    orderUrl?: string | null;
    returnsUrl: string;
    contactUrl?: string | null;
  };
  'order-cancelled': {
    name?: string | null;
    orderNumber: string;
    /** Whether money had been taken (controls the refund paragraph). */
    paid: boolean;
    refundAmount?: string | null;
    feeAmount?: string | null;
    /** True when the provider refund failed and the store will handle it by hand. */
    refundPending?: boolean;
    note?: string | null;
    shopUrl: string;
    /** Formatted order total (for the refund breakdown). */
    orderTotal?: string | null;
    contactUrl?: string | null;
  };
  'cancellation-request-received': {
    name?: string | null;
    orderNumber: string;
    requiresReturn: boolean;
    orderUrl?: string | null;
    contactUrl?: string | null;
  };
  'cancellation-request-rejected': {
    name?: string | null;
    orderNumber: string;
    note?: string | null;
    contactUrl: string;
  };
  'admin-new-order': {
    orderNumber: string;
    customer: string;
    email: string;
    phone?: string | null;
    total: string;
    itemCount: number;
    delivery: string;
    marketingConsent: boolean;
    adminUrl: string;
  };
  'admin-cancellation-request': {
    orderNumber: string;
    customer: string;
    email: string;
    phone?: string | null;
    total: string;
    reason: string;
    details?: string | null;
    insideWindow: boolean;
    requiresReturn: boolean;
    adminUrl: string;
  };
  'admin-order-self-cancelled': {
    orderNumber: string;
    customer: string;
    email: string;
    total: string;
    refundAmount?: string | null;
    refundFailed: boolean;
    reason: string;
    details?: string | null;
    adminUrl: string;
  };
}

const pickupLine = (p: PickupPointInfo) => `${p.name} - ${p.address}, ${p.city}`;

const contactLink = (url: string | null | undefined, he: boolean): Link[] =>
  url ? [{ label: he ? 'יצירת קשר' : 'Contact us', url }] : [];

const orderFact = (orderNumber: string, he: boolean) => ({ label: he ? 'מספר הזמנה' : 'Order number', value: orderNumber });

const orderShipped: EmailTemplate<OrderTemplateData['order-shipped']> = (data, locale, ctx) => {
  const he = locale === 'he';
  const pickup = data.deliveryMethod === 'PICKUP_POINT';
  const eta = data.etaDays
    ? he
      ? `זמן הגעה משוער: ${data.etaDays} ימי עסקים`
      : `Estimated delivery: ${data.etaDays} business days`
    : null;

  const boxes: InfoBox[] = [];
  if (pickup) {
    boxes.push({
      title: he ? 'נקודת האיסוף' : 'Pickup point',
      lines: [
        ...(data.pickupPoint ? [pickupLine(data.pickupPoint)] : []),
        ...(data.pickupPoint?.hours ? [`${he ? 'שעות פעילות' : 'Opening hours'}: ${data.pickupPoint.hours}`] : []),
        ...(eta ? [eta] : []),
      ],
    });
  } else {
    boxes.push({
      title: he ? 'כתובת למשלוח' : 'Shipping to',
      lines: [...(data.address ? [data.address] : []), ...(eta ? [eta] : [])],
    });
  }
  if (data.trackingNumber) {
    boxes.push({
      title: he ? 'מעקב משלוח' : 'Tracking',
      lines: [
        `${he ? 'מספר מעקב' : 'Tracking number'}: ${data.trackingNumber}`,
        ...(data.carrierName ? [`${he ? 'חברת שילוח' : 'Carrier'}: ${data.carrierName}`] : []),
      ],
      link: data.trackingUrl
        ? { label: he ? 'מעקב באתר חברת השילוח' : "Track on the carrier's site", url: data.trackingUrl }
        : null,
    });
  }
  const visibleBoxes = boxes.filter((b) => b.lines.length);

  const trackCta = data.trackingNumber && data.trackingUrl;
  const cta = trackCta
    ? { label: he ? 'מעקב אחר המשלוח' : 'Track your parcel', url: data.trackingUrl! }
    : data.orderUrl
      ? { label: he ? 'צפייה בהזמנה' : 'View your order', url: data.orderUrl }
      : undefined;
  const links: Link[] = [
    ...(trackCta && data.orderUrl ? [{ label: he ? 'צפייה בהזמנה' : 'View your order', url: data.orderUrl }] : []),
    ...contactLink(data.contactUrl, he),
  ];

  return render(
    {
      locale,
      preheader: he ? `ההזמנה ${data.orderNumber} נשלחה` : `Order ${data.orderNumber} has shipped`,
      heading: he ? 'ההזמנה שלך בדרך' : 'Your order is on its way',
      paragraphs: [
        greeting(locale, data.name),
        pickup
          ? he
            ? `ההזמנה ${data.orderNumber} יצאה לדרך! החבילה בדרך לנקודת האיסוף, ונעדכן אותך כשאפשר יהיה לאסוף אותה.`
            : `Order ${data.orderNumber} is on its way! The parcel is heading to your pickup point - we'll let you know when it's ready to collect.`
          : he
            ? `ההזמנה ${data.orderNumber} יצאה לדרך! השליח ייצור איתך קשר לפני המסירה.`
            : `Order ${data.orderNumber} is on its way! The courier will contact you before delivery.`,
      ],
      blocks: [{ type: 'facts', items: [orderFact(data.orderNumber, he)] }, ...(visibleBoxes.length ? [{ type: 'info', boxes: visibleBoxes } as Block] : [])],
      cta,
      links,
      footnote: he
        ? 'שאלות על המשלוח? אפשר להשיב למייל הזה ולציין את מספר ההזמנה.'
        : 'Questions about your delivery? Reply to this email with your order number.',
    },
    he ? `ההזמנה ${data.orderNumber} נשלחה - BAIA` : `Order ${data.orderNumber} has shipped - BAIA`,
    ctx,
  );
};

const orderDelivered: EmailTemplate<OrderTemplateData['order-delivered']> = (data, locale, ctx) => {
  const he = locale === 'he';
  return render(
    {
      locale,
      preheader: he ? `ההזמנה ${data.orderNumber} נמסרה` : `Order ${data.orderNumber} was delivered`,
      heading: he ? 'ההזמנה נמסרה' : 'Your order was delivered',
      paragraphs: [
        greeting(locale, data.name),
        he
          ? `ההזמנה ${data.orderNumber} נמסרה. מקווים שתיהנו מהפריטים החדשים!`
          : `Order ${data.orderNumber} was delivered. We hope you love your new pieces!`,
      ],
      blocks: [
        {
          type: 'callout',
          tone: 'info',
          title: he ? 'משהו לא מתאים?' : "Something doesn't fit?",
          lines: [
            he
              ? 'אפשר להחליף או להחזיר פריטים בהתאם למדיניות ההחזרות וההחלפות שלנו.'
              : 'You can exchange or return items under our returns and exchanges policy.',
          ],
          link: { label: he ? 'למדיניות ההחזרות וההחלפות' : 'Returns and exchanges policy', url: data.returnsUrl },
        },
      ],
      cta: data.orderUrl ? { label: he ? 'צפייה בהזמנה' : 'View your order', url: data.orderUrl } : undefined,
      links: contactLink(data.contactUrl, he),
    },
    he ? `ההזמנה ${data.orderNumber} נמסרה - BAIA` : `Order ${data.orderNumber} delivered - BAIA`,
    ctx,
  );
};

const orderCancelled: EmailTemplate<OrderTemplateData['order-cancelled']> = (data, locale, ctx) => {
  const he = locale === 'he';
  const paragraphs = [
    greeting(locale, data.name),
    he ? `ההזמנה ${data.orderNumber} בוטלה.` : `Order ${data.orderNumber} has been cancelled.`,
  ];
  const blocks: Block[] = [];
  if (data.paid) {
    if (data.refundAmount && !data.refundPending) {
      blocks.push({
        type: 'totals',
        rows: [
          ...(data.orderTotal ? [{ label: he ? 'סכום ההזמנה' : 'Order total', value: data.orderTotal }] : []),
          ...(data.feeAmount ? [{ label: he ? 'דמי ביטול' : 'Cancellation fee', value: `-${data.feeAmount}` }] : []),
          { label: he ? 'סכום לזיכוי' : 'Refund', value: data.refundAmount, strong: true },
        ],
      });
      blocks.push({
        type: 'paragraphs',
        items: [
          he
            ? `סכום של ${data.refundAmount} יזוכה לאמצעי התשלום שבו שילמת. הזיכוי עשוי להופיע בפירוט החיובים תוך מספר ימי עסקים.`
            : `${data.refundAmount} will be refunded to your original payment method. It may take a few business days to appear on your statement.`,
        ],
      });
    } else {
      blocks.push({
        type: 'callout',
        tone: 'info',
        lines: [
          data.refundPending
            ? he
              ? 'הזיכוי יבוצע על ידי צוות החנות בימים הקרובים, ונעדכן אותך כשיושלם.'
              : 'Our team will process your refund in the coming days and let you know once it is done.'
            : he
              ? 'אם חויבת על ההזמנה, הזיכוי יבוצע לאמצעי התשלום שבו שילמת.'
              : 'If you were charged, the amount will be refunded to your original payment method.',
          ...(data.feeAmount ? [he ? `דמי ביטול: ${data.feeAmount}.` : `Cancellation fee: ${data.feeAmount}.`] : []),
        ],
      });
    }
  }
  if (data.note) {
    blocks.push({ type: 'callout', tone: 'info', title: he ? 'הערה מהחנות' : 'Note from the store', lines: [data.note] });
  }
  return render(
    {
      locale,
      preheader: he ? `ההזמנה ${data.orderNumber} בוטלה` : `Order ${data.orderNumber} was cancelled`,
      heading: he ? 'ההזמנה בוטלה' : 'Your order was cancelled',
      paragraphs,
      blocks,
      cta: { label: he ? 'חזרה לחנות' : 'Back to the shop', url: data.shopUrl },
      links: contactLink(data.contactUrl, he),
      footnote: he
        ? 'לא ביקשת לבטל? אפשר להשיב למייל הזה ונבדוק מיד.'
        : "Didn't ask to cancel? Reply to this email and we'll look into it right away.",
    },
    he ? `ההזמנה ${data.orderNumber} בוטלה - BAIA` : `Order ${data.orderNumber} cancelled - BAIA`,
    ctx,
  );
};

const requestReceived: EmailTemplate<OrderTemplateData['cancellation-request-received']> = (data, locale, ctx) => {
  const he = locale === 'he';
  const blocks: Block[] = [{ type: 'facts', items: [orderFact(data.orderNumber, he)] }];
  if (data.requiresReturn) {
    blocks.push({
      type: 'callout',
      tone: 'warning',
      title: he ? 'ההזמנה כבר נשלחה' : 'Your order has already shipped',
      lines: [
        he
          ? 'יש להחזיר את הפריטים במצבם המקורי. בביטול לאחר המשלוח ייתכנו דמי ביטול של 5% ממחיר העסקה או 100 ₪, הנמוך מביניהם, בהתאם לחוק הגנת הצרכן.'
          : 'The items need to be returned in their original condition. Under Israeli consumer law a cancellation fee of 5% of the price or ₪100 (whichever is lower) may apply.',
      ],
    });
  }
  return render(
    {
      locale,
      preheader: he ? `בקשת הביטול להזמנה ${data.orderNumber} התקבלה` : `Cancellation request for ${data.orderNumber} received`,
      heading: he ? 'קיבלנו את בקשת הביטול' : 'We received your cancellation request',
      paragraphs: [
        greeting(locale, data.name),
        he
          ? `קיבלנו את בקשת הביטול להזמנה ${data.orderNumber}. נחזור אליך תוך יום עסקים אחד.`
          : `We received your cancellation request for order ${data.orderNumber}. We'll get back to you within one business day.`,
      ],
      blocks,
      cta: data.orderUrl ? { label: he ? 'צפייה בהזמנה' : 'View your order', url: data.orderUrl } : undefined,
      links: contactLink(data.contactUrl, he),
    },
    he ? `בקשת ביטול להזמנה ${data.orderNumber} - BAIA` : `Cancellation request for ${data.orderNumber} - BAIA`,
    ctx,
  );
};

const requestRejected: EmailTemplate<OrderTemplateData['cancellation-request-rejected']> = (data, locale, ctx) => {
  const he = locale === 'he';
  const blocks: Block[] = [];
  if (data.note) {
    blocks.push({ type: 'callout', tone: 'info', title: he ? 'הסבר מהצוות' : 'Note from our team', lines: [data.note] });
  }
  blocks.push({
    type: 'paragraphs',
    items: [
      he
        ? 'ההזמנה ממשיכה כרגיל. לכל שאלה אפשר להשיב למייל הזה או לפנות אלינו דרך עמוד יצירת הקשר.'
        : 'Your order continues as normal. For questions, reply to this email or use our contact page.',
    ],
  });
  return render(
    {
      locale,
      preheader: he ? `עדכון לגבי בקשת הביטול ${data.orderNumber}` : `Update on your cancellation request ${data.orderNumber}`,
      heading: he ? 'עדכון לגבי בקשת הביטול' : 'About your cancellation request',
      paragraphs: [
        greeting(locale, data.name),
        he
          ? `בדקנו את בקשת הביטול להזמנה ${data.orderNumber}, ולצערנו לא נוכל לבטל אותה.`
          : `We reviewed your cancellation request for order ${data.orderNumber} and unfortunately can't cancel it.`,
      ],
      blocks,
      cta: { label: he ? 'יצירת קשר' : 'Contact us', url: data.contactUrl },
    },
    he ? `עדכון לגבי בקשת הביטול ${data.orderNumber} - BAIA` : `Your cancellation request ${data.orderNumber} - BAIA`,
    ctx,
  );
};

// ─── Store inbox alerts (Hebrew) ───────────────────────────────

const customerRows = (d: { customer: string; email: string; phone?: string | null }) => [
  { label: 'לקוח/ה', value: d.customer },
  { label: 'אימייל', value: d.email, url: `mailto:${d.email}` },
  ...(d.phone ? [{ label: 'טלפון', value: d.phone, url: telHref(d.phone) }] : []),
];

const adminNewOrder: EmailTemplate<OrderTemplateData['admin-new-order']> = (data, _locale, ctx) =>
  render(
    {
      locale: 'he',
      preheader: `הזמנה חדשה ${data.orderNumber} - ${data.total}`,
      heading: 'התקבלה הזמנה חדשה',
      paragraphs: [],
      blocks: [
        {
          type: 'facts',
          items: [
            { label: 'מספר הזמנה', value: data.orderNumber },
            { label: 'סה״כ', value: data.total },
            { label: 'פריטים', value: String(data.itemCount) },
          ],
        },
        {
          type: 'details',
          rows: [
            ...customerRows(data),
            { label: 'משלוח', value: data.delivery },
            { label: 'דיוור', value: data.marketingConsent ? 'הלקוח/ה אישר/ה קבלת דיוור.' : 'ללא אישור דיוור.' },
          ],
        },
      ],
      cta: { label: 'פתיחה בממשק הניהול', url: data.adminUrl },
    },
    `הזמנה חדשה ${data.orderNumber} (${data.total})`,
    ctx,
  );

const adminCancellationRequest: EmailTemplate<OrderTemplateData['admin-cancellation-request']> = (data, _locale, ctx) =>
  render(
    {
      locale: 'he',
      preheader: `בקשת ביטול להזמנה ${data.orderNumber}`,
      heading: 'בקשת ביטול חדשה',
      paragraphs: [],
      blocks: [
        {
          type: 'facts',
          items: [
            { label: 'מספר הזמנה', value: data.orderNumber },
            { label: 'סה״כ', value: data.total },
          ],
        },
        {
          type: 'details',
          rows: [
            ...customerRows(data),
            { label: 'סיבה', value: data.reason },
            ...(data.details ? [{ label: 'פרטים', value: data.details }] : []),
            {
              label: 'חלון ביטול',
              value: data.insideWindow ? 'הבקשה הוגשה בתוך חלון הביטול ללא עלות.' : 'הבקשה הוגשה אחרי חלון הביטול ללא עלות.',
            },
          ],
        },
        ...(data.requiresReturn
          ? [{ type: 'callout', tone: 'warning', lines: ['ההזמנה כבר נשלחה - נדרשת החזרה של הפריטים.'] } as Block]
          : []),
      ],
      cta: { label: 'לטיפול בבקשה', url: data.adminUrl },
    },
    `בקשת ביטול: ${data.orderNumber}`,
    ctx,
  );

const adminSelfCancelled: EmailTemplate<OrderTemplateData['admin-order-self-cancelled']> = (data, _locale, ctx) =>
  render(
    {
      locale: 'he',
      preheader: `ההזמנה ${data.orderNumber} בוטלה על ידי הלקוח/ה`,
      heading: 'הזמנה בוטלה בשירות עצמי',
      paragraphs: [],
      blocks: [
        {
          type: 'facts',
          items: [
            { label: 'מספר הזמנה', value: data.orderNumber },
            { label: 'סה״כ', value: data.total },
          ],
        },
        {
          type: 'details',
          rows: [
            ...customerRows(data),
            { label: 'סיבה', value: data.reason },
            ...(data.details ? [{ label: 'פרטים', value: data.details }] : []),
          ],
        },
        {
          type: 'callout',
          tone: data.refundFailed ? 'warning' : 'success',
          lines: [
            data.refundFailed
              ? 'שימו לב: הזיכוי האוטומטי נכשל - יש לבצע זיכוי ידני.'
              : data.refundAmount
                ? `בוצע זיכוי של ${data.refundAmount}.`
                : 'לא נדרש זיכוי.',
            'הפריטים הוחזרו למלאי. אין לשלוח את ההזמנה.',
          ],
        },
      ],
      cta: { label: 'פתיחה בממשק הניהול', url: data.adminUrl },
    },
    `${data.refundFailed ? '[נדרש זיכוי ידני] ' : ''}ביטול הזמנה ${data.orderNumber}`,
    ctx,
  );

export const orderTemplates: { [K in keyof OrderTemplateData]: EmailTemplate<OrderTemplateData[K]> } = {
  'order-shipped': orderShipped,
  'order-delivered': orderDelivered,
  'order-cancelled': orderCancelled,
  'cancellation-request-received': requestReceived,
  'cancellation-request-rejected': requestRejected,
  'admin-new-order': adminNewOrder,
  'admin-cancellation-request': adminCancellationRequest,
  'admin-order-self-cancelled': adminSelfCancelled,
};
