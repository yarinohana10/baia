import { AlertTriangle } from 'lucide-react';

/** Save error, with server errors that have no input of their own listed below it. */
export function ProductFormErrorBanner({ error, fieldErrors }: { error: string; fieldErrors: [string, string][] }) {
  return (
    <div
      role="alert"
      className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <p className="flex items-center gap-2">
        <AlertTriangle size={14} /> {error}
      </p>
      {fieldErrors.length > 0 && (
        <ul className="list-disc ps-6 text-xs">
          {fieldErrors.map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
