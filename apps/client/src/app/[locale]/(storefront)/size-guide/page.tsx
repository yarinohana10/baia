import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSizeGuides } from '@/lib/catalog/server';

/** /size-guide opens the first guide (Women, unless the admin reorders them). */
export default async function SizeGuideIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [first] = await getSizeGuides();
  if (!first) notFound();
  redirect({ href: `/size-guide/${first.slug}`, locale });
}
