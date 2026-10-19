type Named = { nameHe: string; nameEn: string };

/** The Hebrew or English name of a product / category for the given locale. */
export function localizedName(item: Named, locale: string): string {
  return locale === 'he' ? item.nameHe : item.nameEn;
}

/** Category pages as `{ label, href }` links (e.g. "browse instead" suggestions). */
export function categoryLinks(categories: (Named & { slug: string })[], locale: string): { label: string; href: string }[] {
  return categories.map((c) => ({ label: localizedName(c, locale), href: `/category/${c.slug}` }));
}
