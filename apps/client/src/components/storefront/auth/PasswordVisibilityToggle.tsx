'use client';

import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';

/** Eye button inside a password field (kept out of the tab order, as before). */
export function PasswordVisibilityToggle({
  visible,
  onToggle,
  className,
}: {
  visible: boolean;
  onToggle: () => void;
  className: string;
}) {
  const t = useTranslations('auth');
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? t('hidePassword') : t('showPassword')}
      className={className}
      tabIndex={-1}
    >
      {visible ? <Eye size={18} /> : <EyeOff size={18} />}
    </button>
  );
}
