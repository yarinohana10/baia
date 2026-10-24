'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { errorCode } from '@/lib/shop-errors';
import { addressesApi, MAX_ADDRESSES, streetLine, toInput, type Address, type AddressInput } from '@/lib/addresses';
import { AddressForm } from '@/components/storefront/account/AddressForm';
import { primaryButtonClass, secondaryButtonClass, textButtonClass } from '@/components/storefront/account/styles';
import { AlertTriangle, ChevronLeft, MapPin, Plus } from 'lucide-react';

/** Which form is open: none, the "new address" form, or editing one address. */
type Editing = null | 'new' | string;

export default function MyAddressesPage() {
  const t = useTranslations('addresses');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    addressesApi
      .list()
      .then(setAddresses)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => addressesApi.list().then(setAddresses);

  const openForm = (target: Editing) => {
    setFormError(null);
    setActionError(null);
    setConfirmDelete(null);
    setEditing(target);
  };

  const save = async (input: AddressInput & { isDefault?: boolean }) => {
    setSaving(true);
    setFormError(null);
    try {
      if (editing === 'new') await addressesApi.create(input);
      else if (editing) await addressesApi.update(editing, input);
      await refresh();
      setEditing(null);
    } catch (err) {
      setFormError(
        errorCode(err) === 'ADDRESS_LIMIT_REACHED' ? t('limitReached', { max: MAX_ADDRESSES }) : t('saveError'),
      );
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: () => Promise<unknown>, failure: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      await refresh();
    } catch {
      setActionError(failure);
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  };

  const atLimit = addresses.length >= MAX_ADDRESSES;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <Link
        href="/account"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-black mb-6"
      >
        <ChevronLeft size={16} className="rtl:rotate-180" />
        {t('backToAccount')}
      </Link>

      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">{t('title')}</h1>
        {!loading && !loadError && editing !== 'new' && addresses.length > 0 && (
          <button
            type="button"
            onClick={() => openForm('new')}
            disabled={atLimit}
            title={atLimit ? t('limitReached', { max: MAX_ADDRESSES }) : undefined}
            className={`${primaryButtonClass} shrink-0 whitespace-nowrap`}
          >
            <Plus size={16} />
            {t('add')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-none" />
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-20">
          <AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" />
          <p role="alert" className="text-gray-400 mb-6">{t('loadError')}</p>
          <button type="button" onClick={load} className={primaryButtonClass}>
            {t('retry')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {editing === 'new' && (
            <section className="bg-white border border-neutral-400 rounded-none p-6 space-y-4">
              <h2 className="text-base font-semibold text-black">{t('newAddress')}</h2>
              <AddressForm
                showDefaultToggle={addresses.length > 0}
                submitting={saving}
                error={formError}
                onSubmit={save}
                onCancel={() => setEditing(null)}
              />
            </section>
          )}

          {addresses.length === 0 && editing !== 'new' && (
            <div className="text-center py-16 bg-white border border-gray-200 rounded-none">
              <MapPin size={40} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-400 mb-6">{t('empty')}</p>
              <button type="button" onClick={() => openForm('new')} className={primaryButtonClass}>
                <Plus size={16} />
                {t('add')}
              </button>
            </div>
          )}

          {actionError && (
            <p role="alert" className="text-sm text-red-500">
              {actionError}
            </p>
          )}

          {addresses.map((address) =>
            editing === address.id ? (
              <section key={address.id} className="bg-white border border-neutral-400 rounded-none p-6 space-y-4">
                <h2 className="text-base font-semibold text-black">{t('editAddress')}</h2>
                <AddressForm
                  initial={toInput(address)}
                  showDefaultToggle={!address.isDefault}
                  submitting={saving}
                  error={formError}
                  onSubmit={save}
                  onCancel={() => setEditing(null)}
                />
              </section>
            ) : (
              <article
                key={address.id}
                aria-busy={busyId === address.id}
                className="bg-white border border-gray-200 rounded-none p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="p-2.5 bg-[#F7F7F7] rounded-none text-black shrink-0">
                    <MapPin size={20} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 text-sm text-neutral-600 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-black">
                      <bdi>{address.recipientName}</bdi>
                      {address.isDefault && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-none bg-[#F7F7F7] text-black">
                          {t('default')}
                        </span>
                      )}
                    </p>
                    <p>
                      <bdi>{streetLine(address)}</bdi>
                      {address.apartment && <>, {t('apartmentShort', { apartment: address.apartment })}</>}
                    </p>
                    <p>
                      <bdi>{address.city}</bdi>
                      {address.zip && <> &middot; <bdi dir="ltr">{address.zip}</bdi></>}
                    </p>
                    <p>
                      <bdi dir="ltr">{address.phone}</bdi>
                    </p>
                  </div>
                </div>

                {confirmDelete === address.id ? (
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <span className="text-sm text-black">{t('confirmDelete')}</span>
                    <button
                      type="button"
                      disabled={busyId === address.id}
                      onClick={() => runAction(address.id, () => addressesApi.remove(address.id), t('deleteError'))}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded-none hover:bg-red-700 transition-colors disabled:opacity-40"
                    >
                      {t('confirmDeleteYes')}
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(null)} className={secondaryButtonClass}>
                      {t('cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-4 shrink-0">
                    {!address.isDefault && (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() =>
                          runAction(address.id, () => addressesApi.setDefault(address.id), t('setDefaultError'))
                        }
                        className={textButtonClass}
                      >
                        {t('setDefault')}
                      </button>
                    )}
                    <button type="button" onClick={() => openForm(address.id)} className={textButtonClass}>
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setConfirmDelete(address.id);
                      }}
                      className="text-sm font-semibold text-red-600 hover:text-red-700 underline-offset-4 hover:underline"
                    >
                      {t('delete')}
                    </button>
                  </div>
                )}
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}
