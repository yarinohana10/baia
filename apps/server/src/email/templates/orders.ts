import type { EmailTemplate } from './index';
import { greeting, render } from './helpers';

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
  };
  'order-delivered': {
    name?: string | null;
    orderNumber: string;
    orderUrl?: string | null;
    returnsUrl: string;
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
  };
  'cancellation-request-received': {
    name?: string | null;
    orderNumber: string;
    requiresReturn: boolean;
    orderUrl?: string | null;
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

const pickupLine = (p: PickupPointInfo, he: boolean) =>
  `${p.name} - ${p.address}, ${p.city}${p.hours ? ` (${he ? 'שעות פעילות' : 'Hours'}: ${p.hours})` : ''}`;

const orderShipped: EmailTemplate<OrderTemplateData['order-shipped']> = (data, locale) => {
  const he = locale === 'he';
  const pickup = data.deliveryMethod === 'PICKUP_POINT';
  const paragraphs = [greeting(locale, data.name)];
  if (pickup) {
    paragraphs.push(
      he
        ? `ההזמנה ${data.orderNumber} יצאה לדרך! החבילה בדרך לנקודת האיסוף, ונעדכן אותך כשאפשר יהיה לאסוף אותה.`
        : `Order ${data.orderNumber} is on its way! The parcel is heading to your pickup point - we'll let you know when it's ready to collect.`,
    );
    if (data.pickupPoint) paragraphs.push(`${he ? 'נקודת האיסוף' : 'Pickup point'}: ${pickupLine(data.pickupPoint, he)}`);
  } else {
    paragraphs.push(
      he
        ? `ההזמנה ${data.orderNumber} יצאה לדרך! השליח ייצור איתך קשר לפני המסירה.`
        : `Order ${data.orderNumber} is on its way! The courier will contact you before delivery.`,
    );
    if (data.address) paragraphs.push(`${he ? 'כתובת למשלוח' : 'Shipping to'}: ${data.address}`);
  }
  if (data.etaDays) {
    paragraphs.push(he ? `זמן הגעה משוער: ${data.etaDays} ימי עסקים.` : `Estimated delivery: ${data.etaDays} business days.`);
  }
  if (data.trackingNumber) {
    paragraphs.push(`${he ? 'מספר מעקב' : 'Tracking number'}: ${data.trackingNumber}`);
    if (data.trackingUrl) paragraphs.push(`${he ? 'מעקב אחר המשלוח' : 'Track your parcel'}: ${data.trackingUrl}`);
  }
  return render(
    {
      locale,
      preheader: he ? `ההזמנה ${data.orderNumber} נשלחה` : `Order ${data.orderNumber} has shipped`,
      heading: he ? 'ההזמנה שלך בדרך' : 'Your order is on its way',
      paragraphs,
      cta: data.orderUrl ? { label: he ? 'צפייה בהזמנה' : 'View your order', url: data.orderUrl } : undefined,
      footnote: he
        ? 'שאלות על המשלוח? אפשר להשיב למייל הזה ולציין את מספר ההזמנה.'
        : 'Questions about your delivery? Reply to this email with your order number.',
    },
    he ? `ההזמנה ${data.orderNumber} נשלחה - BAIA` : `Order ${data.orderNumber} has shipped - BAIA`,
  );
};

const orderDelivered: EmailTemplate<OrderTemplateData['order-delivered']> = (data, locale) => {
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
        he
          ? `משהו לא מתאים? מדיניות ההחזרות וההחלפות שלנו: ${data.returnsUrl}`
          : `Something doesn't fit? See our returns and exchanges policy: ${data.returnsUrl}`,
      ],
      cta: data.orderUrl ? { label: he ? 'צפייה בהזמנה' : 'View your order', url: data.orderUrl } : undefined,
    },
    he ? `ההזמנה ${data.orderNumber} נמסרה - BAIA` : `Order ${data.orderNumber} delivered - BAIA`,
  );
};

const orderCancelled: EmailTemplate<OrderTemplateData['order-cancelled']> = (data, locale) => {
  const he = locale === 'he';
  const paragraphs = [
    greeting(locale, data.name),
    he ? `ההזמנה ${data.orderNumber} בוטלה.` : `Order ${data.orderNumber} has been cancelled.`,
  ];
  if (data.paid) {
    if (data.refundPending) {
      paragraphs.push(
        he
          ? 'הזיכוי יבוצע על ידי צוות החנות בימים הקרובים, ונעדכן אותך כשיושלם.'
          : 'Our team will process your refund in the coming days and let you know once it is done.',
      );
    } else if (data.refundAmount) {
      paragraphs.push(
        he
          ? `סכום של ${data.refundAmount} יזוכה לאמצעי התשלום שבו שילמת. הזיכוי עשוי להופיע בפירוט החיובים תוך מספר ימי עסקים.`
          : `${data.refundAmount} will be refunded to your original payment method. It may take a few business days to appear on your statement.`,
      );
    } else {
      paragraphs.push(
        he
          ? 'אם חויבת על ההזמנה, הזיכוי יבוצע לאמצעי התשלום שבו שילמת.'
          : 'If you were charged, the amount will be refunded to your original payment method.',
      );
    }
    if (data.feeAmount) {
      paragraphs.push(he ? `דמי ביטול: ${data.feeAmount}.` : `Cancellation fee: ${data.feeAmount}.`);
    }
  }
  if (data.note) paragraphs.push(`${he ? 'הערה מהחנות' : 'Note from the store'}: ${data.note}`);
  return render(
    {
      locale,
      preheader: he ? `ההזמנה ${data.orderNumber} בוטלה` : `Order ${data.orderNumber} was cancelled`,
      heading: he ? 'ההזמנה בוטלה' : 'Your order was cancelled',
      paragraphs,
      cta: { label: he ? 'חזרה לחנות' : 'Back to the shop', url: data.shopUrl },
      footnote: he
        ? 'לא ביקשת לבטל? אפשר להשיב למייל הזה ונבדוק מיד.'
        : "Didn't ask to cancel? Reply to this email and we'll look into it right away.",
    },
    he ? `ההזמנה ${data.orderNumber} בוטלה - BAIA` : `Order ${data.orderNumber} cancelled - BAIA`,
  );
};

const requestReceived: EmailTemplate<OrderTemplateData['cancellation-request-received']> = (data, locale) => {
  const he = locale === 'he';
  const paragraphs = [
    greeting(locale, data.name),
    he
      ? `קיבלנו את בקשת הביטול להזמנה ${data.orderNumber}. נחזור אליך תוך יום עסקים אחד.`
      : `We received your cancellation request for order ${data.orderNumber}. We'll get back to you within one business day.`,
  ];
  if (data.requiresReturn) {
    paragraphs.push(
      he
        ? 'ההזמנה כבר נשלחה, ולכן יש להחזיר את הפריטים במצבם המקורי. בביטול לאחר המשלוח ייתכנו דמי ביטול של 5% ממחיר העסקה או 100 ₪, הנמוך מביניהם, בהתאם לחוק הגנת הצרכן.'
        : 'Your order has already shipped, so the items need to be returned in their original condition. Under Israeli consumer law a cancellation fee of 5% of the price or ₪100 (whichever is lower) may apply.',
    );
  }
  return render(
    {
      locale,
      preheader: he ? `בקשת הביטול להזמנה ${data.orderNumber} התקבלה` : `Cancellation request for ${data.orderNumber} received`,
      heading: he ? 'קיבלנו את בקשת הביטול' : 'We received your cancellation request',
      paragraphs,
      cta: data.orderUrl ? { label: he ? 'צפייה בהזמנה' : 'View your order', url: data.orderUrl } : undefined,
    },
    he ? `בקשת ביטול להזמנה ${data.orderNumber} - BAIA` : `Cancellation request for ${data.orderNumber} - BAIA`,
  );
};

const requestRejected: EmailTemplate<OrderTemplateData['cancellation-request-rejected']> = (data, locale) => {
  const he = locale === 'he';
  const paragraphs = [
    greeting(locale, data.name),
    he
      ? `בדקנו את בקשת הביטול להזמנה ${data.orderNumber}, ולצערנו לא נוכל לבטל אותה.`
      : `We reviewed your cancellation request for order ${data.orderNumber} and unfortunately can't cancel it.`,
  ];
  if (data.note) paragraphs.push(`${he ? 'הסבר' : 'Details'}: ${data.note}`);
  paragraphs.push(
    he
      ? 'ההזמנה ממשיכה כרגיל. לכל שאלה אפשר להשיב למייל הזה או לפנות אלינו דרך עמוד יצירת הקשר.'
      : 'Your order continues as normal. For questions, reply to this email or use our contact page.',
  );
  return render(
    {
      locale,
      preheader: he ? `עדכון לגבי בקשת הביטול ${data.orderNumber}` : `Update on your cancellation request ${data.orderNumber}`,
      heading: he ? 'עדכון לגבי בקשת הביטול' : 'About your cancellation request',
      paragraphs,
      cta: { label: he ? 'יצירת קשר' : 'Contact us', url: data.contactUrl },
    },
    he ? `עדכון לגבי בקשת הביטול ${data.orderNumber} - BAIA` : `Your cancellation request ${data.orderNumber} - BAIA`,
  );
};

// ─── Store inbox alerts (Hebrew) ───────────────────────────────

const adminNewOrder: EmailTemplate<OrderTemplateData['admin-new-order']> = (data) =>
  render(
    {
      locale: 'he',
      preheader: `הזמנה חדשה ${data.orderNumber} - ${data.total}`,
      heading: 'התקבלה הזמנה חדשה',
      paragraphs: [
        `מספר הזמנה: ${data.orderNumber}`,
        `לקוח/ה: ${data.customer} · ${data.email}${data.phone ? ` · ${data.phone}` : ''}`,
        `סה"כ: ${data.total} · ${data.itemCount} פריטים`,
        `משלוח: ${data.delivery}`,
        data.marketingConsent ? 'הלקוח/ה אישר/ה קבלת דיוור.' : 'ללא אישור דיוור.',
      ],
      cta: { label: 'פתיחה בממשק הניהול', url: data.adminUrl },
    },
    `הזמנה חדשה ${data.orderNumber} (${data.total})`,
  );

const adminCancellationRequest: EmailTemplate<OrderTemplateData['admin-cancellation-request']> = (data) =>
  render(
    {
      locale: 'he',
      preheader: `בקשת ביטול להזמנה ${data.orderNumber}`,
      heading: 'בקשת ביטול חדשה',
      paragraphs: [
        `מספר הזמנה: ${data.orderNumber} · ${data.total}`,
        `לקוח/ה: ${data.customer} · ${data.email}${data.phone ? ` · ${data.phone}` : ''}`,
        `סיבה: ${data.reason}`,
        ...(data.details ? [`פרטים: ${data.details}`] : []),
        data.insideWindow ? 'הבקשה הוגשה בתוך חלון הביטול ללא עלות.' : 'הבקשה הוגשה אחרי חלון הביטול ללא עלות.',
        ...(data.requiresReturn ? ['ההזמנה כבר נשלחה - נדרשת החזרה של הפריטים.'] : []),
      ],
      cta: { label: 'לטיפול בבקשה', url: data.adminUrl },
    },
    `בקשת ביטול: ${data.orderNumber}`,
  );

const adminSelfCancelled: EmailTemplate<OrderTemplateData['admin-order-self-cancelled']> = (data) =>
  render(
    {
      locale: 'he',
      preheader: `ההזמנה ${data.orderNumber} בוטלה על ידי הלקוח/ה`,
      heading: 'הזמנה בוטלה בשירות עצמי',
      paragraphs: [
        `מספר הזמנה: ${data.orderNumber} · ${data.total}`,
        `לקוח/ה: ${data.customer} · ${data.email}`,
        `סיבה: ${data.reason}`,
        ...(data.details ? [`פרטים: ${data.details}`] : []),
        data.refundFailed
          ? 'שימו לב: הזיכוי האוטומטי נכשל - יש לבצע זיכוי ידני.'
          : data.refundAmount
            ? `בוצע זיכוי של ${data.refundAmount}.`
            : 'לא נדרש זיכוי.',
        'הפריטים הוחזרו למלאי. אין לשלוח את ההזמנה.',
      ],
      cta: { label: 'פתיחה בממשק הניהול', url: data.adminUrl },
    },
    `${data.refundFailed ? '[נדרש זיכוי ידני] ' : ''}ביטול הזמנה ${data.orderNumber}`,
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
