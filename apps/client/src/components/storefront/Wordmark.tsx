import { cn } from '@/lib/utils';

/** BAIA wordmark — always LTR so it reads the same in Hebrew and English. */
export function Wordmark({ className, tone = 'ink' }: { className?: string; tone?: 'ink' | 'light' }) {
  return (
    <span dir="ltr" className={cn('inline-flex flex-col items-center leading-none', className)}>
      <span
        className={cn(
          'font-display text-[26px] font-medium tracking-[0.32em] ps-[0.32em]',
          tone === 'ink' ? 'text-ink' : 'text-white',
        )}
      >
        BAIA
      </span>
      <span
        className={cn(
          'mt-1 text-[9px] font-semibold tracking-[0.5em] ps-[0.5em]',
          tone === 'ink' ? 'text-[#5E6B70]' : 'text-white/70',
        )}
      >
        SWIMWEAR
      </span>
    </span>
  );
}
