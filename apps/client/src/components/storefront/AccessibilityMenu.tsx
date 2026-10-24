'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Accessibility, Minus, Plus, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/**
 * Accessibility menu (floating button, bottom-end corner, opposite the WhatsApp
 * button). Each choice is a class on <html> styled in globals.css, so it applies
 * to every page, drawer and dialog, and is remembered in this browser.
 */

type Toggle = 'contrast' | 'grayscale' | 'links' | 'readable' | 'noMotion';
type Settings = { text: number } & Record<Toggle, boolean>;

const STORAGE_KEY = 'baia-a11y';
const MAX_TEXT_STEP = 3;
const DEFAULTS: Settings = { text: 0, contrast: false, grayscale: false, links: false, readable: false, noMotion: false };
const TOGGLES: Toggle[] = ['contrast', 'grayscale', 'links', 'readable', 'noMotion'];
const CLASS_OF: Record<Toggle, string> = {
  contrast: 'a11y-contrast',
  grayscale: 'a11y-grayscale',
  links: 'a11y-links',
  readable: 'a11y-readable',
  noMotion: 'a11y-no-motion',
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function apply(settings: Settings) {
  const root = document.documentElement;
  for (let step = 1; step <= MAX_TEXT_STEP; step++) root.classList.toggle(`a11y-text-${step}`, settings.text === step);
  for (const key of TOGGLES) root.classList.toggle(CLASS_OF[key], settings[key]);
}

export function AccessibilityMenu() {
  const t = useTranslations('accessibilityMenu');
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const panelId = useId();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Restore the saved choices once on load.
  useEffect(() => {
    const saved = load();
    setSettings(saved);
    apply(saved);
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const update = (next: Settings) => {
    setSettings(next);
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode / blocked storage: the choice still applies to this page view.
    }
  };

  const toggleClass = (on: boolean) =>
    `flex min-h-11 w-full items-center justify-between gap-3 border px-3 text-start text-[13px] transition-colors ${
      on ? 'border-black bg-black text-white' : 'border-black/15 text-black hover:border-black'
    }`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('open')}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] end-4 z-40 flex size-12 items-center justify-center rounded-full bg-black text-white shadow-[0_6px_24px_rgba(0,0,0,0.2)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black print:hidden sm:bottom-6 sm:end-6 sm:size-14"
        title={t('open')}
      >
        <Accessibility size={26} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="fixed bottom-20 end-4 z-50 w-[min(20rem,calc(100vw-2rem))] border border-black/10 bg-white p-4 text-black shadow-[0_12px_40px_rgba(0,0,0,0.18)] outline-none sm:bottom-24 sm:end-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 id={titleId} className="text-[13px] font-semibold uppercase ltr:tracking-[0.12em]">
              {t('title')}
            </h2>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              aria-label={t('close')}
              className="inline-flex size-9 items-center justify-center hover:bg-black/5"
            >
              <X size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          <div className="mb-2 flex min-h-11 items-center justify-between gap-3 border border-black/15 px-3 text-[13px]">
            <span id={`${titleId}-text`}>{t('textSize')}</span>
            <div role="group" aria-labelledby={`${titleId}-text`} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => update({ ...settings, text: Math.max(0, settings.text - 1) })}
                disabled={settings.text === 0}
                aria-label={t('smaller')}
                className="inline-flex size-8 items-center justify-center border border-black/15 disabled:opacity-30"
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <span className="w-10 text-center tabular-nums" aria-live="polite">
                {100 + settings.text * 10}%
              </span>
              <button
                type="button"
                onClick={() => update({ ...settings, text: Math.min(MAX_TEXT_STEP, settings.text + 1) })}
                disabled={settings.text === MAX_TEXT_STEP}
                aria-label={t('larger')}
                className="inline-flex size-8 items-center justify-center border border-black/15 disabled:opacity-30"
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {TOGGLES.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={settings[key]}
                  onClick={() => update({ ...settings, [key]: !settings[key] })}
                  className={toggleClass(settings[key])}
                >
                  {t(key)}
                  <span aria-hidden="true" className="text-[11px] opacity-70">
                    {settings[key] ? t('on') : t('off')}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-black/10 pt-3 text-[12px]">
            <button type="button" onClick={() => update(DEFAULTS)} className="underline underline-offset-4 hover:opacity-60">
              {t('reset')}
            </button>
            <Link href="/accessibility" onClick={() => setOpen(false)} className="underline underline-offset-4 hover:opacity-60">
              {t('statement')}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
