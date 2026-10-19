import type { FieldIssue, FieldIssues } from '@baia/shared';

/** Forms validate with `validateForm(schema, values)` from @baia/shared; these helpers present its issues. */
export { validateForm } from '@baia/shared';
export type { FieldIssue, FieldIssues };

/** next-intl's translator, called with a full key (`validation.required`). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Translates one field's issue (undefined when the field is valid). */
export function fieldMessage(issue: FieldIssue | undefined, t: Translate): string | undefined {
  return issue ? t(issue.key, issue.values) : undefined;
}

/** Translates every field's issue: `{ email: 'נא להזין כתובת אימייל תקינה' }`. */
export function translateIssues(issues: FieldIssues, t: Translate): Record<string, string> {
  return Object.fromEntries(Object.entries(issues).map(([field, issue]) => [field, t(issue.key, issue.values)]));
}

/** The first invalid field in on-screen order (to focus or scroll to it). */
export function firstInvalidField(issues: FieldIssues, order: readonly string[]): string | undefined {
  return order.find((field) => issues[field]) ?? Object.keys(issues)[0];
}

/** Drops one field's issue (call from onChange so a fixed field stops showing its error). */
export function clearIssue(issues: FieldIssues, field: string): FieldIssues {
  if (!issues[field]) return issues;
  const next = { ...issues };
  delete next[field];
  return next;
}

/** Props that wire an input to its <FieldError id=…/>. */
export function invalidProps(issues: FieldIssues, field: string, errorId: string) {
  return issues[field] ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {};
}
