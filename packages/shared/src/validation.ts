import type { ZodError, ZodIssue, ZodTypeAny, z } from 'zod';
import { V } from './schemas/common';

/** An i18n key (e.g. `validation.tooLong`) plus its ICU values (e.g. `{ max: 100 }`). */
export type FieldIssue = { key: string; values?: Record<string, string | number> };
/** First issue per field, keyed by dotted path (`shippingCity`, `items.2.sku`); form-level issues use `_form`. */
export type FieldIssues = Record<string, FieldIssue>;

export const FORM_FIELD = '_form';

const isKey = (message: string) => message.startsWith('validation.');

/** Zod's own messages are English text: map them onto our keys by issue code. */
function fallbackKey(issue: ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' || issue.received === 'null' ? V.required : V.invalid;
    case 'too_big':
      return V.tooLong;
    case 'too_small':
      return issue.type === 'string' && issue.minimum === 1 ? V.required : V.tooShort;
    case 'invalid_string':
      return issue.validation === 'email' ? V.emailInvalid : V.invalid;
    default:
      return V.invalid;
  }
}

function values(issue: ZodIssue): FieldIssue['values'] {
  if (issue.code === 'too_big') return { max: Number(issue.maximum) };
  if (issue.code === 'too_small') return { min: Number(issue.minimum) };
  return undefined;
}

export function toFieldIssue(issue: ZodIssue): FieldIssue {
  const key = isKey(issue.message) ? issue.message : fallbackKey(issue);
  const vals = values(issue);
  return vals ? { key, values: vals } : { key };
}

/** Flattens a ZodError to the first issue of each field. */
export function issuesByField(error: ZodError): FieldIssues {
  const out: FieldIssues = {};
  for (const issue of error.issues) {
    const path = issue.path.length ? issue.path.join('.') : FORM_FIELD;
    if (!out[path]) out[path] = toFieldIssue(issue);
  }
  return out;
}

export type FormValidation<S extends ZodTypeAny> =
  | { success: true; data: z.output<S>; errors: Record<string, never> }
  | { success: false; data?: undefined; errors: FieldIssues };

/** `schema.safeParse` for forms: the parsed payload, or per-field i18n error keys. */
export function validateForm<S extends ZodTypeAny>(schema: S, input: unknown): FormValidation<S> {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data, errors: {} };
  return { success: false, errors: issuesByField(result.error) };
}
