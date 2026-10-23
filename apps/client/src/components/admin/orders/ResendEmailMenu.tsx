'use client';

import { useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { useTranslations } from 'next-intl';
import { ChevronDown, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { canResendTemplate } from './order-utils';
import { RESEND_TEMPLATES, type AdminOrder, type ResendTemplate } from './types';

/** "Resend email" menu: pick which of the order's emails to send again. */
export function ResendEmailMenu({
  order,
  onResend,
}: {
  order: AdminOrder;
  onResend: (template: ResendTemplate) => Promise<void>;
}) {
  const t = useTranslations('admin.orderCards.resend');
  const te = useTranslations('admin.orderEmails.templates');
  const [sending, setSending] = useState(false);

  const send = async (template: ResendTemplate) => {
    if (sending) return;
    if (!confirm(t('confirm', { name: te(template), email: order.customerEmail }))) return;
    setSending(true);
    await onResend(template);
    setSending(false);
  };

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={sending}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
        aria-busy={sending}
      >
        <Send size={14} aria-hidden="true" />
        {sending ? t('sending') : t('menu')}
        <ChevronDown size={12} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="start" className="z-50">
          <Menu.Popup className="min-w-52 rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none">
            {RESEND_TEMPLATES.map((template) => (
              <Menu.Item
                key={template}
                disabled={!canResendTemplate(order, template)}
                onClick={() => send(template)}
                className="cursor-default rounded-md px-2.5 py-1.5 outline-none data-disabled:opacity-40 data-highlighted:bg-muted"
              >
                {te(template)}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
