import { useTranslations } from 'next-intl';
import { translateColor } from '@/lib/catalog/color-names';

/** Returns a function that shows a variant colour in the current language ("Blue" -> "כחול"). */
export function useColorName(): (color: string) => string {
  const t = useTranslations('colors');
  return (color: string) => translateColor(t, color);
}
