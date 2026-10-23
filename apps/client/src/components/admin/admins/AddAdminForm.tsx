'use client';

import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Add-by-email form. `onSubmit` resolves true when the email was accepted (the field then clears). */
export function AddAdminForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (email: string) => Promise<boolean> }) {
  const t = useTranslations('admin.admins');
  const id = useId();
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || submitting) return;
    if (await onSubmit(trimmed)) setEmail('');
  };

  return (
    <Card className="p-5">
      <h2 className="font-serif text-lg font-semibold text-foreground">{t('addTitle')}</h2>
      <p id={`${id}-hint`} className="mt-1 max-w-2xl text-sm text-muted-foreground">
        {t('addHint')}
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor={`${id}-email`} className="mb-1.5 block">
            {t('emailLabel')}
          </Label>
          <Input
            id={`${id}-email`}
            type="email"
            dir="ltr"
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            aria-describedby={`${id}-hint`}
          />
        </div>
        <Button type="submit" disabled={submitting || !email.trim()} className="gap-2 bg-ocean-700 text-white hover:bg-ocean-800">
          <UserPlus size={16} aria-hidden="true" />
          {submitting ? t('adding') : t('add')}
        </Button>
      </form>
    </Card>
  );
}
