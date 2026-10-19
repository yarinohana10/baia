import { describe, expect, it } from 'vitest';
import { checkoutSchema, contactSchema, paySchema, registerFormSchema, validateForm } from '@baia/shared';
import { clearIssue, fieldMessage, firstInvalidField, invalidProps, translateIssues, type Translate } from '../form-errors';

/** A fake next-intl translator: `key{values}` so assertions see both. */
const t: Translate = (key, values) => (values ? `${key}${JSON.stringify(values)}` : key);

describe('validateForm', () => {
  it('returns the parsed payload when valid', () => {
    const result = validateForm(contactSchema, { name: ' Dana ', email: 'dana@example.com', message: 'Hi', phone: '' });
    expect(result).toEqual({
      success: true,
      data: { name: 'Dana', email: 'dana@example.com', message: 'Hi', phone: undefined },
      errors: {},
    });
  });

  it('maps each invalid field to its first i18n key, with ICU values', () => {
    const result = validateForm(contactSchema, { name: 'x'.repeat(101), email: 'nope', message: '  ', phone: 'abc' });
    expect(result.success).toBe(false);
    expect(result.errors).toEqual({
      name: { key: 'validation.tooLong', values: { max: 100 } },
      email: { key: 'validation.emailInvalid' },
      message: { key: 'validation.required', values: { min: 1 } },
      phone: { key: 'validation.phoneInvalid' },
    });
  });

  it("maps Zod's own English messages onto generic keys", () => {
    expect(validateForm(paySchema, { method: 'cash', installments: 'two' }).errors).toEqual({
      method: { key: 'validation.invalid' },
      installments: { key: 'validation.invalid' },
    });
    expect(validateForm(checkoutSchema, {}).errors).toEqual({ deliveryMethod: { key: 'validation.invalid' } });
  });

  it('reports cross-field rules on the field they belong to', () => {
    const result = validateForm(registerFormSchema, {
      name: 'Dana',
      email: 'dana@example.com',
      password: 'longenough',
      confirmPassword: 'different',
    });
    expect(result.errors).toEqual({ confirmPassword: { key: 'validation.passwordsMismatch' } });
  });
});

describe('presenting issues', () => {
  const issues = {
    email: { key: 'validation.emailInvalid' },
    name: { key: 'validation.tooLong', values: { max: 100 } },
  };

  it('translates one field, or nothing when it is valid', () => {
    expect(fieldMessage(issues.name, t)).toBe('validation.tooLong{"max":100}');
    expect(fieldMessage(undefined, t)).toBeUndefined();
  });

  it('translates every field', () => {
    expect(translateIssues(issues, t)).toEqual({
      email: 'validation.emailInvalid',
      name: 'validation.tooLong{"max":100}',
    });
  });

  it('finds the first invalid field in on-screen order', () => {
    expect(firstInvalidField(issues, ['name', 'email'])).toBe('name');
    expect(firstInvalidField(issues, ['phone'])).toBe('email');
    expect(firstInvalidField({}, ['name'])).toBeUndefined();
  });

  it('clears a fixed field without touching the others', () => {
    const next = clearIssue(issues, 'email');
    expect(next).toEqual({ name: issues.name });
    expect(issues.email).toBeDefined();
    expect(clearIssue(issues, 'phone')).toBe(issues);
  });

  it('wires aria attributes only for invalid fields', () => {
    expect(invalidProps(issues, 'email', 'e-err')).toEqual({ 'aria-invalid': true, 'aria-describedby': 'e-err' });
    expect(invalidProps(issues, 'phone', 'p-err')).toEqual({});
  });
});
