/**
 * Maps the server's field-error responses (400 validation / 409 conflict,
 * shape `{ errors: [{ field, code, message }] }`) to translated, per-field
 * messages the product form can show inline.
 */

export type ServerFieldError = { field: string; code: string; message: string };

/** Field path → translated message (e.g. `slug`, `variants.2.sku`, `images.0.altTextEn`). */
export type FieldErrors = Record<string, string>;

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Translation key (under `admin.productForm.errors`) for a server error code. */
function keyFor(err: ServerFieldError): string {
  const leaf = err.field.split('.').pop() ?? err.field;
  switch (err.code) {
    case 'unique':
      if (leaf === 'slug') return 'slugTaken';
      if (leaf === 'sku') return 'skuTaken';
      return 'alreadyExists';
    case 'duplicate':
      return 'skuDuplicate';
    case 'duplicateCombination':
      return 'variantDuplicate';
    case 'stockChanged':
      return 'stockChanged';
    case 'saleBelowPrice':
      return 'saleBelowPrice';
    case 'saleDateRange':
      return 'saleDateRange';
    case 'isNotEmpty':
    case 'required':
      return err.field === 'variants' ? 'noSizes' : 'required';
    case 'isPositive':
      return 'mustBePositive';
    case 'min':
      return 'mustBeNonNegative';
    case 'isInt':
      return 'mustBeWholeNumber';
    case 'isNumber':
      return 'invalidNumber';
    case 'isDateString':
      return 'invalidDate';
    case 'matches':
      return leaf === 'slug' ? 'slugInvalid' : 'invalidValue';
    case 'maxLength':
      return 'tooLong';
    case 'hasSubcategories':
      return 'categoryHasSubcategories';
    case 'notFound':
      return leaf === 'categoryId' ? 'categoryNotFound' : 'notFound';
    default:
      return 'invalidValue';
  }
}

export function serverFieldErrors(data: unknown): ServerFieldError[] {
  const errors = (data as { errors?: unknown } | undefined)?.errors;
  if (!Array.isArray(errors)) return [];
  return errors.filter(
    (e): e is ServerFieldError => !!e && typeof e.field === 'string' && typeof e.code === 'string',
  );
}

/**
 * Translates server field errors. `prefix` re-roots paths for single-entity
 * endpoints (e.g. variant `sku` → `variants.3.sku`).
 */
export function translateFieldErrors(errors: ServerFieldError[], t: Translate, prefix = ''): FieldErrors {
  const result: FieldErrors = {};
  for (const err of errors) {
    const path = prefix ? `${prefix}.${err.field}` : err.field;
    // Keep the first error per field — it's the most specific one
    if (!result[path]) result[path] = t(`errors.${keyFor(err)}`);
  }
  return result;
}

/** Extracts the response body from an axios-style error, if any. */
export function responseOf(err: unknown): { status?: number; data?: unknown } {
  const response = (err as { response?: { status?: number; data?: unknown } })?.response;
  return { status: response?.status, data: response?.data };
}
