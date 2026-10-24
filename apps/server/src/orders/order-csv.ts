import type { Order, OrderItem } from '../generated/prisma';

type CsvOrder = Omit<Order, 'accessTokenHash' | 'accessTokenExpiresAt' | 'paymentClaimedAt'> & {
  items: OrderItem[];
  coupon: { code: string } | null;
};

const HEADER = [
  'orderNumber',
  'createdAt',
  'paidAt',
  'status',
  'customerEmail',
  'recipientName',
  'phone',
  'deliveryMethod',
  'pickupPoint',
  'city',
  'address',
  'items',
  'subtotal',
  'shipping',
  'discount',
  'coupon',
  'total',
  'trackingNumber',
  'marketingConsent',
];

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Quote everything; neutralise spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

function row(o: CsvOrder): unknown[] {
  return [
    o.orderNumber,
    o.createdAt.toISOString(),
    o.paidAt?.toISOString() ?? '',
    o.status,
    o.customerEmail,
    o.recipientName ?? '',
    o.phone ?? '',
    o.deliveryMethod,
    o.pickupPointName ?? '',
    o.shippingCity,
    [o.shippingStreet, o.shippingNumber, o.shippingApartment].filter(Boolean).join(' '),
    o.items.map((i) => `${i.quantity}x ${i.productNameHe ?? i.productName} (${i.color}/${i.size})`).join('; '),
    o.subtotal.toString(),
    o.shippingCost.toString(),
    o.discountAmount.toString(),
    o.coupon?.code ?? '',
    o.total.toString(),
    o.trackingNumber ?? '',
    o.marketingConsent ? 'yes' : 'no',
  ];
}

/** Orders as CSV (UTF-8 with BOM so Excel shows Hebrew). */
export function ordersCsv(orders: CsvOrder[]): string {
  return '﻿' + [HEADER, ...orders.map(row)].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
