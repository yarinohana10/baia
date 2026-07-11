import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BAIA Swimwear',
  description: 'Premium swimwear for men, women, and children',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
