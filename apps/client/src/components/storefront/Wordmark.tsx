import Image from 'next/image';
import { cn } from '@/lib/utils';
import { LOGO_FALLBACK_URL } from '@/lib/brand';

/** BAIA logo (sun, wave and wordmark in the brand light blue). Size it with a height class. */
export function Wordmark({
  src = LOGO_FALLBACK_URL,
  className,
  priority,
}: {
  /** Logo URL from getLogoUrl() (the assets bucket in deployed environments). */
  src?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt="BAIA Swimwear"
      width={839}
      height={686}
      priority={priority}
      sizes="160px"
      className={cn('h-12 w-auto', className)}
    />
  );
}
