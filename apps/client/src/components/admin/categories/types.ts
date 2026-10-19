import { isAxiosError } from 'axios';

export type Category = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  sortOrder: number;
  parentId: string | null;
  sizeSetId?: string | null;
  image?: string | null;
  children: Category[];
};

export type SizeSetOption = { id: string; nameHe: string; nameEn: string };

/** Slug suggested from the English name (new categories only). */
export function autoSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type ApiFieldError = { field: string; code: string };

function apiErrors(err: unknown): { codes: Set<string>; fields: Set<string> } {
  if (!isAxiosError(err)) return { codes: new Set(), fields: new Set() };
  const errors: ApiFieldError[] = err.response?.data?.errors ?? [];
  return { codes: new Set(errors.map((e) => e.code)), fields: new Set(errors.map((e) => e.field)) };
}

export type SaveErrorKey =
  | 'parentHasProducts'
  | 'duplicateSlug'
  | 'invalidSlug'
  | 'invalidParent'
  | 'parentNotTopLevel'
  | 'cannotNestWithChildren'
  | 'saveFailed';

export function saveErrorKey(err: unknown): SaveErrorKey {
  const { codes, fields } = apiErrors(err);
  if (codes.has('parentHasProducts')) return 'parentHasProducts';
  if (fields.has('slug')) return codes.has('unique') ? 'duplicateSlug' : 'invalidSlug';
  if (codes.has('selfParent') || codes.has('descendantParent') || codes.has('notFound')) return 'invalidParent';
  if (codes.has('maxDepth')) return 'parentNotTopLevel';
  if (codes.has('hasSubcategories')) return 'cannotNestWithChildren';
  return 'saveFailed';
}

export function deleteErrorKey(err: unknown): 'deleteHasProducts' | 'deleteHasChildren' | 'deleteFailed' {
  const { codes } = apiErrors(err);
  if (codes.has('hasProducts')) return 'deleteHasProducts';
  if (codes.has('hasSubcategories')) return 'deleteHasChildren';
  return 'deleteFailed';
}

/**
 * Parents the edited category may move under: not itself nor one of its
 * subcategories (only top-level categories are listed, so two levels max).
 */
export function parentOptions(categories: Category[], editing: Category | null): Category[] {
  if (!editing) return categories;
  const excluded = new Set([editing.id, ...(editing.children ?? []).map((child) => child.id)]);
  return categories.filter((cat) => !excluded.has(cat.id));
}
