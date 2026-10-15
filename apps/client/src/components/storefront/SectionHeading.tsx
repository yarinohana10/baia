import { Link } from '@/i18n/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export function SectionHeading({
  eyebrow,
  title,
  action,
  locale,
  id,
}: {
  eyebrow?: string;
  title: string;
  action?: { label: string; href: string };
  locale: string;
  id?: string;
}) {
  const Arrow = locale === 'he' ? ArrowLeft : ArrowRight;
  return (
    <div className="mb-8 flex items-end justify-between gap-6 sm:mb-10">
      <div>
        {eyebrow && <p className="eyebrow mb-2 text-ocean-700">{eyebrow}</p>}
        <h2 id={id} className="font-display text-[28px] leading-tight text-ink sm:text-4xl">
          {title}
        </h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-ink underline-offset-4 hover:underline"
        >
          {action.label}
          <Arrow size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
