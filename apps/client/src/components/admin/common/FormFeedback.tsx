import { cn } from '@/lib/utils';

export type Feedback = { type: 'success' | 'error'; text: string };

/** Result of the last save on an admin form page. */
export function FormFeedback({ feedback }: { feedback: Feedback }) {
  return (
    <div
      role={feedback.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'mb-6 rounded-xl px-4 py-3 font-body text-sm',
        feedback.type === 'success'
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-destructive border border-red-200',
      )}
    >
      {feedback.text}
    </div>
  );
}
