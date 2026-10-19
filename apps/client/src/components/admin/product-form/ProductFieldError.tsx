export function ProductFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive font-body">{message}</p>;
}
