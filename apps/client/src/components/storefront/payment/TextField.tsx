import type { ReactNode } from 'react';
import { paymentLabelClass } from './styles';

/** Label, input (passed as children) with an optional trailing adornment, then its error or hint. */
export function TextField({
  id,
  label,
  error,
  hint,
  children,
  adornment,
}: {
  id: string;
  label: string;
  error: string | null;
  hint?: string;
  children: ReactNode;
  adornment?: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={paymentLabelClass}>
        {label}
      </label>
      <div className="relative">
        {children}
        {adornment && <div className="pointer-events-none absolute inset-y-0 end-3 flex items-center">{adornment}</div>}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-gray-400">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
