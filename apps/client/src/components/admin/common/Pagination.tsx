'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Previous / next buttons with "page / pages"; renders nothing for a single page. */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  previousLabel,
  nextLabel,
  extra,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  previousLabel: string;
  nextLabel: string;
  /** Shown after the page count (e.g. ` · 120`). */
  extra?: ReactNode;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label={previousLabel}
      >
        <ChevronLeft size={14} className="rtl:rotate-180" />
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
        {extra}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        aria-label={nextLabel}
      >
        <ChevronRight size={14} className="rtl:rotate-180" />
      </Button>
    </div>
  );
}
