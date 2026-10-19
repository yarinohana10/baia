/**
 * The hosted payment page for an order. A guest's access token travels in the
 * URL fragment, which browsers never send to servers or in Referer headers;
 * the page swaps it for an httpOnly cookie and strips it from the address bar.
 */
export function paymentPageHref(orderId: string, token?: string | null): string {
  return `/checkout/payment/${orderId}${token ? `#token=${token}` : ''}`;
}
