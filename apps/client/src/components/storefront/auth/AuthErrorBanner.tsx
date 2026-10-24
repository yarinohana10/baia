/** The form-level error under the login / register heading. */
export function AuthErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div className="bg-[#ffdad6] text-[#93000a] text-sm p-3 rounded-none">{message}</div>;
}
