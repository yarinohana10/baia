import { PaymentView } from '@/components/storefront/payment/PaymentView';

/**
 * Hosted payment page. The order loads in the browser (PaymentView): guests
 * carry their access token in the URL fragment, which never reaches the server.
 */
export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentView orderId={id} />;
}
