import type { EmailTemplate } from './index';
import { greeting, paymentLines, render, type PaymentInfo } from './helpers';
import { telHref, type Block, type InfoBox, type ItemRow, type Link } from './layout';

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
    /** True when the provider has not returned the money yet and the store will settle it. */
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
  'order-processing': {
    name?: string | null;
    orderNumber: string;
    orderUrl?: string | null;
    contactUrl?: string | null;
  };
  'refund-completed': {
    name?: string | null;
    orderNumber: string;
    refundAmount: string;
    orderTotal?: string | null;
    /** Cancellation fee the store kept, when any. */
    feeAmount?: string | null;
    shopUrl: string;
    orderUrl?: string | null;
    contactUrl?: string | null;
  };
  'admin-new-order': {
    orderNumber: string;
    orderDate: string;
    customer: string;
    email: string;
    phone?: string | null;
    items: (ItemRow & { color: string; size: string })[];
    subtotal: string;
    shipping: string;
    discount: string | null;
    total: string;
    itemCount: number;
    deliveryMethod: 'COURIER' | 'PICKUP_POINT';
    addressLines: string[];
    payment: PaymentInfo | null;
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
    requiresReturn: boolean;
    adminUrl: string;
  };
  /** Every cancellation except the silent unpaid-order sweeper. */
  'admin-order-cancelled': {
    orderNumber: string;
    customer: string;
    email: string;
    phone?: string | null;
    total: string;
    cancelledBy: 'customer' | 'admin' | 'request';
    paid: boolean;
    refundAmount?: string | null;
    feeAmount?: string | null;
    /** The provider did not settle the refund: an Admin must refund it in the provider's dashboard. */
    refundPending: boolean;
    reason?: string | null;
    details?: string | null;
    note?: string | null;
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
              ? 'הזיכוי בטיפול. נעדכן אותך במייל ברגע שהכסף יוחזר לאמצעי התשלום שלך.'
              : 'Your refund is being processed. We will email you as soon as the money is returned to your payment method.'
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

const adminNewOrder: EmailTemplate<OrderTemplateData['admin-new-order']> = (data, _locale, ctx) => {
  const pickup = data.deliveryMethod === 'PICKUP_POINT';
  const payment = paymentLines(data.payment, 'he');
  return render(
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
            { label: 'תאריך', value: data.orderDate },
            { label: 'סה״כ', value: data.total },
          ],
        },
        { type: 'items', title: `פריטים (${data.itemCount})`, items: data.items },
        {
          type: 'totals',
          rows: [
            { label: 'סכום ביניים', value: data.subtotal },
            { label: 'משלוח', value: data.shipping },
            ...(data.discount ? [{ label: 'הנחה', value: `-${data.discount}` }] : []),
            { label: 'סה״כ', value: data.total, strong: true },
          ],
        },
        {
          type: 'details',
          title: 'פרטי הלקוח/ה',
          rows: [
            ...customerRows(data),
            { label: pickup ? 'איסוף מנקודת חלוקה' : 'כתובת למשלוח', value: data.addressLines.join(', ') },
            { label: 'אמצעי תשלום', value: payment?.join(' | ') ?? 'לא ידוע' },
            { label: 'דיוור', value: data.marketingConsent ? 'הלקוח/ה אישר/ה קבלת דיוור.' : 'ללא אישור דיוור.' },
          ],
        },
      ],
      cta: { label: 'פתיחה בממשק הניהול', url: data.adminUrl },
    },
    `הזמנה חדשה ${data.orderNumber} (${data.total})`,
    ctx,
  );
};

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

const CANCELLED_BY_HE = {
  customer: 'הלקוח/ה ביטל/ה את ההזמנה',
  admin: 'ההזמנה בוטלה על ידי צוות החנות',
  request: 'בקשת ביטול אושרה',
} as const;

const adminOrderCancelled: EmailTemplate<OrderTemplateData['admin-order-cancelled']> = (data, _locale, ctx) => {
  const money: string[] = [];
  if (!data.paid) money.push('ההזמנה לא שולמה - אין זיכוי.');
  else if (data.refundPending) {
    money.push(
      `נדרש זיכוי של ${data.refundAmount ?? data.total}: יש לזכות את הלקוח/ה בלוח הבקרה של ספק התשלומים ואז לאשר בממשק הניהול (זיכויים ממתינים).`,
    );
  } else if (data.refundAmount) money.push(`בוצע זיכוי של ${data.refundAmount}.`);
  else money.push('לא נדרש זיכוי.');
  if (data.feeAmount) money.push(`דמי ביטול שנשארו בחנות: ${data.feeAmount}.`);
  money.push('הפריטים הוחזרו למלאי.');
  return render(
    {
      locale: 'he',
      preheader: `${CANCELLED_BY_HE[data.cancelledBy]}: ${data.orderNumber}`,
      heading: 'הזמנה בוטלה',
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
            { label: 'סיבת הביטול', value: CANCELLED_BY_HE[data.cancelledBy] },
            ...customerRows(data),
            ...(data.reason ? [{ label: 'סיבה', value: data.reason }] : []),
            ...(data.details ? [{ label: 'פרטים', value: data.details }] : []),
            ...(data.note ? [{ label: 'הערה', value: data.note }] : []),
          ],
        },
        { type: 'callout', tone: data.paid && data.refundPending ? 'warning' : 'success', lines: money },
      ],
      cta: { label: 'פתיחה בממשק הניהול', url: data.adminUrl },
    },
    `${data.paid && data.refundPending ? '[נדרש זיכוי] ' : ''}ביטול הזמנה ${data.orderNumber}`,
    ctx,
  );
};

// ─── Customer: in progress and refund completed ────────────────

const orderProcessing: EmailTemplate<OrderTemplateData['order-processing']> = (data, locale, ctx) => {
  const he = locale === 'he';
  return render(
    {
      locale,
      preheader: he ? `ההזמנה ${data.orderNumber} בטיפול` : `Order ${data.orderNumber} is being prepared`,
      heading: he ? 'ההזמנה שלך בטיפול' : 'Your order is in progress',
      paragraphs: [
        greeting(locale, data.name),
        he
          ? `התחלנו להכין את ההזמנה ${data.orderNumber}. נעדכן אותך שוב כשהיא תצא לדרך.`
          : `We have started preparing order ${data.orderNumber}. We will email you again when it ships.`,
      ],
      blocks: [{ type: 'facts', items: [orderFact(data.orderNumber, he)] }],
      cta: data.orderUrl ? { label: he ? 'צפייה בהזמנה' : 'View your order', url: data.orderUrl } : undefined,
      links: contactLink(data.contactUrl, he),
    },
    he ? `ההזמנה ${data.orderNumber} בטיפול - BAIA` : `Order ${data.orderNumber} is in progress - BAIA`,
    ctx,
  );
};

const refundCompleted: EmailTemplate<OrderTemplateData['refund-completed']> = (data, locale, ctx) => {
  const he = locale === 'he';
  return render(
    {
      locale,
      preheader: he ? `הזיכוי להזמנה ${data.orderNumber} בוצע` : `Your refund for order ${data.orderNumber} is done`,
      heading: he ? 'הזיכוי בוצע' : 'Your refund is done',
      paragraphs: [
        greeting(locale, data.name),
        he
          ? `הזיכוי בסך ${data.refundAmount} עבור ההזמנה ${data.orderNumber} בוצע. הסכום יופיע בפירוט החיובים שלך תוך מספר ימי עסקים, בהתאם לחברת האשראי.`
          : `Your refund of ${data.refundAmount} for order ${data.orderNumber} has been issued. It may take a few business days to appear on your statement, depending on your card issuer.`,
      ],
      blocks: [
        { type: 'facts', items: [orderFact(data.orderNumber, he)] },
        {
          type: 'totals',
          rows: [
            ...(data.orderTotal ? [{ label: he ? 'סכום ההזמנה' : 'Order total', value: data.orderTotal }] : []),
            ...(data.feeAmount ? [{ label: he ? 'דמי ביטול' : 'Cancellation fee', value: `-${data.feeAmount}` }] : []),
            { label: he ? 'סכום שזוכה' : 'Refunded', value: data.refundAmount, strong: true },
          ],
        },
      ],
      cta: { label: he ? 'חזרה לחנות' : 'Back to the shop', url: data.shopUrl },
      links: contactLink(data.contactUrl, he),
    },
    he ? `הזיכוי להזמנה ${data.orderNumber} בוצע - BAIA` : `Refund for order ${data.orderNumber} - BAIA`,
    ctx,
  );
};

export const orderTemplates: { [K in keyof OrderTemplateData]: EmailTemplate<OrderTemplateData[K]> } = {
  'order-shipped': orderShipped,
  'order-delivered': orderDelivered,
  'order-cancelled': orderCancelled,
  'cancellation-request-received': requestReceived,
  'cancellation-request-rejected': requestRejected,
  'admin-new-order': adminNewOrder,
  'admin-cancellation-request': adminCancellationRequest,
  'order-processing': orderProcessing,
  'refund-completed': refundCompleted,
  'admin-order-cancelled': adminOrderCancelled,
};
