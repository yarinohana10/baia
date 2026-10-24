import Image from 'next/image';
import { Package } from 'lucide-react';

/** Square photo of an ordered item (the product's photo in that colour), or a neutral placeholder. */
export function OrderItemThumb({ src, alt, size = 56 }: { src?: string | null; alt: string; size?: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden border border-black/5 bg-neutral-100"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <Package size={Math.round(size / 3)} strokeWidth={1.25} className="text-black/25" aria-hidden="true" />
      )}
    </span>
  );
}
