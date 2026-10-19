import type { Category } from '@/components/admin/categories/types';

export type CategoryDraft = {
  nameHe: string;
  nameEn: string;
  slug: string;
  parentId: string;
  sizeSetId: string;
  sortOrder: number;
};

export type CategoryEditor = {
  open: boolean;
  /** The category being edited; null while creating. */
  editing: Category | null;
  draft: CategoryDraft;
};

export type CategoryEditorAction =
  | { type: 'create' }
  | { type: 'edit'; category: Category }
  | { type: 'close' }
  | { type: 'change'; changes: Partial<CategoryDraft> }
  | { type: 'imageRemoved' }
  /** A category was deleted; close the form if it was the one being edited. */
  | { type: 'deleted'; id: string };

export const EMPTY_CATEGORY_DRAFT: CategoryDraft = { nameHe: '', nameEn: '', slug: '', parentId: '', sizeSetId: '', sortOrder: 0 };

export const CLOSED_CATEGORY_EDITOR: CategoryEditor = { open: false, editing: null, draft: EMPTY_CATEGORY_DRAFT };

export function categoryToDraft(cat: Category): CategoryDraft {
  return {
    nameHe: cat.nameHe,
    nameEn: cat.nameEn,
    slug: cat.slug,
    parentId: cat.parentId || '',
    sizeSetId: cat.sizeSetId || '',
    sortOrder: cat.sortOrder,
  };
}

/** API body: an empty parent moves the category to the top level, an empty size set inherits the parent's. */
export function categoryPayload(d: CategoryDraft) {
  return { ...d, parentId: d.parentId || null, sizeSetId: d.sizeSetId || null };
}

export function categoryEditorReducer(state: CategoryEditor, action: CategoryEditorAction): CategoryEditor {
  switch (action.type) {
    case 'create':
      return { open: true, editing: null, draft: EMPTY_CATEGORY_DRAFT };
    case 'edit':
      return { open: true, editing: action.category, draft: categoryToDraft(action.category) };
    case 'close':
      return CLOSED_CATEGORY_EDITOR;
    case 'change':
      return { ...state, draft: { ...state.draft, ...action.changes } };
    case 'imageRemoved':
      return state.editing ? { ...state, editing: { ...state.editing, image: null } } : state;
    case 'deleted':
      return state.editing?.id === action.id ? { ...state, open: false, editing: null } : state;
  }
}
