import type { InputHTMLAttributes } from 'react';
import { invalidProps, type FieldIssues } from '@/lib/form-errors';
import { FieldError } from '@/components/forms/FieldError';
import { RequiredMark } from '@/components/forms/RequiredMark';
import { FIELD_INPUTS, type CheckoutInputField } from '@/hooks/storefront/checkoutFormState';
import { checkoutInputClass, checkoutLabelClass } from './styles';

/** A labelled checkout input wired to its checkoutSchema field's error. */
export function CheckoutField({
  field,
  label,
  issues,
  onValueChange,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className' | 'onChange'> & {
  field: CheckoutInputField;
  label: string;
  issues: FieldIssues;
  onValueChange: (value: string) => void;
}) {
  const id = FIELD_INPUTS[field];
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className={checkoutLabelClass}>
        {label}
        {input.required && <RequiredMark />}
      </label>
      <input
        id={id}
        onChange={(e) => onValueChange(e.target.value)}
        {...invalidProps(issues, field, errorId)}
        // After the aria wiring, so a field may keep its own hint as its description.
        {...input}
        className={checkoutInputClass}
      />
      <FieldError id={errorId} issue={issues[field]} className="text-red-500" />
    </div>
  );
}
