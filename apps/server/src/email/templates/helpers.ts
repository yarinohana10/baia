import type { EmailLocale, RenderedEmail } from '../email.types';
import { renderLayout, renderText, type LayoutParts } from './layout';

export function render(parts: LayoutParts, subject: string): RenderedEmail {
  return { subject, html: renderLayout(parts), text: renderText(parts) };
}

export function greeting(locale: EmailLocale, name?: string | null): string {
  const n = name?.trim();
  if (locale === 'he') return n ? `שלום ${n},` : 'שלום,';
  return n ? `Hi ${n},` : 'Hi,';
}
