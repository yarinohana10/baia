import { StorefrontLayout } from '@/components/storefront';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StorefrontLayout>{children}</StorefrontLayout>;
}
