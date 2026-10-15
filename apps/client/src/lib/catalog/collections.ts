export type CollectionLink = { label: string; href: string };

/** Other top-level collections to suggest from an empty state, excluding the one being viewed. */
export function suggestedCollections(all: CollectionLink[], currentHref: string, max = 3): CollectionLink[] {
  return all.filter((c) => c.href !== currentHref).slice(0, max);
}
