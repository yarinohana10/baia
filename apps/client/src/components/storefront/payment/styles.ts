import { cn } from '@/lib/utils';

export const paymentInputClass =
  'w-full px-3 py-2.5 border rounded-lg text-sm focus:border-ocean-500 focus:outline-none focus:ring-1 focus:ring-ocean-500 disabled:bg-gray-50';
export const paymentLabelClass = 'block text-xs font-medium text-gray-600 mb-1';
export const payButtonClass =
  'w-full bg-ocean-700 text-white py-3 text-sm tracking-wide rounded-lg hover:bg-ocean-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

/** A payment input's classes, red-bordered while it shows an error. */
export function paymentInputClasses(invalid: boolean, extra: string): string {
  return cn(paymentInputClass, extra, invalid ? 'border-red-400' : 'border-gray-300');
}
