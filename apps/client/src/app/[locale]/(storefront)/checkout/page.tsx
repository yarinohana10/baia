import { CheckoutView } from '@/components/storefront/checkout/CheckoutView';

/** Checkout: the cart lives in the browser session / guest cookie, so the form is a client view. */
export default function CheckoutPage() {
  return <CheckoutView />;
}
