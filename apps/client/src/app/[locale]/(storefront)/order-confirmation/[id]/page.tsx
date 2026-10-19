import { OrderConfirmationView } from '@/components/storefront/orders/OrderConfirmationView';

/**
 * Order page. The order loads in the browser (OrderConfirmationView): guests
 * carry their access token in the URL fragment, which never reaches the server.
 */
export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderConfirmationView orderId={id} />;
}
