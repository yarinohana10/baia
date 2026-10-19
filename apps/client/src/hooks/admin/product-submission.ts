import type { FieldErrors } from '@/components/admin/product-form-errors';

/** Save state of the product form. */
export type ProductSubmission = {
  /** A save was attempted, so client-side errors are shown live from now on. */
  submitted: boolean;
  saving: boolean;
  /** Top banner message ('' = none). */
  error: string;
  /** Field errors from the API; each clears once the admin edits that field. */
  serverErrors: FieldErrors;
};

export type ProductSubmissionAction =
  /** A save was attempted: earlier server errors are dropped. */
  | { type: 'attempt' }
  | { type: 'invalid'; error: string }
  | { type: 'start' }
  | { type: 'failed'; error: string; serverErrors?: FieldErrors }
  | { type: 'settled' }
  | { type: 'fieldsEdited'; fields: string[] }
  | { type: 'imagesChanged' };

export const INITIAL_SUBMISSION: ProductSubmission = { submitted: false, saving: false, error: '', serverErrors: {} };

function withoutFields(errors: FieldErrors, keep: (field: string) => boolean): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([field]) => keep(field)));
}

export function productSubmissionReducer(state: ProductSubmission, action: ProductSubmissionAction): ProductSubmission {
  switch (action.type) {
    case 'attempt':
      return { ...state, submitted: true, serverErrors: {} };
    case 'invalid':
      return { ...state, error: action.error };
    case 'start':
      return { ...state, error: '', saving: true };
    case 'failed':
      return { ...state, error: action.error, serverErrors: { ...state.serverErrors, ...action.serverErrors } };
    case 'settled':
      return { ...state, saving: false };
    case 'fieldsEdited': {
      if (!action.fields.some((f) => state.serverErrors[f])) return state;
      return { ...state, serverErrors: withoutFields(state.serverErrors, (f) => !action.fields.includes(f)) };
    }
    case 'imagesChanged':
      return { ...state, serverErrors: withoutFields(state.serverErrors, (f) => !f.startsWith('images.')) };
  }
}
