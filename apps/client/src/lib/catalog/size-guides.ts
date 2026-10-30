import type { CategoryRef } from './types';

/**
 * Size guides come from the API (GET /size-guides, edited in Admin -> Size guides).
 * One guide per audience (Women / Men / Kids ...). A category shows the guide
 * linked to it, or its parent's.
 */

export type SizeGuideRow = { labelHe: string; labelEn: string; values: string[] };

export type SizeGuideTable = {
  titleHe: string;
  titleEn: string;
  noteHe?: string | null;
  noteEn?: string | null;
  /** Size labels across the top; every row has one value per column. */
  columns: string[];
  rows: SizeGuideRow[];
};

export type SizeGuideStep = { titleHe: string; titleEn: string; bodyHe: string; bodyEn: string };

export type SizeGuideTip = { he: string; en: string };

export type SizeGuideCategory = { id: string; slug: string; nameHe: string; nameEn: string; parentId: string | null };

export type SizeGuide = {
  id: string;
  slug: string;
  nameHe: string;
  nameEn: string;
  introHe: string | null;
  introEn: string | null;
  imageUrl: string | null;
  imageAltHe: string | null;
  imageAltEn: string | null;
  tables: SizeGuideTable[];
  steps: SizeGuideStep[];
  tips: SizeGuideTip[];
  isActive: boolean;
  sortOrder: number;
  categories: SizeGuideCategory[];
};

/** The Hebrew or English variant of a bilingual field. */
export function localized(locale: string, he: string | null | undefined, en: string | null | undefined): string {
  return (locale === 'he' ? he || en : en || he) ?? '';
}

/** The guide for a product's category (its own, else the parent's), if it is active. */
export function sizeGuideForCategory(category: CategoryRef | null | undefined, guides: SizeGuide[]): SizeGuide | null {
  const id = category?.sizeGuideId ?? category?.parent?.sizeGuideId ?? null;
  return (id && guides.find((g) => g.id === id)) || null;
}

/** Where "Shop Women" on a guide page leads: its first top-level category. */
export function shopCategoryFor(guide: SizeGuide): SizeGuideCategory | null {
  return guide.categories.find((c) => !c.parentId) ?? guide.categories[0] ?? null;
}
