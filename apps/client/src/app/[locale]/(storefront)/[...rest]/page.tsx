import { notFound } from 'next/navigation';

// Any unknown /{locale}/... URL renders the branded storefront 404 (with header/footer).
export default function CatchAll() {
  notFound();
}
