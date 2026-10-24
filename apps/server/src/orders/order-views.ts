import type { Prisma } from '../generated/prisma';

/** What each client may see of an order, and the item photos shown with it. */

/** Internal fields that must never be serialized to any client (incl. admin). */
export const ORDER_PRIVATE_FIELDS = {
  accessTokenHash: true,
  accessTokenExpiresAt: true,
  paymentClaimedAt: true,
} as const;

/** Fields of a cancellation request that the order's owner may see. */
const CUSTOMER_REQUEST_SELECT = {
  id: true,
  status: true,
  reason: true,
  feeAmount: true,
  refundAmount: true,
  createdAt: true,
  resolvedAt: true,
} as const;

/** What the order's owner may see of its refunds and status history (no admin identities or provider refs). */
const CUSTOMER_REFUND_SELECT = { id: true, status: true, amount: true, requestedAt: true, completedAt: true } as const;
const CUSTOMER_EVENT_SELECT = { toStatus: true, createdAt: true } as const;

/** The product's photos, enough to pick the one matching an ordered colour. */
export const ITEM_IMAGES_SELECT = {
  select: { product: { select: { images: { select: { url: true, color: true }, orderBy: { sortOrder: 'asc' } } } } },
} as const;

/** Relations every customer-facing order view carries. */
export const CUSTOMER_ORDER_INCLUDE = {
  items: { orderBy: { createdAt: 'asc' }, include: { variant: ITEM_IMAGES_SELECT } },
  coupon: true,
  cancellationRequests: { select: CUSTOMER_REQUEST_SELECT, orderBy: { createdAt: 'desc' } },
  refunds: { select: CUSTOMER_REFUND_SELECT, orderBy: { requestedAt: 'desc' } },
  statusEvents: { select: CUSTOMER_EVENT_SELECT, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

/** Product photos must be absolute for email clients; relative paths are resolved against the API origin. */
export function absoluteImageUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const origin = (process.env.SERVER_URL || process.env.BETTER_AUTH_URL || '').replace(/\/$/, '');
  return u.startsWith('/') && origin ? `${origin}${u}` : null;
}

export type ImageRow = { url: string; color: string | null };
export type ItemWithImages = { color: string; variant?: { product?: { images?: ImageRow[] } | null } | null };

/**
 * First photo of the item's colour, else the product's first photo. Products
 * that were ordered are archived, never deleted, so the photo stays available.
 */
export function itemImage(images: ImageRow[] | undefined, color: string): string | null {
  if (!images?.length) return null;
  const c = color.trim().toLowerCase();
  const match = images.find((i) => i.color?.trim().toLowerCase() === c) ?? images.find((i) => !i.color) ?? images[0];
  return absoluteImageUrl(match.url);
}

/** Replaces each line's variant (with its photos) by the one `imageUrl` the views show. */
export function withItemImages<I extends ItemWithImages, T extends { items: I[] }>(
  order: T,
): Omit<T, 'items'> & { items: (Omit<I, 'variant'> & { imageUrl: string | null })[] } {
  return {
    ...order,
    items: order.items.map(({ variant, ...item }) => ({ ...item, imageUrl: itemImage(variant?.product?.images, item.color) })),
  };
}
