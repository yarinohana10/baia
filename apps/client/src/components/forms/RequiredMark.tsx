/** Red asterisk after a required field's label. The input's `required` attribute tells assistive tech. */
export function RequiredMark() {
  return (
    <span className="ms-0.5 text-red-600" aria-hidden="true">
      *
    </span>
  );
}
