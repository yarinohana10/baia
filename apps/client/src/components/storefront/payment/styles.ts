import { cn } from '@/lib/utils';

export const paymentInputClass =
  'w-full px-3 py-2.5 border rounded-none text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:bg-gray-50';
export const paymentLabelClass = 'block text-xs font-medium text-gray-600 mb-1';
export const payButtonClass =
  'w-full bg-black text-white py-3 text-sm tracking-wide rounded-none hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

/** A payment input's classes, red-bordered while it shows an error. */
export function paymentInputClasses(invalid: boolean, extra: string): string {
  return cn(paymentInputClass, extra, invalid ? 'border-red-400' : 'border-gray-300');
}
