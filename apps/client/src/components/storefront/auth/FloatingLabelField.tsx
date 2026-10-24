import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RequiredMark } from '@/components/forms/RequiredMark';

const inputClass =
  'w-full bg-transparent border-b border-neutral-300 py-3 px-1 text-base text-black focus:outline-none focus:border-black transition-colors duration-300 peer';
const labelClass =
  'absolute start-1 top-3 text-neutral-600 text-base transition-all duration-300 transform -translate-y-6 scale-75 origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6 peer-focus:text-black pointer-events-none';

/** Underlined input whose label floats above it once focused or filled (register page). */
export function FloatingLabelField({
  id,
  label,
  inputClassName,
  children,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'placeholder' | 'className'> & {
  id: string;
  label: string;
  /** Extra input classes (e.g. room for a trailing button). */
  inputClassName?: string;
  /** Rendered after the label (e.g. a show-password toggle). */
  children?: ReactNode;
}) {
  return (
    <div className="relative group">
      {/* A blank placeholder drives the `peer-placeholder-shown` label position. */}
      <input id={id} placeholder=" " className={cn(inputClass, inputClassName)} {...input} />
      <label htmlFor={id} className={labelClass}>
        {label}
        {input.required && <RequiredMark />}
      </label>
      {children}
    </div>
  );
}
